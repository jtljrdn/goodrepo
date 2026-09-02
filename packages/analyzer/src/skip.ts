import { CAPS } from "./thresholds"

// "build" and "out" are omitted on purpose: both are commonly source directories.
export const GENERATED_DIRS = [
  "dist",
  ".next",
  "coverage",
  ".turbo",
  ".output",
  ".svelte-kit",
] as const

const SKIP_DIRS = new Set<string>([
  ...GENERATED_DIRS,
  "node_modules",
  ".git",
  "vendor",
  "target",
  "__pycache__",
])

const CODE_EXT = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts",
])

const LOCKFILES = new Set([
  "bun.lock",
  "bun.lockb",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
])

const KEPT_FILES = new Set([
  "package.json",
  "tsconfig.json",
  "readme.md",
  "agents.md",
  "claude.md",
  "contributing.md",
  ".env.example",
  ".env.sample",
  ".env.template",
  "dockerfile",
  "compose.yaml",
  "compose.yml",
  "docker-compose.yml",
  ".nvmrc",
  ".node-version",
])

const KEPT_PREFIXES = [".github/workflows/", ".devcontainer/", ".cursor/rules"]

const KEPT_PATTERNS = [
  /^(vitest|jest|playwright)\.config\.[cm]?[jt]s$/,
  /^(eslint|biome|oxlint)\.config\.[cm]?[jt]s$/,
  /^\.eslintrc(\.[a-z]+)?$/,
  /^\.prettierrc(\.[a-z]+)?$/,
  /^biome\.jsonc?$/,
  /^turbo\.json$/,
]

function base(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1).toLowerCase()
}

function ext(path: string): string {
  const b = base(path)
  const i = b.lastIndexOf(".")
  return i === -1 ? "" : b.slice(i)
}

export function isSkippedPath(path: string): boolean {
  return path.split("/").some((seg) => SKIP_DIRS.has(seg))
}

export function isCodeFile(path: string): boolean {
  if (isSkippedPath(path)) return false
  if (base(path).endsWith(".min.js")) return false
  if (path.includes(".d.ts")) return false
  return CODE_EXT.has(ext(path))
}

export function isDocFile(path: string): boolean {
  if (isSkippedPath(path)) return false
  const name = base(path)
  return name.endsWith(".md") && KEPT_FILES.has(name)
}

export function isTestFile(path: string): boolean {
  if (!CODE_EXT.has(ext(path))) return false
  if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(base(path))) return true
  return path.split("/").some((seg) => seg === "__tests__" || seg === "tests")
}

export function isKeptFile(path: string): boolean {
  const b = base(path)
  if (KEPT_FILES.has(b)) return true
  if (KEPT_PREFIXES.some((p) => path.startsWith(p))) return true
  return KEPT_PATTERNS.some((re) => re.test(b))
}

export function shouldReadContents(path: string, size: number): boolean {
  if (isKeptFile(path) && size <= CAPS.perFileBytes) return true
  if (isSkippedPath(path)) return false
  if (LOCKFILES.has(base(path))) return false
  if (size > CAPS.perFileBytes) return false
  return isCodeFile(path)
}
