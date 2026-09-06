import { collect, chooseConfigFiles } from "./collect"
import { detectDocs } from "./detect/docs"
import { detectImports } from "./detect/imports"
import { detectManifest } from "./detect/manifest"
import { detectMetrics } from "./detect/metrics"
import { detectStructure } from "./detect/structure"
import { detectTests } from "./detect/tests"
import { detectTooling } from "./detect/tooling"
import { readDependencies, readPackageJson } from "./detect/manifest"
import { workspacePaths, scopeFacts, jsonObject } from "./workspaces"
import { importResolver } from "./resolve-import"
import { isTestFile } from "./skip"
import { CAPS, measure } from "./thresholds"
import type {
  Measurement,
  RawFacts,
  RepoMeta,
  RepoProfile,
  SignalId,
  TreeEntry,
} from "./types"

export * from "./types"
export { workspacePaths } from "./workspaces"
export { CAPS, measure, passes, THRESHOLDS } from "./thresholds"
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
export { chooseConfigFiles, chooseSample, withinBudget } from "./collect"
export {
  ScanFetchError,
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
  const deps = readDependencies(readPackageJson(facts))
  for (const [name, marker] of FRAMEWORK_MARKERS) {
    if (deps.some((dep) => marker.test(dep))) return name
  }
  return "unknown"
}

function inspect(
  facts: RawFacts,
  repository = facts,
  prefix = "",
  resolve = importResolver(repository)
) {
  const manifest = detectManifest(facts)
  const tests = detectTests(facts)
  const imports = detectImports(facts, repository, prefix, resolve)
  const tooling = detectTooling(facts, manifest.library)
  const structure = detectStructure(facts, manifest.workspaceRoots)
  const metrics = detectMetrics(facts)
  const docs = detectDocs(facts, {
    packageManager: manifest.packageManager,
    tests: tests.testFiles > 0,
    testScript: tests.has.testScript,
    buildScript: manifest.has.buildScript,
    devScript: "dev" in manifest.scripts,
    database: imports.usesDatabase,
    api: imports.apiRoutes >= 2,
  })

  return { manifest, tests, imports, tooling, structure, metrics, docs }
}

function combine(values: (boolean | null)[]): boolean | null {
  const measured = values.filter((value) => value !== null)
  return measured.length ? measured.every(Boolean) : null
}

export function analyze(
  entries: TreeEntry[],
  texts: Map<string, string>,
  sampled: Set<string>,
  meta: RepoMeta,
  truncated: RepoProfile["truncated"] = null
): RepoProfile {
  const facts = collect(entries, texts, sampled, truncated)

  const resolve = importResolver(facts)
  const { manifest, tests, imports, tooling, structure, metrics, docs } =
    inspect(facts, facts, "", resolve)
  const roots = workspacePaths(entries, texts)
  const scopes = roots
    .slice(0, CAPS.workspacePackages)
    .map((root) => {
      const scoped = scopeFacts(facts, root, roots)
      return { root, facts: scoped, ...inspect(scoped, facts, root, resolve) }
    })
    .filter((scope) => scope.facts.codeFiles.length > 0)

  if (roots.length) {
    const rootFacts = scopeFacts(facts, "", roots)
    if (
      rootFacts.codeFiles.some(
        (f) => f.path.includes("/") && !isTestFile(f.path)
      )
    )
      scopes.push({
        root: "",
        facts: rootFacts,
        ...inspect(rootFacts, facts, "", resolve),
      })
  }

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
    readmeDepth: measure("readmeWords", docs.readmeWords),
  }

  const unmeasured: NonNullable<RepoProfile["unmeasured"]> = {}
  const unknown = (ids: SignalId[]) => {
    for (const id of ids) {
      has[id] = null
      unmeasured[id] = "not-inspected"
    }
  }
  if (scopes.length) {
    const perPackage = (
      pick: (scope: (typeof scopes)[number]) => boolean | null
    ) => combine(scopes.map(pick))
    for (const id of ["lintConfig", "envExample"] as const)
      if (has[id] !== true)
        has[id] = perPackage((scope) => scope.tooling.has[id])
    for (const id of [
      "buildScript",
      "lintScript",
      "formatScript",
      "typecheckScript",
    ] as const)
      if (has[id] !== true)
        has[id] = perPackage((scope) => scope.manifest.has[id])
    for (const id of ["testScript", "testConfig", "coverage"] as const)
      if (has[id] !== true)
        has[id] = combine(
          scopes
            .filter((scope) => scope.tests.testFiles > 0)
            .map((scope) => scope.tests.has[id])
        )
    for (const id of [
      "agentsMd",
      "docPackageManager",
      "docTestCommand",
      "docBuildCommand",
      "docArchitecture",
      "docDatabase",
      "docApiConventions",
      "docCodeStyle",
      "singleTestDocumented",
    ] as const)
      if (has[id] !== true) has[id] = perPackage((scope) => scope.docs.has[id])
    for (const id of [
      "singleValidationLib",
      "singleDataLayer",
      "lowFanout",
      "featureFolders",
    ] as const) {
      const values = scopes.map((scope) => ({
        has: {
          ...scope.imports.has,
          featureFolders: scope.structure.has.featureFolders,
        },
        measurements: {
          ...scope.imports.measurements,
          featureFolders: scope.structure.measurements.featureFolders,
        },
      }))
      has[id] = combine(values.map((value) => value.has[id]))
      const measured = values
        .filter((value) => value.has[id] !== null)
        .map((value) => value.measurements[id])
        .filter((m): m is Measurement => m !== undefined)
      measurements[id] = measured.sort((a, b) =>
        a.direction === "atLeast" ? a.value - b.value : b.value - a.value
      )[0]
    }
  }
  const allScopes = [
    {
      root: "",
      facts,
      manifest,
      tests,
      imports,
      tooling,
      structure,
      metrics,
      docs,
    },
    ...scopes,
  ]
  for (const scope of allScopes) {
    const scopeFacts = scope.facts
    if (
      scopeFacts.paths.includes("package.json") &&
      !jsonObject(scopeFacts.keptText.get("package.json"))
    )
      unknown([
        "lockfile",
        "nodePinned",
        "buildScript",
        "lintScript",
        "formatScript",
        "typecheckScript",
        "testScript",
        "testConfig",
        "ciRunsTests",
        "coverage",
        "docPackageManager",
        "docTestCommand",
        "docBuildCommand",
        "docDatabase",
      ])
    if (
      scopeFacts.paths.some(
        (p) =>
          /^(readme|agents|claude|contributing)\.md$/i.test(p) &&
          !facts.keptText.has(scope.root ? `${scope.root}/${p}` : p)
      )
    )
      unknown([
        "readme",
        "readmeDepth",
        "agentsMd",
        "docPackageManager",
        "docTestCommand",
        "docBuildCommand",
        "docArchitecture",
        "docDatabase",
        "docApiConventions",
        "docCodeStyle",
        "singleTestDocumented",
      ])
  }
  if (
    facts.paths.some(
      (p) =>
        p.startsWith(".github/workflows/") &&
        /\.ya?ml$/.test(p) &&
        !facts.keptText.has(p)
    )
  )
    unknown(["ciRunsTests"])
  if (
    facts.codeFiles.some((f) => !isTestFile(f.path)) &&
    !facts.codeFiles.some((f) => !isTestFile(f.path) && f.imports !== null)
  )
    unknown(["lowFanout", "singleValidationLib"])
  for (const scope of scopes) {
    if (
      scope.facts.codeFiles.some((f) => !isTestFile(f.path)) &&
      !scope.facts.codeFiles.some(
        (f) => !isTestFile(f.path) && f.imports !== null
      )
    )
      unknown(["lowFanout", "singleValidationLib"])
  }
  if (
    facts.paths.some(
      (p) =>
        /(^|\/)(ts|js)config(\.[\w-]+)?\.json$/.test(p) &&
        !facts.keptText.has(p)
    )
  )
    unknown(["lowFanout"])
  if (
    facts.paths.some(
      (p) =>
        /(^|\/)(vitest|jest|playwright)\.config\.[cm]?[jt]s$/.test(p) &&
        !facts.keptText.has(p)
    ) &&
    has.coverage !== true
  )
    unknown(["coverage"])
  if (
    has.ciRunsTests === null &&
    facts.paths.some((p) => p.startsWith(".github/workflows/"))
  )
    unknown(["ciRunsTests"])
  if (
    has.singleDataLayer === null &&
    (facts.sample?.sampled ?? 0) < facts.codeFiles.length
  )
    unknown(["singleDataLayer"])
  if (
    has.singleValidationLib === null &&
    (facts.sample?.sampled ?? 0) <
      facts.codeFiles.filter((f) => !isTestFile(f.path)).length
  )
    unknown(["singleValidationLib"])
  if (
    has.envExample === null &&
    (facts.sample?.sampled ?? 0) < facts.codeFiles.length
  )
    unknown(["envExample"])
  if (roots.length > CAPS.workspacePackages)
    unknown([
      "testConfig",
      "coverage",
      "singleValidationLib",
      "singleDataLayer",
      "lowFanout",
      "featureFolders",
      "docDatabase",
      "docApiConventions",
    ])
  const configs = chooseConfigFiles(entries, texts, Infinity)

  return {
    ...meta,
    framework:
      [
        ...new Set(
          [facts, ...scopes.map((s) => s.facts)]
            .map(detectFramework)
            .filter((name) => name !== "unknown")
        ),
      ].join(", ") || "unknown",
    unmeasured,
    configCoverage: {
      read: configs.filter((path) => texts.has(path)).length,
      total: configs.length,
    },
    language: [manifest, ...scopes.map((s) => s.manifest)].some(
      (m) => m.language === "TypeScript"
    )
      ? "TypeScript"
      : "JavaScript",
    files: facts.paths.length,
    directories: structure.directories,
    maxDirectoryDepth: structure.maxDirectoryDepth,
    totalBytes: metrics.totalBytes,
    medianFileBytes: metrics.medianFileBytes,
    largestFileBytes: metrics.largestFileBytes,
    packageManager: manifest.packageManager,
    scripts: manifest.scripts,
    testFramework:
      [
        ...new Set(
          [tests, ...scopes.map((s) => s.tests)]
            .map((t) => t.testFramework)
            .filter(Boolean)
        ),
      ].join(", ") || null,
    testFiles: tests.testFiles,
    apiRoutes: imports.apiRoutes,
    validationPatterns: [
      ...new Set(
        [imports, ...scopes.map((s) => s.imports)].flatMap(
          (i) => i.validationPatterns
        )
      ),
    ],
    docs: {
      readmeWords: docs.readmeWords,
      agentsMdWords:
        docs.agentsMdWords ||
        scopes.reduce((sum, s) => sum + s.docs.agentsMdWords, 0),
      sections: [
        ...new Set(
          [docs, ...scopes.map((s) => s.docs)].flatMap((d) => d.sections)
        ),
      ],
    },
    has,
    measurements,
    sample: facts.sample,
    truncated: facts.truncated,
  }
}
