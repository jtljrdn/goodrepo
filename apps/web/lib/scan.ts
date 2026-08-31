import {
  analyze,
  chooseConfigFiles,
  chooseSample,
  classifyRepo,
  fetchBlobs,
  fetchBlobsRest,
  fetchHeadSha,
  fetchRepoMeta,
  fetchTree,
  isFailure,
  type RepoProfile,
  type ScanFailure,
} from "@workspace/analyzer"
import { cacheLife } from "next/cache"
import { pinnedSha } from "@/lib/examples"
import { scoreRepo, type ScoredCategory } from "@/lib/score"

export type ScanResult =
  | {
      ok: true
      profile: RepoProfile
      overall: number | null
      categories: ScoredCategory[]
    }
  | { ok: false; failure: ScanFailure }

export function failureMessage(failure: ScanFailure): {
  title: string
  detail: string
} {
  switch (failure.kind) {
    case "not-js":
      return {
        title: "Not scanned",
        detail:
          "GoodRepo currently analyzes JavaScript and TypeScript repositories. This one has no package.json at its root. Support for other ecosystems is on the roadmap.",
      }
    case "not-found":
      return {
        title: "Not reachable",
        detail:
          "That repository is private or does not exist. GoodRepo only scans public repositories.",
      }
    case "rate-limited":
      return {
        title: "Try again shortly",
        detail:
          "GitHub is rate limiting requests right now. Wait a minute and scan again.",
      }
    case "empty":
      return {
        title: "Nothing to scan",
        detail: "That repository has no files in it yet.",
      }
    case "too-large":
      return {
        title: "Too large to scan",
        detail:
          "This repository has more files than GitHub will list in one request, so GoodRepo cannot see all of it.",
      }
  }
}

async function scanAtSha(
  owner: string,
  repo: string,
  sha: string
): Promise<ScanResult> {
  "use cache: remote"
  cacheLife("max")

  const token = process.env.GITHUB_TOKEN

  const meta = await fetchRepoMeta(owner, repo, token)
  if (isFailure(meta)) return { ok: false, failure: meta }

  const tree = await fetchTree(owner, repo, sha, token)
  if (isFailure(tree)) return { ok: false, failure: tree }

  const rejection = classifyRepo(tree.entries)
  if (rejection) return { ok: false, failure: rejection }

  const configPaths = chooseConfigFiles(tree.entries)
  const samplePaths = token ? chooseSample(tree.entries) : []
  const wanted = [...configPaths, ...samplePaths]

  const texts = token
    ? await fetchBlobs(owner, repo, sha, wanted, token)
    : await fetchBlobsRest(owner, repo, sha, configPaths)

  const sampled = new Set(samplePaths.filter((path) => texts.has(path)))

  const profile = analyze(
    tree.entries,
    texts,
    sampled,
    { ...meta, commitSha: sha.slice(0, 7) },
    tree.truncated
      ? {
          cap: "tree" as const,
          detail: "GitHub truncated the file listing for this repository.",
        }
      : null
  )

  const { overall, categories } = scoreRepo(profile)
  return { ok: true, profile, overall, categories }
}

export async function runScan(
  owner: string,
  repo: string
): Promise<ScanResult> {
  const pinned = pinnedSha(owner, repo)
  if (pinned) return scanAtSha(owner, repo, pinned)

  const sha = await fetchHeadSha(owner, repo, "HEAD", process.env.GITHUB_TOKEN)
  if (isFailure(sha)) return { ok: false, failure: sha }

  return scanAtSha(owner, repo, sha)
}
