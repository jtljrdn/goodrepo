import { posix } from "node:path"
import { parse as parseYaml } from "yaml"
import { isSkippedPath } from "./skip"
import type { RawFacts, TreeEntry } from "./types"

export function jsonObject(
  text: string | undefined
): Record<string, unknown> | null {
  if (!text) return null
  try {
    const value: unknown = JSON.parse(text)
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

function matches(path: string, pattern: string): boolean {
  const escaped = pattern
    .replace(/^\.\//, "")
    .replace(/\/$/, "")
    .split("/")
    .map((part) =>
      part === "**"
        ? ".*"
        : part
            .split("*")
            .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
            .join("[^/]*")
    )
    .join("/")
  return new RegExp(`^${escaped}$`).test(path)
}

export function workspacePaths(
  entries: TreeEntry[],
  texts: Map<string, string>
): string[] {
  const pkg = jsonObject(texts.get("package.json"))
  const workspaces = pkg?.workspaces
  let patterns: unknown = Array.isArray(workspaces)
    ? workspaces
    : workspaces && typeof workspaces === "object"
      ? (workspaces as Record<string, unknown>).packages
      : []
  if (texts.has("pnpm-workspace.yaml")) {
    try {
      patterns =
        parseYaml(texts.get("pnpm-workspace.yaml")!, { maxAliasCount: 0 })
          ?.packages ?? patterns
    } catch {
      /* Invalid config supplies no additional workspace claims. */
    }
  }
  if (!Array.isArray(patterns)) return []
  const globs = patterns.filter((p): p is string => typeof p === "string")
  return entries
    .filter((e) => e.path.endsWith("/package.json") && !isSkippedPath(e.path))
    .map((e) => posix.dirname(e.path))
    .filter(
      (path) =>
        globs.some((g) => !g.startsWith("!") && matches(path, g)) &&
        !globs.some((g) => g.startsWith("!") && matches(path, g.slice(1)))
    )
    .sort()
}

export function workspaceOwner(
  path: string,
  roots: ReadonlySet<string>
): string {
  let dir = posix.dirname(path)
  while (dir !== "." && dir !== "/") {
    if (roots.has(dir)) return dir
    dir = posix.dirname(dir)
  }
  return ""
}

export function scopeFacts(
  facts: RawFacts,
  root: string,
  roots: string[]
): RawFacts {
  const prefix = root ? `${root}/` : ""
  const known = new Set(roots)
  const belongs = (path: string) => workspaceOwner(path, known) === root
  const paths = facts.paths.filter(belongs).map((p) => p.slice(prefix.length))
  const codeFiles = facts.codeFiles
    .filter((f) => belongs(f.path))
    .map((f) => ({ ...f, path: f.path.slice(prefix.length) }))
  const keptText = new Map(
    [...facts.keptText]
      .filter(([p]) => belongs(p))
      .map(([p, t]) => [p.slice(prefix.length), t])
  )
  // Repository instructions apply to every package; package instructions supplement them.
  if (root)
    for (const [path, text] of facts.keptText) {
      if (/^(readme|agents|claude|contributing)\.md$/i.test(path)) {
        const local =
          [...keptText.keys()].find(
            (p) => p.toLowerCase() === path.toLowerCase()
          ) ?? path
        keptText.set(local, `${text}\n${keptText.get(local) ?? ""}`)
      }
    }
  return {
    paths,
    codeFiles,
    keptText,
    sample: codeFiles.some((f) => f.imports !== null)
      ? {
          sampled: codeFiles.filter((f) => f.imports !== null).length,
          total: codeFiles.length,
        }
      : null,
    truncated: facts.truncated,
  }
}
