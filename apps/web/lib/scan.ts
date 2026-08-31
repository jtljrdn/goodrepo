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
  | { ok: true; profile: RepoProfile; overall: number | null; categories: ScoredCategory[] }
  | { ok: false; failure: ScanFailure }

export function failureMessage(failure: ScanFailure): { title: string; detail: string } {
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
        detail: "GitHub is rate limiting requests right now. Wait a minute and scan again.",
      }
    case "empty":
      return { title: "Nothing to scan", detail: "That repository has no files in it yet." }
    case "too-large":
      return {
        title: "Too large to scan",
        detail:
          "This repository has more files than GitHub will list in one request, so GoodRepo cannot see all of it.",
      }
  }
}

/**
 * The scan never downloads the repository. It reads the file tree once, which
 * carries every path and every file's byte size, then fetches only the config
 * and doc files plus a bounded sample of code files for their imports.
 *
 * vercel/next.js costs roughly 3 MB this way against 48 MB as a tarball.
 *
 * Everything below the commit SHA is cached against it. A SHA names an immutable
 * snapshot, so a hit can never be stale: the same commit always scans to the
 * same result. Ten people opening the same report cost one scan.
 *
 * The cache is remote, not in-memory. Plain "use cache" does not persist across
 * server instances or restarts, so on serverless each cold start would rescan.
 * A remote lookup costs a network roundtrip against a scan that costs seconds
 * and hundreds of GitHub requests against a 5,000/hour limit.
 */
async function scanAtSha(owner: string, repo: string, sha: string): Promise<ScanResult> {
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
  // Without a token the GraphQL API is unavailable, so we fetch only the config
  // files over REST and leave the import signals unmeasured rather than guessing.
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
      ? { cap: "tree" as const, detail: "GitHub truncated the file listing for this repository." }
      : null
  )

  const { overall, categories } = scoreRepo(profile)
  return { ok: true, profile, overall, categories }
}

export async function runScan(owner: string, repo: string): Promise<ScanResult> {
  // Home page examples are pinned, which both guarantees a cache hit and skips
  // this lookup. Everything else costs one request to learn the current commit.
  const pinned = pinnedSha(owner, repo)
  if (pinned) return scanAtSha(owner, repo, pinned)

  // "HEAD" resolves the default branch server-side, so this costs one request
  // rather than two. Everything after it is cached against the SHA it returns.
  const sha = await fetchHeadSha(owner, repo, "HEAD", process.env.GITHUB_TOKEN)
  if (isFailure(sha)) return { ok: false, failure: sha }

  return scanAtSha(owner, repo, sha)
}
