import { AGENT_SIGNALS } from "@workspace/analyzer"
import type { Measurement, RepoProfile, SignalId } from "@/lib/profile"

export type Signal = {
  id: SignalId
  points: number
  subject: string
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
  subject: string,
  label: string | ((p: RepoProfile) => string),
  missing: string | ((p: RepoProfile) => string)
): Signal => ({
  id,
  points,
  subject,
  label: typeof label === "function" ? label : () => label,
  missing: typeof missing === "function" ? missing : () => missing,
})

export const CATEGORIES: CategoryDef[] = [
  {
    key: "discoverability",
    name: "Discoverability",
    question: "Can an agent quickly find the code that matters?",
    signals: [
      s(
        "readme",
        15,
        "README at the repository root",
        "README.md at repository root",
        "No README at repository root"
      ),
      s(
        "readmeDepth",
        10,
        "README depth",
        (p) =>
          `README covers the project in depth (${p.docs.readmeWords} words)`,
        (p) =>
          `README is thin (${p.docs.readmeWords} words), mostly a title and install line`
      ),
      s(
        "predictableRoot",
        15,
        "Source under predictable roots",
        "Source lives under folders an agent can guess (src, app, lib, workspaces)",
        "Source is split across top-level folders an agent has to discover"
      ),
      s(
        "shallowTree",
        15,
        "Directory depth",
        (p) =>
          `Directory tree stays shallow (9 in 10 files within ${p.measurements.shallowTree?.value ?? p.maxDirectoryDepth} levels)`,
        (p) =>
          `Directory tree is deep (9 in 10 files need ${p.measurements.shallowTree?.value ?? p.maxDirectoryDepth} levels)`
      ),
      s(
        "colocatedTests",
        15,
        "Tests beside the code they cover",
        "Tests sit next to the code they cover",
        "Tests live far from the code they cover"
      ),
      s(
        "generatedExcluded",
        15,
        "Build output kept out of the repo",
        "Build output is not committed",
        "Build output is committed next to the source"
      ),
    ],
  },
  {
    key: "instructions",
    name: "Instructions",
    question: "Are agent-facing instructions present and complete?",
    signals: [
      s(
        "agentsMd",
        20,
        "AGENTS.md",
        (p) => `AGENTS.md exists (${p.docs.agentsMdWords} words)`,
        "No AGENTS.md"
      ),
      s(
        "claudeMd",
        5,
        "Tool-specific instructions",
        "Tool-specific instructions present (CLAUDE.md, Cursor rules or similar)",
        "No tool-specific instruction file (CLAUDE.md, Cursor rules or similar)"
      ),
      s(
        "docPackageManager",
        10,
        "Package manager documented",
        (p) => `Package manager documented (${p.packageManager ?? "unknown"})`,
        "Package manager not documented"
      ),
      s(
        "docTestCommand",
        10,
        "Test command documented",
        "Test command documented",
        "Test command not documented"
      ),
      s(
        "docBuildCommand",
        10,
        "Build and dev commands documented",
        "Build and dev commands documented",
        "Build and dev commands not documented"
      ),
      s(
        "docArchitecture",
        15,
        "Architecture documented",
        "Architecture section explains the main boundaries",
        "Architecture undocumented"
      ),
      s(
        "docDatabase",
        10,
        "Database workflow documented",
        "Database and migration workflow documented",
        "Database migration workflow undocumented"
      ),
      s(
        "docApiConventions",
        10,
        "API conventions documented",
        "API conventions documented",
        "API conventions undocumented"
      ),
      s(
        "docCodeStyle",
        10,
        "Code style documented",
        "Code style and naming conventions documented",
        "Code style and naming conventions undocumented"
      ),
    ],
  },
  {
    key: "testability",
    name: "Testability",
    question: "Can an agent verify its own changes?",
    signals: [
      s(
        "testScript",
        20,
        "test script",
        (p) => `test script defined (${p.scripts.test ?? ""})`,
        "No test script in package.json"
      ),
      s(
        "testConfig",
        15,
        "Test framework",
        (p) => `Test framework detected (${p.testFramework})`,
        "No test framework detected in config or the test script"
      ),
      s(
        "testsExist",
        20,
        "Test files",
        (p) => `${p.testFiles} test files present`,
        "No test files found"
      ),
      s(
        "typecheckScript",
        15,
        "typecheck script",
        "typecheck script defined",
        "No typecheck script, so an agent cannot check types in one command"
      ),
      s(
        "singleTestDocumented",
        10,
        "Running a single test documented",
        "Running a single test is documented",
        "No documented way to run one test"
      ),
      s(
        "ciRunsTests",
        10,
        "CI runs the tests",
        "CI runs the test suite",
        "CI does not run the test suite"
      ),
      s(
        "coverage",
        10,
        "Coverage reporting",
        "Coverage reporting configured",
        "No coverage reporting"
      ),
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
        "One validation approach",
        (p) =>
          `One validation approach across routes (${p.validationPatterns[0]})`,
        (p) =>
          `Mixed validation approaches (${[...new Set(p.validationPatterns)].join(", ")})`
      ),
      s(
        "consistentRouteShape",
        20,
        "Route handlers share one shape",
        (p) => `${p.apiRoutes} routes share one handler shape`,
        (p) => `Route handlers across ${p.apiRoutes} routes use several shapes`
      ),
      s(
        "consistentNaming",
        15,
        "Uniform file naming",
        "Files in each folder follow one naming convention",
        "Folders mix naming conventions, so an agent cannot guess a file name"
      ),
      s(
        "singleDataLayer",
        15,
        "Data access through one layer",
        "Data access goes through one layer",
        "Data access is spread across components and routes"
      ),
      s(
        "consistentErrors",
        15,
        "Error handling follows one pattern",
        "Error handling follows one pattern",
        "Error handling differs between modules"
      ),
      s(
        "lintConfig",
        15,
        "Lint config",
        "A linter enforces the code conventions",
        "No linter config, so conventions are not enforced"
      ),
    ],
  },
  {
    key: "tooling",
    name: "Tooling",
    question: "Is setup, build, lint and test behaviour obvious?",
    signals: [
      s(
        "lockfile",
        15,
        "Lockfile and pinned package manager",
        (p) =>
          `Lockfile present and package manager pinned (${p.packageManager})`,
        "No lockfile, or the package manager version is not pinned"
      ),
      s(
        "buildScript",
        15,
        "build script",
        "build script defined",
        "No build script"
      ),
      s(
        "lintScript",
        15,
        "lint script",
        "lint script defined",
        "No lint script"
      ),
      s(
        "formatScript",
        10,
        "format script",
        "format script defined",
        "No format script"
      ),
      s(
        "envExample",
        15,
        "Environment variable template",
        ".env.example lists the required settings",
        "No .env.example, so the required settings are unknown"
      ),
      s(
        "container",
        10,
        "Dockerfile or devcontainer",
        "Dockerfile or devcontainer present",
        "No Dockerfile or devcontainer"
      ),
      s(
        "ciWorkflow",
        10,
        "CI workflow",
        "CI workflow defined",
        "No CI workflow"
      ),
      s(
        "nodePinned",
        10,
        "Runtime version pinned",
        "Runtime version pinned",
        "Runtime version not pinned"
      ),
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
        "Median file size",
        (p) => `A typical file is ${formatBytes(p.medianFileBytes)}`,
        (p) =>
          `A typical file is ${formatBytes(p.medianFileBytes)}, so most edits mean reading a lot`
      ),
      s(
        "noMegaFiles",
        15,
        "Largest file size",
        (p) => `Largest file is ${formatBytes(p.largestFileBytes)}`,
        (p) =>
          `Largest file is ${formatBytes(p.largestFileBytes)}, too big to read in one go`
      ),
      s(
        "featureFolders",
        25,
        "Folders named by feature",
        "Source folders are named after features, not file types",
        "Source folders are named after file types (components, hooks, utils), so one change touches several of them"
      ),
      s(
        "lowFanout",
        20,
        "Change fan-out across modules",
        "A typical file reaches into few other folders",
        "A typical file reaches into many other folders, so one change means reading many of them"
      ),
    ],
  },
]

export type SignalStatus = "pass" | "fail" | "not-measured"

const EMPTY: ReadonlySet<SignalId> = new Set()

export const DEEP_SCAN_ONLY: ReadonlySet<SignalId> = new Set(
  Object.keys(AGENT_SIGNALS) as SignalId[]
)

const SUBJECTS = new Map<SignalId, string>(
  CATEGORIES.flatMap((category) =>
    category.signals.map((signal) => [signal.id, signal.subject] as const)
  )
)

export function signalSubject(id: SignalId): string {
  return SUBJECTS.get(id) ?? id
}

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

export function scoreCategory(
  def: CategoryDef,
  p: RepoProfile,
  answered: ReadonlySet<SignalId> = EMPTY
): ScoredCategory {
  const signals: ScoredSignal[] = def.signals.map((sig) => {
    const value = p.has[sig.id]
    if (value === null || value === undefined) {
      const reason = answered.has(sig.id)
        ? "nothing like this in the repository"
        : DEEP_SCAN_ONLY.has(sig.id)
          ? "needs a deep scan"
          : "does not apply here"
      return {
        id: sig.id,
        points: sig.points,
        status: "not-measured",
        text: `${sig.subject} · ${reason}`,
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
  const earnedPoints = measured.reduce(
    (n, sig) => n + (sig.status === "pass" ? sig.points : 0),
    0
  )

  return {
    key: def.key,
    name: def.name,
    question: def.question,
    score:
      totalPoints === 0 ? null : Math.round((earnedPoints / totalPoints) * 100),
    earnedPoints,
    totalPoints,
    signals,
  }
}

export function scoreRepo(
  p: RepoProfile,
  answered: ReadonlySet<SignalId> = EMPTY
) {
  const categories = CATEGORIES.map((def) => scoreCategory(def, p, answered))
  const scored = categories.filter(
    (c): c is ScoredCategory & { score: number } => c.score !== null
  )
  const overall =
    scored.length === 0
      ? null
      : Math.round(scored.reduce((n, c) => n + c.score, 0) / scored.length)
  return { overall, categories }
}

export function band(score: number) {
  if (score >= 80) return "good" as const
  if (score >= 60) return "fair" as const
  return "poor" as const
}
