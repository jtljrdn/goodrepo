import { posix } from "node:path"
import ts from "typescript"
import { jsonObject } from "./workspaces"
import type { RawFacts } from "./types"

// Resolve only repository-local configuration. Never load code or use the filesystem.
export type ImportResolver = (file: string, specifier: string) => string | null
export function importResolver(facts: RawFacts): ImportResolver {
  const paths = new Set(facts.paths)
  const workspaces = new Map<string, string>()
  for (const [path, text] of facts.keptText) {
    if (!/(^|\/)package\.json$/.test(path)) continue
    const name = jsonObject(text)?.name
    if (typeof name === "string") workspaces.set(name, posix.dirname(path))
  }
  function config(
    path: string,
    seen = new Set<string>()
  ): { base: string; aliases: Record<string, string[]> } {
    if (seen.has(path)) return { base: posix.dirname(path), aliases: {} }
    seen.add(path)
    const text = facts.keptText.get(path)
    if (!text) return { base: posix.dirname(path), aliases: {} }
    const parsed = ts.parseConfigFileTextToJson(path, text)
    if (parsed.error) return { base: posix.dirname(path), aliases: {} }
    const body = parsed.config
    const parent =
      typeof body?.extends === "string" && body.extends.startsWith(".")
        ? posix.normalize(posix.join(posix.dirname(path), body.extends))
        : null
    const inherited = parent
      ? config(parent.endsWith(".json") ? parent : `${parent}.json`, seen)
      : { base: posix.dirname(path), aliases: {} }
    const options = body?.compilerOptions
    const base =
      typeof options?.baseUrl === "string"
        ? posix.join(posix.dirname(path), options.baseUrl)
        : inherited.base
    const aliases = { ...inherited.aliases }
    if (options?.paths && typeof options.paths === "object")
      for (const [key, value] of Object.entries(options.paths)) {
        if (Array.isArray(value))
          aliases[key] = value
            .filter((v): v is string => typeof v === "string")
            .map((v) => posix.normalize(posix.join(base, v)))
      }
    return { base, aliases }
  }
  const configs = [...facts.keptText.keys()]
    .filter((p) => /(^|\/)(ts|js)config\.json$/.test(p))
    .map((p) => ({ dir: posix.dirname(p), ...config(p) }))
    .sort((a, b) => b.dir.length - a.dir.length)
  function existing(path: string): string | null {
    const normalized = posix.normalize(path)
    const candidates = [
      normalized,
      ...[".ts", ".tsx", ".js", ".jsx", ".mts", ".cts"].flatMap((ext) => [
        normalized + ext,
        `${normalized}/index${ext}`,
        normalized.replace(/\.[cm]?jsx?$/, ext),
      ]),
    ]
    return candidates.find((p) => paths.has(p)) ?? null
  }
  return (file: string, specifier: string): string | null => {
    if (specifier.startsWith("."))
      return (
        existing(posix.join(posix.dirname(file), specifier)) ??
        posix.normalize(posix.join(posix.dirname(file), specifier))
      )
    const selected = configs.find(
      (c) => c.dir === "." || file.startsWith(`${c.dir}/`)
    )
    for (const [key, targets] of Object.entries(selected?.aliases ?? {})) {
      const star = key.indexOf("*")
      const match =
        star < 0
          ? specifier === key
          : specifier.startsWith(key.slice(0, star)) &&
            specifier.endsWith(key.slice(star + 1))
      if (!match) continue
      const middle =
        star < 0
          ? ""
          : specifier.slice(
              star,
              key.length - star - 1 ? -(key.length - star - 1) : undefined
            )
      const expanded = targets.map((t) => t.replace("*", middle))
      return expanded.map(existing).find(Boolean) ?? expanded[0] ?? null
    }
    for (const [name, root] of workspaces)
      if (specifier === name || specifier.startsWith(`${name}/`))
        return `${root}/${specifier.slice(name.length + 1) || "index"}`
    if (selected) {
      const local = existing(posix.join(selected.base, specifier))
      if (local) return local
    }
    // Conventional aliases remain useful without a tsconfig, but share canonical paths.
    if (/^(@\/|~\/|\$lib\/|#)/.test(specifier))
      return posix.join(
        selected?.base ?? ".",
        specifier.replace(/^(@\/|~\/|\$lib\/|#)/, "")
      )
    return null
  }
}
