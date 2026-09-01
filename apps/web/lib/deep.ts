import {
  deepScan,
  isFailure,
  unresolvedSignals,
  type RepoProfile,
  type ScanFailure,
  type SignalId,
  type SignalVerdict,
} from "@workspace/analyzer"
import { cacheLife } from "next/cache"
import { resolveSha, scanAtSha } from "@/lib/scan"
import { scoreRepo, type ScoredCategory } from "@/lib/score"

export type DeepReport =
  | { ok: false; failure: ScanFailure }
  | {
      ok: true
      profile: RepoProfile
      overall: number | null
      categories: ScoredCategory[]
      /** The signals the static pass left open, in the order they were asked about. */
      asked: SignalId[]
      /** What the agent observed. Empty when it could not finish. */
      verdicts: SignalVerdict[]
      /** Set when the agent ran but could not finish, in which case this is the static report. */
      unfinished: string | null
    }

/**
 * Cached per commit, because the same commit produces the same answers and the model is
 * essentially the whole cost of a deep scan.
 *
 * A run that could not finish throws rather than returning, so one bad sandbox or one
 * unreachable gateway is not written into the cache for the life of the commit.
 */
async function deepAtSha(
  owner: string,
  repo: string,
  sha: string
): Promise<DeepReport> {
  "use cache: remote"
  cacheLife("max")

  const base = await scanAtSha(owner, repo, sha)
  if (!base.ok) return base

  const result = await deepScan(
    { owner, repo, revision: sha, token: process.env.GITHUB_TOKEN },
    base.profile
  )
  if (result.failure !== null) throw new Error(result.failure)

  const answered = new Set(result.verdicts.map((v) => v.signal as SignalId))
  const { overall, categories } = scoreRepo(result.profile, answered)

  return {
    ok: true,
    profile: result.profile,
    overall,
    categories,
    asked: result.asked,
    verdicts: result.verdicts,
    unfinished: null,
  }
}

export async function runDeepScan(
  owner: string,
  repo: string
): Promise<DeepReport> {
  const sha = await resolveSha(owner, repo)
  if (isFailure(sha)) return { ok: false, failure: sha }

  try {
    return await deepAtSha(owner, repo, sha)
  } catch (error) {
    // The static profile is still valid and still worth showing, so the page degrades to it
    // rather than erroring.
    console.error(`Deep scan failed for ${owner}/${repo}@${sha}`, error)
    const base = await scanAtSha(owner, repo, sha)
    if (!base.ok) return base
    return {
      ...base,
      asked: unresolvedSignals(base.profile),
      verdicts: [],
      unfinished:
        error instanceof Error
          ? error.message
          : "The deep scan could not finish.",
    }
  }
}
