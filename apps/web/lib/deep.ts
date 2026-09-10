import {
  deepScan,
  isFailure,
  unresolvedSignals,
  type RepoProfile,
  type ScanFailure,
  type SignalId,
  type SignalVerdict,
} from "@workspace/analyzer"
import { propagateAttributes, startActiveObservation } from "@langfuse/tracing"
import { cachedByCommit } from "@/lib/cache"
import { flushLangfuse } from "@/instrumentation-node"
import { claimDeepScan, type QuotaRefusal } from "@/lib/quota"
import { resolveSha, scanAtSha } from "@/lib/scan"
import { scoreRepo, type ScoredCategory } from "@/lib/score"

export type DeepReport =
  | { ok: false; refused: QuotaRefusal }
  | { ok: false; refused: null; failure: ScanFailure }
  | {
      ok: true
      profile: RepoProfile
      overall: number | null
      categories: ScoredCategory[]
      asked: SignalId[]
      verdicts: SignalVerdict[]
      unfinished: string | null
    }

async function reason(
  owner: string,
  repo: string,
  sha: string
): Promise<DeepReport> {
  const base = await scanAtSha(owner, repo, sha)
  if (!base.ok) {
    if (
      base.failure.kind === "rate-limited" ||
      base.failure.kind === "unavailable"
    )
      throw new Error(base.failure.message)
    return { ...base, refused: null }
  }

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

const deepAtSha = cachedByCommit("deep", "v4", reason)

async function tracedDeepScan(
  owner: string,
  repo: string,
  sha: string,
  userId: string
): Promise<DeepReport> {
  const repository = `${owner}/${repo}`

  return propagateAttributes(
    {
      traceName: "deep-scan",
      userId,
      tags: ["deep-scan", "public-repository"],
      metadata: { repository, commitSha: sha },
      version: "deep-v4",
    },
    () =>
      startActiveObservation(
        "run-deep-scan",
        async (span) => {
          span.update({ input: { repository, commitSha: sha } })
          try {
            const report = await deepAtSha(owner, repo, sha)
            span.update({
              output: report.ok
                ? {
                    ok: true,
                    overall: report.overall,
                    questionsAsked: report.asked.length,
                    questionsAnswered: report.verdicts.length,
                  }
                : {
                    ok: false,
                    failure:
                      report.refused === null
                        ? report.failure.kind
                        : "quota-refused",
                  },
            })
            return report
          } catch (error) {
            span.update({
              level: "ERROR",
              statusMessage:
                error instanceof Error ? error.message : "Deep scan failed",
              output: { ok: false },
            })
            throw error
          }
        },
        { asType: "agent" }
      )
  )
}

export async function runDeepScan(
  owner: string,
  repo: string,
  userId: string,
  ref: string | null = null
): Promise<DeepReport> {
  const sha = await resolveSha(owner, repo, ref)
  if (isFailure(sha)) return { ok: false, refused: null, failure: sha }

  const claim = await claimDeepScan(userId, owner, repo, sha)
  if (!claim.allowed) return { ok: false, refused: claim.reason }

  try {
    return await tracedDeepScan(owner, repo, sha, userId)
  } catch (error) {
    console.error(`Deep scan failed for ${owner}/${repo}@${sha}`, error)
    const base = await scanAtSha(owner, repo, sha)
    if (!base.ok) return { ...base, refused: null }
    return {
      ...base,
      asked: unresolvedSignals(base.profile),
      verdicts: [],
      unfinished:
        error instanceof Error
          ? error.message
          : "The deep scan could not finish.",
    }
  } finally {
    await flushLangfuse()
  }
}
