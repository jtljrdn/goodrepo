import { collect } from "./collect"
import { detectDocs } from "./detect/docs"
import { detectImports } from "./detect/imports"
import { detectManifest } from "./detect/manifest"
import { detectMetrics } from "./detect/metrics"
import { detectStructure } from "./detect/structure"
import { detectTests } from "./detect/tests"
import { detectTooling } from "./detect/tooling"
import type {
  Measurement,
  RawFacts,
  RepoMeta,
  RepoProfile,
  SignalId,
  TreeEntry,
} from "./types"

export * from "./types"
export { CAPS, passes, THRESHOLDS } from "./thresholds"
export { isCodeFile, isDocFile, isKeptFile, isTestFile } from "./skip"
export { CheckoutError, parseLsTree, withCheckout } from "./sandbox"
export { buildDocPrompt, docPaths, extractClaims } from "./deep/claims"
export type { Claim, ClaimSet } from "./deep/claims"
export { deepReview, shouldLand } from "./deep/review"
export {
  AGENT_SIGNALS,
  repoBrief,
  resolveSignals,
  unresolvedSignals,
} from "./deep/signals"
export { applyVerdicts, deepScan } from "./deep/scan"
export type { DeepScan } from "./deep/scan"
export type { SignalResolution, SignalVerdict } from "./deep/signals"
export type { DeepFinding, DeepReview } from "./deep/review"
export {
  checkFinding,
  directoriesOf,
  normalize,
  verifyFindings,
} from "./deep/verify"
export type { RejectedFinding, Verification } from "./deep/verify"
export type { Checkout, CheckoutTarget } from "./sandbox"
export { chooseConfigFiles, chooseSample } from "./collect"
export {
  classifyRepo,
  fetchBlobs,
  fetchBlobsRest,
  fetchHeadSha,
  fetchRepoMeta,
  fetchTree,
  isFailure,
} from "./source/github"
export type { RepoTree, ScanFailure } from "./source/github"

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
        if (typeof group === "object" && group !== null)
          deps.push(...Object.keys(group))
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

export function analyze(
  entries: TreeEntry[],
  texts: Map<string, string>,
  sampled: Set<string>,
  meta: RepoMeta,
  truncated: RepoProfile["truncated"] = null
): RepoProfile {
  const facts = collect(entries, texts, sampled, truncated)

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
    totalBytes: metrics.totalBytes,
    medianFileBytes: metrics.medianFileBytes,
    largestFileBytes: metrics.largestFileBytes,
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
    sample: facts.sample,
    truncated: facts.truncated,
  }
}
