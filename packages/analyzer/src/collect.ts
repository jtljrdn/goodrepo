import { isCodeFile, isKeptFile, isTestFile } from "./skip"
import { CAPS } from "./thresholds"
import type { CodeFileFacts, RawFacts, TreeEntry } from "./types"

import { sourceFacts } from "./syntax"
import { workspaceOwner, workspacePaths } from "./workspaces"

export function extractImports(source: string): string[] {
  return sourceFacts(source).imports
}

// Stable across input order, without systematically preferring alphabetical prefixes.
function hash(path: string): number {
  let value = 2166136261
  for (const c of path) value = Math.imul(value ^ c.charCodeAt(0), 16777619)
  return value >>> 0
}

function dirOf(path: string): string {
  const slash = path.lastIndexOf("/")
  return slash === -1 ? "" : path.slice(0, slash)
}

export function chooseSample(
  entries: TreeEntry[],
  limit: number = CAPS.importSample,
  workspaces: string[] = []
): string[] {
  const eligible = entries.filter(
    (e) => isCodeFile(e.path) && e.bytes > 0 && e.bytes <= CAPS.perFileBytes
  )
  if (limit <= 0) return []
  if (eligible.length <= limit) return eligible.map((e) => e.path).sort()
  const source = eligible.filter((e) => !isTestFile(e.path))
  if (source.length && source.length < eligible.length) {
    const chosen = chooseSample(source, limit, workspaces)
    return chosen.length === limit
      ? chosen
      : [
          ...chosen,
          ...chooseSample(
            eligible.filter((e) => isTestFile(e.path)),
            limit - chosen.length,
            workspaces
          ),
        ]
  }

  const byDir = new Map<string, string[]>()
  const roots = new Set(workspaces)
  for (const entry of [...eligible].sort((a, b) => {
    const test = Number(isTestFile(a.path)) - Number(isTestFile(b.path))
    return test !== 0
      ? test
      : hash(a.path) - hash(b.path) || a.path.localeCompare(b.path)
  })) {
    const workspace = workspaceOwner(entry.path, roots)
    const role = isTestFile(entry.path)
      ? "test"
      : /(^|\/)(route\.|api\/|controllers?\/)/.test(entry.path)
        ? "route"
        : /\.[jt]sx$/.test(entry.path)
          ? "ui"
          : "source"
    const dir = `${workspace}:${role}:${dirOf(entry.path)}`
    const bucket = byDir.get(dir)
    if (bucket) bucket.push(entry.path)
    else byDir.set(dir, [entry.path])
  }

  const groups = new Map<string, string[][]>()
  for (const [key, bucket] of byDir) {
    const group = key.split(":").slice(0, 2).join(":")
    const dirs = groups.get(group) ?? []
    dirs.push(bucket)
    groups.set(group, dirs)
  }
  const buckets: string[][] = []
  for (let round = 0; ; round++) {
    let placed = false
    for (const dirs of groups.values())
      if (dirs[round]) {
        buckets.push(dirs[round]!)
        placed = true
      }
    if (!placed) break
  }
  const chosen: string[] = []
  for (let round = 0; chosen.length < limit; round++) {
    let placed = false
    for (const bucket of buckets) {
      const path = bucket[round]
      if (path === undefined) continue
      chosen.push(path)
      placed = true
      if (chosen.length === limit) break
    }
    if (!placed) break
  }
  return chosen
}

export function chooseConfigFiles(
  entries: TreeEntry[],
  texts = new Map<string, string>(),
  limit: number = CAPS.configFiles
): string[] {
  const discovered = workspacePaths(entries, texts)
  const roots =
    limit === Infinity
      ? discovered
      : discovered.slice(0, CAPS.workspacePackages)
  const priority = (path: string) =>
    path === "package.json"
      ? 0
      : path === "pnpm-workspace.yaml"
        ? 1
        : !path.includes("/")
          ? 2
          : path.endsWith("/package.json")
            ? 3
            : 4
  return entries
    .filter(
      (e) =>
        (limit === Infinity ||
          (e.bytes >= 0 && e.bytes <= CAPS.perFileBytes)) &&
        isKeptFile(e.path)
    )
    .filter(
      (e) =>
        !e.path.includes("/") ||
        e.path.startsWith(".github/workflows/") ||
        e.path.startsWith(".devcontainer/") ||
        e.path.startsWith(".cursor/rules/") ||
        e.path === ".github/copilot-instructions.md" ||
        roots.some(
          (root) =>
            e.path.startsWith(`${root}/`) &&
            !e.path.slice(root.length + 1).includes("/")
        )
    )
    .sort(
      (a, b) =>
        priority(a.path) - priority(b.path) ||
        hash(a.path) - hash(b.path) ||
        a.path.localeCompare(b.path)
    )
    .map((e) => e.path)
    .slice(0, limit)
}

export function withinBudget(
  entries: TreeEntry[],
  paths: string[],
  budget: number
): string[] {
  const sizes = new Map(entries.map((e) => [e.path, e.bytes]))
  return [...new Set(paths)].filter((path) => {
    const size = sizes.get(path)
    if (size === undefined || size > budget) return false
    budget -= size
    return true
  })
}

export function collect(
  entries: TreeEntry[],
  texts: Map<string, string>,
  sampled: Set<string>,
  truncated: RawFacts["truncated"] = null
): RawFacts {
  const paths = entries.map((e) => e.path)
  const keptText = new Map<string, string>()
  const codeFiles: CodeFileFacts[] = []

  for (const entry of entries) {
    const text = texts.get(entry.path)
    if (text !== undefined && isKeptFile(entry.path))
      keptText.set(entry.path, text)

    if (isCodeFile(entry.path)) {
      codeFiles.push(
        sampled.has(entry.path) && text !== undefined
          ? {
              path: entry.path,
              bytes: entry.bytes,
              ...sourceFacts(text, entry.path),
            }
          : { path: entry.path, bytes: entry.bytes, imports: null }
      )
    }
  }

  const sampledCount = codeFiles.filter((f) => f.imports !== null).length

  return {
    paths,
    codeFiles,
    keptText,
    sample:
      sampledCount === 0
        ? null
        : { sampled: sampledCount, total: codeFiles.length },
    truncated,
  }
}
