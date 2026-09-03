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
import { cachedByCommit, isTransient, TRANSIENT } from "@/lib/cache"
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
          "That repository or commit is private or does not exist. GoodRepo only scans public repositories.",
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

function reject(failure: ScanFailure): ScanResult {
  if (failure.kind === "rate-limited") throw new Error(TRANSIENT)
  return { ok: false, failure }
}

async function measure(
  owner: string,
  repo: string,
  sha: string
): Promise<ScanResult> {
  const token = process.env.GITHUB_TOKEN

  const meta = await fetchRepoMeta(owner, repo, token)
  if (isFailure(meta)) return reject(meta)

  const tree = await fetchTree(owner, repo, sha, token)
  if (isFailure(tree)) return reject(tree)

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

const cachedMeasure = cachedByCommit("scan", "v3", measure)

export async function scanAtSha(
  owner: string,
  repo: string,
  sha: string
): Promise<ScanResult> {
  try {
    return await cachedMeasure(owner, repo, sha)
  } catch (error) {
    if (isTransient(error)) {
      return {
        ok: false,
        failure: {
          kind: "rate-limited",
          message: "GitHub rate limit reached. Try again shortly.",
        },
      }
    }
    throw error
  }
}

const FULL_SHA = /^[0-9a-f]{40}$/
const SHA_PREFIX = /^[0-9a-f]{7,40}$/i

// The ref is interpolated into a GitHub URL, so only a hex commit prefix gets through.
export function readSha(value: string | string[] | undefined): string | null {
  if (value === undefined) return null
  return typeof value === "string" && SHA_PREFIX.test(value)
    ? value.toLowerCase()
    : "invalid"
}

export async function resolveSha(
  owner: string,
  repo: string,
  ref: string | null
): Promise<string | ScanFailure> {
  if (ref === "invalid")
    return { kind: "not-found", message: "That is not a commit sha." }
  if (ref !== null && FULL_SHA.test(ref)) return ref

  return fetchHeadSha(owner, repo, ref ?? "HEAD", process.env.GITHUB_TOKEN)
}

export async function runScan(
  owner: string,
  repo: string,
  ref: string | null = null
): Promise<ScanResult> {
  const sha = await resolveSha(owner, repo, ref)
  if (isFailure(sha)) return { ok: false, failure: sha }

  return scanAtSha(owner, repo, sha)
}
