import { GENERATED_DIRS, isCodeFile, isTestFile } from "../skip"
import { measure, passes } from "../thresholds"
import type { Measurement, RawFacts, SignalId } from "../types"

const TYPE_NAMES = new Set([
  "components",
  "hooks",
  "utils",
  "helpers",
  "common",
  "misc",
  "shared",
  "lib",
  "types",
  "services",
  "models",
  "controllers",
  "constants",
  "styles",
])

// Top-level folders an agent can guess without listing the tree.
const PREDICTABLE_ROOTS = new Set([
  "src",
  "app",
  "pages",
  "components",
  "lib",
  "hooks",
  "utils",
  "server",
  "api",
  "routes",
  "styles",
  "types",
  "test",
  "tests",
  "__tests__",
  "e2e",
  "scripts",
  "bin",
])

const SOURCE_ROOTS = ["src", "app", "lib", "apps", "packages"]

function topLevel(path: string): string {
  const slash = path.indexOf("/")
  return slash === -1 ? "" : path.slice(0, slash)
}

function dirOf(path: string): string {
  const slash = path.lastIndexOf("/")
  return slash === -1 ? "" : path.slice(0, slash)
}

function stem(path: string): string {
  const base = path.slice(path.lastIndexOf("/") + 1)
  return base
    .replace(/\.(test|spec)\.[cm]?[jt]sx?$/, "")
    .replace(/\.[cm]?[jt]sx?$/, "")
}

function percentile(values: number[], share: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.max(0, Math.ceil(share * sorted.length) - 1)
  return sorted[index] ?? 0
}

function primarySourceRoot(codePaths: string[]): string {
  const counts = new Map<string, number>()
  for (const path of codePaths) {
    const top = topLevel(path)
    if (top) counts.set(top, (counts.get(top) ?? 0) + 1)
  }
  const preferred = SOURCE_ROOTS.find((name) => counts.has(name))
  if (preferred) return preferred
  let best = ""
  let bestCount = 0
  for (const [name, count] of counts) {
    if (count > bestCount) {
      best = name
      bestCount = count
    }
  }
  return best
}

export function detectStructure(facts: RawFacts, workspaceRoots: string[]) {
  const codePaths = facts.codeFiles
    .filter((f) => isCodeFile(f.path))
    .map((f) => f.path)
  const measurements: Partial<Record<SignalId, Measurement>> = {}

  const nested = codePaths.filter((p) => p.includes("/"))
  const predictable = nested.filter((p) => {
    const top = topLevel(p)
    return PREDICTABLE_ROOTS.has(top) || workspaceRoots.includes(top)
  }).length
  const rootShare = nested.length > 0 ? predictable / nested.length : 1
  measurements.predictableRoot = measure("rootConcentration", rootShare)

  // ponytail: p90 rather than max, so one deep fixture folder cannot fail a repo
  const depth = percentile(
    codePaths.map((p) => p.split("/").length),
    0.9
  )
  measurements.shallowTree = measure("maxDepth", depth)

  const testPaths = facts.paths.filter(isTestFile)
  const sourceKeys = new Set(
    codePaths
      .filter((p) => !isTestFile(p))
      .map((p) => `${dirOf(p)}::${stem(p)}`)
  )
  const colocated = testPaths.filter((testPath) => {
    const dir = dirOf(testPath)
    const parent = dirOf(dir)
    const name = stem(testPath)
    return (
      sourceKeys.has(`${dir}::${name}`) || sourceKeys.has(`${parent}::${name}`)
    )
  }).length
  const colocationShare =
    testPaths.length > 0 ? colocated / testPaths.length : 0
  measurements.colocatedTests = measure("testColocation", colocationShare)

  const packageRoots = facts.paths
    .filter(
      (p) => p.endsWith("/package.json") && workspaceRoots.includes(topLevel(p))
    )
    .map(dirOf)
  const groups = packageRoots.length
    ? packageRoots.map((root) =>
        codePaths
          .filter((p) => p.startsWith(`${root}/`))
          .map((p) => p.slice(root.length + 1))
      )
    : [codePaths]
  const shares: number[] = []
  for (const paths of groups) {
    const root = primarySourceRoot(paths)
    const children = new Set<string>()
    for (const path of paths) {
      if (!root || !path.startsWith(`${root}/`)) continue
      const rest = path.slice(root.length + 1)
      const slash = rest.indexOf("/")
      if (slash > 0) children.add(rest.slice(0, slash))
    }
    if (children.size)
      shares.push(
        [...children].filter((name) => TYPE_NAMES.has(name)).length /
          children.size
      )
  }
  const typeShare = shares.length ? Math.max(...shares) : 0
  measurements.featureFolders = measure("typeNamedFolders", typeShare)

  return {
    maxDirectoryDepth: facts.paths.reduce(
      (max, p) => Math.max(max, p.split("/").length),
      0
    ),
    directories: new Set(facts.paths.map(dirOf).filter(Boolean)).size,
    measurements,
    has: {
      predictableRoot:
        codePaths.length > 0 ? passes("rootConcentration", rootShare) : null,
      shallowTree: facts.paths.length > 0 ? passes("maxDepth", depth) : null,
      colocatedTests:
        testPaths.length > 0 ? passes("testColocation", colocationShare) : null,
      generatedExcluded: !facts.paths.some((p) =>
        GENERATED_DIRS.some(
          (dir) =>
            p === dir || p.startsWith(`${dir}/`) || p.includes(`/${dir}/`)
        )
      ),
      featureFolders:
        shares.length > 0 ? passes("typeNamedFolders", typeShare) : null,
    },
  }
}
