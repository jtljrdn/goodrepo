import type { Measurement, RepoProfile, SignalId } from "@/lib/profile"

export type Signal = {
  id: SignalId
  points: number
  label: (p: RepoProfile) => string
  missing: (p: RepoProfile) => string
}

export type CategoryKey =
  | "discoverability"
  | "instructions"
  | "testability"
  | "consistency"
  | "tooling"
  | "context"

export type CategoryDef = {
  key: CategoryKey
  name: string
  question: string
  signals: Signal[]
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

const s = (
  id: SignalId,
  points: number,
  label: string | ((p: RepoProfile) => string),
  missing: string | ((p: RepoProfile) => string)
): Signal => ({
  id,
  points,
  label: typeof label === "function" ? label : () => label,
  missing: typeof missing === "function" ? missing : () => missing,
})

export const CATEGORIES: CategoryDef[] = [
  {
    key: "discoverability",
    name: "Discoverability",
    question: "Can an agent quickly find the code that matters?",
    signals: [
      s("readme", 15, "README.md at repository root", "No README at repository root"),
      s(
        "readmeDepth",
        10,
        (p) => `README covers the project in depth (${p.docs.readmeWords} words)`,
        (p) => `README is thin (${p.docs.readmeWords} words) — mostly a title and install line`
      ),
      s("predictableRoot", 15, "Source lives under a single predictable root", "Source is split across several unrelated top-level folders"),
      s(
        "shallowTree",
        15,
        (p) => `Directory tree stays shallow (max depth ${p.maxDirectoryDepth})`,
        (p) => `Directory tree is deep (max depth ${p.maxDirectoryDepth})`
      ),
      s("colocatedTests", 15, "Tests sit next to the code they cover", "Tests live far from the code they cover"),
      s("generatedExcluded", 15, "Generated output is ignored and excluded", "Generated output is committed alongside source"),
    ],
  },
  {
    key: "instructions",
    name: "Instructions",
    question: "Are agent-facing instructions present and complete?",
    signals: [
      s("agentsMd", 20, (p) => `AGENTS.md exists (${p.docs.agentsMdWords} words)`, "No AGENTS.md"),
      s("claudeMd", 5, "CLAUDE.md present", "No CLAUDE.md"),
      s("docPackageManager", 10, (p) => `Package manager documented (${p.packageManager ?? "unknown"})`, "Package manager not documented"),
      s("docTestCommand", 10, "Test command documented", "Test command not documented"),
      s("docBuildCommand", 10, "Build and dev commands documented", "Build and dev commands not documented"),
      s("docArchitecture", 15, "Architecture section explains the main boundaries", "Architecture undocumented"),
      s("docDatabase", 10, "Database and migration workflow documented", "Database migration workflow undocumented"),
      s("docApiConventions", 10, "API conventions documented", "API conventions undocumented"),
      s("docCodeStyle", 10, "Code style and naming conventions documented", "Code style and naming conventions undocumented"),
    ],
  },
  {
    key: "testability",
    name: "Testability",
    question: "Can an agent verify its own changes?",
    signals: [
      s("testScript", 20, (p) => `test script defined (${p.scripts.test ?? ""})`, "No test script in package.json"),
      s("testConfig", 15, (p) => `Test framework config detected (${p.testFramework})`, "No test framework config detected"),
      s("testsExist", 20, (p) => `${p.testFiles} test files present`, "No test files found"),
      s("typecheckScript", 15, "typecheck script defined", "No typecheck script — agents cannot check types in one command"),
      s("singleTestDocumented", 10, "Running a single test is documented", "No documented way to run one test"),
      s("ciRunsTests", 10, "CI runs the test suite", "CI does not run the test suite"),
      s("coverage", 10, "Coverage reporting configured", "No coverage reporting"),
    ],
  },
  {
    key: "consistency",
    name: "Consistency",
    question: "Does the codebase repeat the same patterns?",
    signals: [
      s(
        "singleValidationLib",
        20,
        (p) => `One validation approach across routes (${p.validationPatterns[0]})`,
        (p) => `Mixed validation approaches (${[...new Set(p.validationPatterns)].join(", ")})`
      ),
      s("consistentRouteShape", 20, (p) => `${p.apiRoutes} routes share one handler shape`, (p) => `Route handlers across ${p.apiRoutes} routes use several shapes`),
      s("consistentNaming", 15, "File and export naming is uniform", "File naming mixes conventions"),
      s("singleDataLayer", 15, "Data access goes through one layer", "Data access is spread across components and routes"),
      s("consistentErrors", 15, "Error handling follows one pattern", "Error handling differs between modules"),
      s("lintConfig", 15, "Lint config enforces the conventions", "No lint config enforcing conventions"),
    ],
  },
  {
    key: "tooling",
    name: "Tooling",
    question: "Is setup, build, lint and test behaviour obvious?",
    signals: [
      s("lockfile", 15, (p) => `Lockfile and pinned package manager (${p.packageManager})`, "No lockfile or pinned package manager"),
      s("buildScript", 15, "build script defined", "No build script"),
      s("lintScript", 15, "lint script defined", "No lint script"),
      s("formatScript", 10, "format script defined", "No format script"),
      s("envExample", 15, ".env.example lists required variables", "No .env.example — required env vars are unknown"),
      s("container", 10, "Dockerfile or devcontainer present", "No Dockerfile or devcontainer"),
      s("ciWorkflow", 10, "CI workflow defined", "No CI workflow"),
      s("nodePinned", 10, "Runtime version pinned", "Runtime version not pinned"),
    ],
  },
  {
    key: "context",
    name: "Context Efficiency",
    question: "How much must an agent read to make one change?",
    signals: [
      s(
        "smallFiles",
        20,
        (p) => `Median file is ${formatBytes(p.medianFileBytes)}`,
        (p) => `Median file is ${formatBytes(p.medianFileBytes)}, so most edits pull in a lot of context`
      ),
      s(
        "noMegaFiles",
        15,
        (p) => `Largest file is ${formatBytes(p.largestFileBytes)}`,
        (p) => `Largest file is ${formatBytes(p.largestFileBytes)}`
      ),
      s(
        "featureFolders",
        25,
        "Source folders are named after features, not file types",
        "Source folders are named after file types (components, hooks, utils), so one change is spread across them"
      ),
      s("lowFanout", 20, "Common changes stay inside one module", "Common changes touch many modules at once"),
    ],
  },
]

export type SignalStatus = "pass" | "fail" | "not-measured"

export type ScoredSignal = {
  id: SignalId
  points: number
  status: SignalStatus
  text: string
  measurement?: Measurement
}

export type ScoredCategory = {
  key: CategoryKey
  name: string
  question: string
  score: number | null
  earnedPoints: number
  totalPoints: number
  signals: ScoredSignal[]
}

export function scoreCategory(def: CategoryDef, p: RepoProfile): ScoredCategory {
  const signals: ScoredSignal[] = def.signals.map((sig) => {
    const value = p.has[sig.id]
    if (value === null || value === undefined) {
      return {
        id: sig.id,
        points: sig.points,
        status: "not-measured",
        text: "Not measured in a fast scan",
        measurement: p.measurements[sig.id],
      }
    }
    return {
      id: sig.id,
      points: sig.points,
      status: value ? "pass" : "fail",
      text: value ? sig.label(p) : sig.missing(p),
      measurement: p.measurements[sig.id],
    }
  })

  const measured = signals.filter((sig) => sig.status !== "not-measured")
  const totalPoints = measured.reduce((n, sig) => n + sig.points, 0)
  const earnedPoints = measured.reduce((n, sig) => n + (sig.status === "pass" ? sig.points : 0), 0)

  return {
    key: def.key,
    name: def.name,
    question: def.question,
    score: totalPoints === 0 ? null : Math.round((earnedPoints / totalPoints) * 100),
    earnedPoints,
    totalPoints,
    signals,
  }
}

export function scoreRepo(p: RepoProfile) {
  const categories = CATEGORIES.map((def) => scoreCategory(def, p))
  const scored = categories.filter(
    (c): c is ScoredCategory & { score: number } => c.score !== null
  )
  const overall =
    scored.length === 0 ? null : Math.round(scored.reduce((n, c) => n + c.score, 0) / scored.length)
  return { overall, categories }
}

export function band(score: number) {
  if (score >= 80) return "good" as const
  if (score >= 60) return "fair" as const
  return "poor" as const
}
