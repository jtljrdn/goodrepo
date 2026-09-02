import type { RawFacts } from "../types"

const LOCKFILES: Record<string, string> = {
  "bun.lock": "bun",
  "bun.lockb": "bun",
  "pnpm-lock.yaml": "pnpm",
  "package-lock.json": "npm",
  "yarn.lock": "yarn",
}

const RUNTIME_FILES = [
  ".nvmrc",
  ".node-version",
  ".tool-versions",
  "mise.toml",
  ".mise.toml",
]

export function readPackageJson(
  facts: RawFacts
): Record<string, unknown> | null {
  const text = facts.keptText.get("package.json")
  if (!text) return null
  try {
    const parsed: unknown = JSON.parse(text)
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

export function readScripts(
  pkg: Record<string, unknown> | null
): Record<string, string> {
  const raw = pkg?.scripts
  if (typeof raw !== "object" || raw === null) return {}
  const out: Record<string, string> = {}
  for (const [name, value] of Object.entries(raw)) {
    if (typeof value === "string") out[name] = value
  }
  return out
}

function hasScript(
  scripts: Record<string, string>,
  name: RegExp,
  fallback?: RegExp
): boolean {
  const entries = Object.entries(scripts)
  if (entries.some(([script]) => name.test(script))) return true
  if (!fallback) return false
  return entries.some(([, command]) => fallback.test(command))
}

export function detectManifest(facts: RawFacts) {
  const pkg = readPackageJson(facts)
  const scripts = readScripts(pkg)
  const rootNames = new Set(facts.paths.filter((p) => !p.includes("/")))

  const lockName = Object.keys(LOCKFILES).find((name) => rootNames.has(name))
  const pinned =
    typeof pkg?.packageManager === "string" ? pkg.packageManager : null
  const packageManager =
    pinned ?? (lockName ? (LOCKFILES[lockName] ?? null) : null)

  const engines = pkg?.engines
  const enginesNode =
    typeof engines === "object" &&
    engines !== null &&
    typeof (engines as Record<string, unknown>).node === "string"

  return {
    packageManager,
    scripts,
    has: {
      lockfile: Boolean(lockName) && pinned !== null,
      nodePinned:
        enginesNode ||
        RUNTIME_FILES.some((name) => rootNames.has(name)) ||
        typeof pkg?.volta === "object",
      buildScript: hasScript(scripts, /^build([:-]|$)/),
      lintScript: hasScript(scripts, /^lint([:-]|$)/),
      formatScript: hasScript(
        scripts,
        /^(format|fmt|prettier)([:-]|$)/,
        /\bprettier\b|\b(biome|dprint) (format|fmt)\b/
      ),
      typecheckScript: hasScript(
        scripts,
        /^((test|check|lint)[:-])?(typecheck|type-check|typescript|types?|tsc)$/,
        /\b(vue-)?tsc\s+(-p\s+\S+\s+)?--noEmit/
      ),
    },
  }
}
