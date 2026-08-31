import { collect } from "./collect"
import { detectDocs } from "./detect/docs"
import { detectImports } from "./detect/imports"
import { detectManifest } from "./detect/manifest"
import { detectMetrics } from "./detect/metrics"
import { detectStructure } from "./detect/structure"
import { detectTests } from "./detect/tests"
import { detectTooling } from "./detect/tooling"
import type { FileSource, Measurement, RawFacts, RepoMeta, RepoProfile, SignalId } from "./types"

export * from "./types"
export { CAPS, passes, THRESHOLDS } from "./thresholds"
export { isCodeFile, isTestFile, shouldReadContents } from "./skip"
export { classifyRepo, fetchRepoMeta, fetchRootEntries, tarballSource } from "./source/tarball"
export type { ScanFailure } from "./source/tarball"

const FRAMEWORK_MARKERS: [string, RegExp][] = [
  ["nextjs", /^next$/],
  ["remix", /^@remix-run\//],
  ["astro", /^astro$/],
  ["nestjs", /^@nestjs\//],
  ["vite", /^vite$/],
  ["express", /^express$/],
]

function detectFramework(facts: RawFacts): string {
  const text = facts.keptText.get("package.json") ?? ""
  let deps: string[] = []
  try {
    const parsed: unknown = JSON.parse(text)
    if (typeof parsed === "object" && parsed !== null) {
      const pkg = parsed as Record<string, unknown>
      for (const key of ["dependencies", "devDependencies"]) {
        const group = pkg[key]
        if (typeof group === "object" && group !== null) deps.push(...Object.keys(group))
      }
    }
  } catch {
    deps = []
  }
  for (const [name, marker] of FRAMEWORK_MARKERS) {
    if (deps.some((dep) => marker.test(dep))) return name
  }
  return "unknown"
}

export async function analyze(
  source: FileSource,
  meta: RepoMeta,
  truncated: RepoProfile["truncated"] = null
): Promise<RepoProfile> {
  const facts = await collect(source)

  const manifest = detectManifest(facts)
  const tooling = detectTooling(facts)
  const docs = detectDocs(facts, manifest.packageManager)
  const tests = detectTests(facts)
  const structure = detectStructure(facts)
  const metrics = detectMetrics(facts)
  const imports = detectImports(facts)

  const has: Record<SignalId, boolean | null> = {
    ...manifest.has,
    ...tooling.has,
    ...docs.has,
    ...tests.has,
    ...structure.has,
    ...metrics.has,
    ...imports.has,
    consistentRouteShape: null,
    consistentErrors: null,
  }

  const measurements: Partial<Record<SignalId, Measurement>> = {
    ...structure.measurements,
    ...metrics.measurements,
    ...imports.measurements,
    readmeDepth: { value: docs.readmeWords, threshold: 300, unit: "words" },
  }

  return {
    ...meta,
    framework: detectFramework(facts),
    language: "TypeScript",
    files: facts.paths.length,
    directories: structure.directories,
    maxDirectoryDepth: structure.maxDirectoryDepth,
    linesOfCode: metrics.linesOfCode,
    medianFileLoc: metrics.medianFileLoc,
    largestFileLoc: metrics.largestFileLoc,
    packageManager: manifest.packageManager,
    scripts: manifest.scripts,
    testFramework: tests.testFramework,
    testFiles: tests.testFiles,
    apiRoutes: imports.apiRoutes,
    validationPatterns: imports.validationPatterns,
    docs: {
      readmeWords: docs.readmeWords,
      agentsMdWords: docs.agentsMdWords,
      sections: docs.sections,
    },
    has,
    measurements,
    truncated: truncated ?? facts.truncated,
  }
}
