import type { RepoMeta, TreeEntry } from "../types"

export type ScanFailure = {
  kind: "not-js" | "not-found" | "rate-limited" | "empty" | "too-large"
  message: string
}

const API = "https://api.github.com"
const GRAPHQL = "https://api.github.com/graphql"

// One GraphQL document per batch. 100 aliases keeps the query well under
// GitHub's node limit while still collapsing a whole sample into one round trip.
const BATCH_SIZE = 100

function headers(token?: string): Record<string, string> {
  const base: Record<string, string> = {
    accept: "application/vnd.github+json",
    "user-agent": "goodrepo",
  }
  if (token) base.authorization = `Bearer ${token}`
  return base
}

function failureFor(status: number, remaining: string | null): ScanFailure | null {
  if (status === 404) {
    return { kind: "not-found", message: "That repository is private or does not exist." }
  }
  if ((status === 403 || status === 429) && remaining === "0") {
    return { kind: "rate-limited", message: "GitHub rate limit reached. Try again shortly." }
  }
  return null
}

export function isFailure(value: unknown): value is ScanFailure {
  return typeof value === "object" && value !== null && "kind" in value && "message" in value
}

/**
 * Reads the tree we already have rather than a separate /contents/ request.
 * The tree lists every path, so the root listing was always redundant.
 */
export function classifyRepo(entries: TreeEntry[]): ScanFailure | null {
  if (entries.length === 0) {
    return { kind: "empty", message: "This repository is empty, so there is nothing to analyze." }
  }
  if (!entries.some((e) => e.path === "package.json")) {
    return {
      kind: "not-js",
      message:
        "GoodRepo currently analyzes JavaScript and TypeScript repositories. This repository has no package.json at its root.",
    }
  }
  return null
}

export async function fetchRepoMeta(
  owner: string,
  repo: string,
  token?: string
): Promise<RepoMeta | ScanFailure> {
  const res = await fetch(`${API}/repos/${owner}/${repo}`, { headers: headers(token) })
  const failure = failureFor(res.status, res.headers.get("x-ratelimit-remaining"))
  if (failure) return failure
  if (!res.ok) return { kind: "not-found", message: "Could not reach that repository." }

  const body: unknown = await res.json()
  if (typeof body !== "object" || body === null) {
    return { kind: "not-found", message: "Could not read that repository." }
  }
  const data = body as Record<string, unknown>

  return {
    owner,
    repo,
    description: typeof data.description === "string" ? data.description : "",
    stars: typeof data.stargazers_count === "number" ? data.stargazers_count : 0,
    defaultBranch: typeof data.default_branch === "string" ? data.default_branch : "main",
    commitSha: "",
    commitMessage: "",
  }
}

export type RepoTree = {
  entries: TreeEntry[]
  sha: string
  truncated: boolean
}

export async function fetchTree(
  owner: string,
  repo: string,
  ref: string,
  token?: string
): Promise<RepoTree | ScanFailure> {
  const head = await fetch(`${API}/repos/${owner}/${repo}/commits/${ref}`, {
    headers: headers(token),
  })
  const headFailure = failureFor(head.status, head.headers.get("x-ratelimit-remaining"))
  if (headFailure) return headFailure
  if (!head.ok) return { kind: "not-found", message: "Could not read the default branch." }

  const headBody: unknown = await head.json()
  const sha =
    typeof headBody === "object" && headBody !== null &&
    typeof (headBody as Record<string, unknown>).sha === "string"
      ? ((headBody as Record<string, unknown>).sha as string)
      : ref

  const res = await fetch(`${API}/repos/${owner}/${repo}/git/trees/${sha}?recursive=1`, {
    headers: headers(token),
  })
  const failure = failureFor(res.status, res.headers.get("x-ratelimit-remaining"))
  if (failure) return failure
  if (!res.ok) return { kind: "not-found", message: "Could not read the repository tree." }

  const body: unknown = await res.json()
  if (typeof body !== "object" || body === null) {
    return { kind: "not-found", message: "Could not read the repository tree." }
  }
  const data = body as Record<string, unknown>
  const raw = Array.isArray(data.tree) ? data.tree : []

  const entries: TreeEntry[] = []
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue
    const node = item as Record<string, unknown>
    if (node.type !== "blob") continue
    if (typeof node.path !== "string") continue
    entries.push({ path: node.path, bytes: typeof node.size === "number" ? node.size : 0 })
  }

  if (entries.length === 0) {
    return { kind: "empty", message: "This repository has no files in it yet." }
  }

  return { entries, sha, truncated: data.truncated === true }
}

function buildQuery(owner: string, repo: string, sha: string, paths: string[]): string {
  const fields = paths
    .map((path, i) => `f${i}: object(expression: ${JSON.stringify(`${sha}:${path}`)}) {
      ... on Blob { text isBinary }
    }`)
    .join("\n")
  return `query { repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(repo)}) {
    ${fields}
  } }`
}

/**
 * Fetches many file bodies in one round trip. Missing or binary files come back
 * null rather than failing the batch, so callers can ask for files that may not
 * exist without checking first.
 */
export async function fetchBlobs(
  owner: string,
  repo: string,
  sha: string,
  paths: string[],
  token: string
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const batches: string[][] = []
  for (let start = 0; start < paths.length; start += BATCH_SIZE) {
    batches.push(paths.slice(start, start + BATCH_SIZE))
  }

  // Run the batches together. A GraphQL round trip is close to a second, so
  // three sequential batches dominated the whole scan.
  const responses = await Promise.all(
    batches.map(async (batch) => {
      const res = await fetch(GRAPHQL, {
        method: "POST",
        headers: { ...headers(token), "content-type": "application/json" },
        body: JSON.stringify({ query: buildQuery(owner, repo, sha, batch) }),
      })
      if (!res.ok) return null
      const body: unknown = await res.json()
      return { batch, body }
    })
  )

  for (const result of responses) {
    if (!result) continue
    const { batch, body } = result
    if (typeof body !== "object" || body === null) continue
    const data = (body as Record<string, unknown>).data
    if (typeof data !== "object" || data === null) continue
    const node = (data as Record<string, unknown>).repository
    if (typeof node !== "object" || node === null) continue

    const fields = node as Record<string, unknown>
    batch.forEach((path, i) => {
      const value = fields[`f${i}`]
      if (typeof value !== "object" || value === null) return
      const blob = value as Record<string, unknown>
      if (blob.isBinary === true) return
      if (typeof blob.text === "string") out.set(path, blob.text)
    })
  }

  return out
}

/** Unauthenticated fallback. One request per file, so callers keep the list short. */
export async function fetchBlobsRest(
  owner: string,
  repo: string,
  sha: string,
  paths: string[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const results = await Promise.all(
    paths.map(async (path) => {
      const res = await fetch(
        `${API}/repos/${owner}/${repo}/contents/${encodeURI(path)}?ref=${sha}`,
        { headers: { ...headers(), accept: "application/vnd.github.raw" } }
      )
      return res.ok ? ([path, await res.text()] as const) : null
    })
  )
  for (const result of results) if (result) out.set(result[0], result[1])
  return out
}
