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
          "GoodRepo only scans JavaScript and TypeScript projects for now. This one has no package.json in its top folder. Other languages are coming.",
      }
    case "not-found":
      return {
        title: "Not reachable",
        detail:
          "That repository or commit does not exist, or GoodRepo cannot see it. To scan a private repository, sign in with GitHub and give the GoodRepo app access to it.",
      }
    case "rate-limited":
      return {
        title: "Try again shortly",
        detail:
          "GitHub is asking us to slow down. Wait a minute and scan again.",
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
          "This repository has too many files for GitHub to list at once, so GoodRepo cannot see all of it.",
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
  sha: string,
  token: string | undefined
): Promise<ScanResult> {
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

// Reads the token inside rather than taking it as an argument, which would put it in the
// cache key and make a rotated token miss every entry.
function measurePublic(
  owner: string,
  repo: string,
  sha: string
): Promise<ScanResult> {
  return measure(owner, repo, sha, process.env.GITHUB_TOKEN)
}

const cachedMeasure = cachedByCommit("scan", "v4", measurePublic)

async function settle(run: Promise<ScanResult>): Promise<ScanResult> {
  try {
    return await run
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

export async function scanAtSha(
  owner: string,
  repo: string,
  sha: string
): Promise<ScanResult> {
  return settle(cachedMeasure(owner, repo, sha))
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

export function shaQuery(sha: string | null | undefined): string {
  return sha ? `?sha=${sha}` : ""
}

export async function resolveSha(
  owner: string,
  repo: string,
  ref: string | null,
  token: string | undefined = process.env.GITHUB_TOKEN
): Promise<string | ScanFailure> {
  if (ref === "invalid")
    return { kind: "not-found", message: "That is not a commit sha." }
  if (ref !== null && FULL_SHA.test(ref)) return ref

  return fetchHeadSha(owner, repo, ref ?? "HEAD", token)
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

export async function runPrivateScan(
  owner: string,
  repo: string,
  token: string,
  ref: string | null = null
): Promise<ScanResult> {
  const sha = await resolveSha(owner, repo, ref, token)
  if (isFailure(sha)) return { ok: false, failure: sha }

  return settle(measure(owner, repo, sha, token))
}
