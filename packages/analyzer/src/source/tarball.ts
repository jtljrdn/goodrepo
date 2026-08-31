import { shouldReadContents } from "../skip"
import { readTar } from "../tar"
import { CAPS } from "../thresholds"
import type { FileEntry, RawFacts, RepoMeta } from "../types"

export type ScanFailure = {
  kind: "not-js" | "not-found" | "rate-limited" | "empty"
  message: string
}

export function stripArchivePrefix(path: string): string {
  const slash = path.indexOf("/")
  return slash === -1 ? "" : path.slice(slash + 1)
}

export function classifyRepo(rootEntries: string[]): ScanFailure | null {
  if (rootEntries.length === 0) {
    return { kind: "empty", message: "This repository is empty, so there is nothing to analyze." }
  }
  if (!rootEntries.includes("package.json")) {
    return {
      kind: "not-js",
      message:
        "GoodRepo currently analyzes JavaScript and TypeScript repositories. This repository has no package.json at its root.",
    }
  }
  return null
}

const API = "https://api.github.com"

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
  if (status === 403 && remaining === "0") {
    return { kind: "rate-limited", message: "GitHub rate limit reached. Try again shortly." }
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

export async function fetchRootEntries(
  owner: string,
  repo: string,
  token?: string
): Promise<string[] | ScanFailure> {
  const res = await fetch(`${API}/repos/${owner}/${repo}/contents/`, { headers: headers(token) })
  if (res.status === 404) return []
  const failure = failureFor(res.status, res.headers.get("x-ratelimit-remaining"))
  if (failure) return failure
  if (!res.ok) return { kind: "not-found", message: "Could not list that repository." }

  const body: unknown = await res.json()
  if (!Array.isArray(body)) return []
  return body
    .map((item) =>
      typeof item === "object" && item !== null ? (item as Record<string, unknown>).name : null
    )
    .filter((name): name is string => typeof name === "string")
}

export type TarballSource = {
  source: AsyncIterable<FileEntry>
  sha: () => string
  truncation: () => RawFacts["truncated"]
}

const PAX_SHA = /comment=([0-9a-f]{40})/

export function tarballSource(owner: string, repo: string, token?: string): TarballSource {
  let sha = ""
  let truncated: RawFacts["truncated"] = null

  async function* countedBytes(body: AsyncIterable<Uint8Array>): AsyncGenerator<Uint8Array> {
    let seen = 0
    for await (const chunk of body) {
      seen += chunk.length
      if (seen > CAPS.downloadBytes) {
        truncated = {
          cap: "download",
          detail: `Stopped after ${Math.round(CAPS.downloadBytes / 1024 / 1024)} MB of compressed archive.`,
        }
        return
      }
      yield chunk
    }
  }

  async function* entries(): AsyncGenerator<FileEntry> {
    const res = await fetch(`${API}/repos/${owner}/${repo}/tarball`, { headers: headers(token) })
    if (!res.ok || !res.body) throw new Error(`tarball fetch failed: ${res.status}`)

    const gunzipped = res.body.pipeThrough(new DecompressionStream("gzip"))
    const bytes = countedBytes(gunzipped as unknown as AsyncIterable<Uint8Array>)
    const decoder = new TextDecoder()
    let filesRead = 0

    for await (const item of readTar(bytes, (rawPath, size) => {
      if (filesRead >= CAPS.filesRead) return false
      return shouldReadContents(stripArchivePrefix(rawPath), size)
    })) {
      if (item.kind === "paxGlobal") {
        const match = item.body ? PAX_SHA.exec(decoder.decode(item.body)) : null
        if (match?.[1]) sha = match[1]
        continue
      }

      const path = stripArchivePrefix(item.path)
      if (!path) continue

      if (item.body) {
        filesRead += 1
        if (filesRead === CAPS.filesRead) {
          truncated = {
            cap: "files",
            detail: `Stopped reading file contents after ${CAPS.filesRead.toLocaleString()} files.`,
          }
        }
      }

      yield { path, size: item.size, text: item.body ? decoder.decode(item.body) : null }
    }
  }

  return {
    source: { [Symbol.asyncIterator]: entries },
    sha: () => sha,
    truncation: () => truncated,
  }
}
