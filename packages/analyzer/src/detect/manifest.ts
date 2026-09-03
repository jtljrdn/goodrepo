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

const CONVENTIONAL_WORKSPACE_ROOTS = ["apps", "packages", "libs", "services"]

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

export function readDependencies(
  pkg: Record<string, unknown> | null
): string[] {
  if (!pkg) return []
  const names = new Set<string>()
  for (const group of ["dependencies", "devDependencies", "peerDependencies"]) {
    const deps = pkg[group]
    if (typeof deps !== "object" || deps === null) continue
    for (const name of Object.keys(deps)) names.add(name)
  }
  return [...names]
}

function readWorkspaceRoots(
  pkg: Record<string, unknown> | null,
  facts: RawFacts
): string[] {
  const raw = pkg?.workspaces
  const globs = Array.isArray(raw)
    ? raw
    : typeof raw === "object" && raw !== null
      ? (raw as Record<string, unknown>).packages
      : null
  if (Array.isArray(globs)) {
    const roots = new Set<string>()
    for (const glob of globs) {
      if (typeof glob !== "string") continue
      const root = glob.split("/")[0] ?? ""
      if (root && !root.includes("*")) roots.add(root)
    }
    return [...roots]
  }
  if (!facts.paths.includes("pnpm-workspace.yaml")) return []
  const topLevel = new Set(facts.paths.map((p) => p.split("/")[0] ?? ""))
  return CONVENTIONAL_WORKSPACE_ROOTS.filter((name) => topLevel.has(name))
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
  const deps = readDependencies(pkg)
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

  const tsFiles = facts.codeFiles.filter((f) =>
    /\.[cm]?tsx?$/.test(f.path)
  ).length
  const typescript =
    rootNames.has("tsconfig.json") ||
    deps.includes("typescript") ||
    (facts.codeFiles.length > 0 && tsFiles / facts.codeFiles.length >= 0.5)

  // A publishable package with an entry point is a library; apps are private.
  const library =
    pkg !== null &&
    pkg.private !== true &&
    (typeof pkg.main === "string" ||
      typeof pkg.module === "string" ||
      pkg.exports !== undefined)

  return {
    packageManager,
    scripts,
    dependencies: deps,
    language: typescript ? "TypeScript" : "JavaScript",
    library,
    workspaceRoots: readWorkspaceRoots(pkg, facts),
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
      typecheckScript: typescript
        ? hasScript(
            scripts,
            /^((test|check|lint)[:-])?(typecheck|type-check|typescript|types?|tsc)$/,
            /\b(vue-)?tsc\s+(-p\s+\S+\s+)?--noEmit/
          )
        : null,
    },
  }
}
