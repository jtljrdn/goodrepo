import { GENERATED_DIRS, isTestFile } from "../skip"
import { passes, THRESHOLDS } from "../thresholds"
import type { Measurement, RawFacts, SignalId } from "../types"

const TYPE_NAMES = new Set([
  "components", "hooks", "utils", "helpers", "common", "misc", "shared",
  "lib", "types", "services", "models", "controllers", "constants", "styles",
])

const SOURCE_ROOTS = ["src", "app", "lib", "apps", "packages"]

function measure(key: keyof typeof THRESHOLDS, value: number): Measurement {
  return { value, threshold: THRESHOLDS[key].threshold, unit: THRESHOLDS[key].unit }
}

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
  return base.replace(/\.(test|spec)\.[cm]?[jt]sx?$/, "").replace(/\.[cm]?[jt]sx?$/, "")
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

export function detectStructure(facts: RawFacts) {
  const codePaths = facts.codeFiles.map((f) => f.path)
  const measurements: Partial<Record<SignalId, Measurement>> = {}

  const counts = new Map<string, number>()
  for (const path of codePaths) {
    const top = topLevel(path)
    if (top) counts.set(top, (counts.get(top) ?? 0) + 1)
  }
  const largestRoot = Math.max(0, ...counts.values())
  const rootShare = codePaths.length > 0 ? largestRoot / codePaths.length : 0
  measurements.predictableRoot = measure("rootConcentration", rootShare)

  const maxDepth = Math.max(0, ...facts.paths.map((p) => p.split("/").length))
  measurements.shallowTree = measure("maxDepth", maxDepth)

  const testPaths = facts.paths.filter(isTestFile)
  const sourceKeys = new Set(
    codePaths.filter((p) => !isTestFile(p)).map((p) => `${dirOf(p)}::${stem(p)}`)
  )
  const colocated = testPaths.filter((testPath) => {
    const dir = dirOf(testPath)
    const parent = dirOf(dir)
    const name = stem(testPath)
    return sourceKeys.has(`${dir}::${name}`) || sourceKeys.has(`${parent}::${name}`)
  }).length
  const colocationShare = testPaths.length > 0 ? colocated / testPaths.length : 0
  measurements.colocatedTests = measure("testColocation", colocationShare)

  const root = primarySourceRoot(codePaths)
  const children = new Set<string>()
  for (const path of codePaths) {
    if (!root || !path.startsWith(`${root}/`)) continue
    const rest = path.slice(root.length + 1)
    const slash = rest.indexOf("/")
    if (slash > 0) children.add(rest.slice(0, slash))
  }
  const typeNamed = [...children].filter((name) => TYPE_NAMES.has(name)).length
  const typeShare = children.size > 0 ? typeNamed / children.size : 0
  measurements.featureFolders = measure("typeNamedFolders", typeShare)

  return {
    maxDirectoryDepth: maxDepth,
    directories: new Set(facts.paths.map(dirOf).filter(Boolean)).size,
    measurements,
    has: {
      predictableRoot: codePaths.length > 0 && passes("rootConcentration", rootShare),
      shallowTree: passes("maxDepth", maxDepth),
      colocatedTests: testPaths.length > 0 && passes("testColocation", colocationShare),
      generatedExcluded: !facts.paths.some((p) =>
        GENERATED_DIRS.some((dir) => p === dir || p.startsWith(`${dir}/`) || p.includes(`/${dir}/`))
      ),
      featureFolders: children.size > 0 && passes("typeNamedFolders", typeShare),
    },
  }
}
