import type { RepoProfile, SignalId } from "@/lib/profile"
import type { ScoredCategory } from "@/lib/score"

export type Recommendation = {
  id: SignalId
  title: string
  impact: "High" | "Medium" | "Low"
  category: string
  evidence: (p: RepoProfile) => string
  fix: string
  bullets: string[]
  source: "static" | "deep"
}

const COPY: Partial<Record<SignalId, Omit<Recommendation, "id" | "category">>> = {
  agentsMd: {
    title: "Add an AGENTS.md",
    impact: "High",
    source: "static",
    evidence: (p) =>
      `No AGENTS.md was found. An agent starting work in this repository has to infer the package manager, the test command, and the layout of ${p.directories} directories from the file tree alone.`,
    fix: "Create AGENTS.md at the repository root covering:",
    bullets: [
      "Package manager and install command",
      "Dev, build, test and lint commands",
      "Where the main modules live and what each owns",
      "Conventions an agent must follow when adding code",
    ],
  },
  docArchitecture: {
    title: "Document the architecture boundaries",
    impact: "High",
    source: "deep",
    evidence: (p) =>
      `Rigor found ${p.apiRoutes} routes and ${p.directories} directories with no document describing how they relate. Agents spend context searching for the right implementation path before making a one-line change.`,
    fix: "Add an Architecture section to AGENTS.md describing:",
    bullets: [
      "The primary entry points and what each is responsible for",
      "Where shared business logic lives",
      "Which direction dependencies are allowed to flow",
      "The folders an agent should not modify",
    ],
  },
  docDatabase: {
    title: "Document the database and migration workflow",
    impact: "High",
    source: "static",
    evidence: () =>
      "Migration files were detected but nothing documents how to change the schema. Agents commonly hand-edit generated migration files when this is undocumented.",
    fix: "Add a Database section to AGENTS.md describing:",
    bullets: [
      "Where the schema is defined",
      "The exact command that generates a migration",
      "How migrations are applied locally and in CI",
      "What must never be edited by hand",
    ],
  },
  docApiConventions: {
    title: "Document API conventions",
    impact: "Medium",
    source: "deep",
    evidence: (p) =>
      `${p.apiRoutes} routes were detected with no written convention for request validation, response shape, or error format.`,
    fix: "Add an API section to AGENTS.md describing:",
    bullets: [
      "The validation library and where schemas live",
      "The standard success and error response shape",
      "Auth checks and where they belong",
      "One route to copy as the canonical example",
    ],
  },
  singleValidationLib: {
    title: "Standardise request validation",
    impact: "Medium",
    source: "deep",
    evidence: (p) =>
      `Sampled routes use ${[...new Set(p.validationPatterns)].join(", ")}. An agent copying a nearby route has no way to tell which pattern is current.`,
    fix: "Pick one validation approach and:",
    bullets: [
      "Migrate the minority pattern to the majority one",
      "Add a lint rule that blocks the old approach",
      "Name the chosen library in AGENTS.md",
    ],
  },
  typecheckScript: {
    title: "Add a typecheck script",
    impact: "Medium",
    source: "static",
    evidence: () =>
      "No typecheck script exists, so an agent cannot verify a change compiles without running a full build.",
    fix: "Add to package.json:",
    bullets: ["\"typecheck\": \"tsc --noEmit\"", "Run it in CI alongside lint and test"],
  },
  testScript: {
    title: "Add a test script",
    impact: "High",
    source: "static",
    evidence: () =>
      "No test script was found. Agents have no deterministic way to confirm a change is safe, so they fall back to reading more code.",
    fix: "Add a test script and document it:",
    bullets: [
      "Define \"test\" in package.json",
      "Document the command in AGENTS.md",
      "Make sure it runs without a network or a database when possible",
    ],
  },
  testsExist: {
    title: "Add tests an agent can run",
    impact: "High",
    source: "static",
    evidence: () =>
      "No test files were found. Without tests, nothing verifies an agent's change beyond a human reading the diff.",
    fix: "Start with the highest-traffic paths:",
    bullets: [
      "One test per critical route or service",
      "Keep them fast and offline",
      "Document how to run a single test",
    ],
  },
  singleTestDocumented: {
    title: "Document how to run a single test",
    impact: "Medium",
    source: "static",
    evidence: (p) =>
      `${p.testFiles} test files exist but nothing documents how to run just one. Agents run the whole suite for every iteration, which is slow and expensive.`,
    fix: "Add the single-test command to AGENTS.md, for example:",
    bullets: ["`bun test path/to/file.test.ts -t \"case name\"`"],
  },
  envExample: {
    title: "Add a .env.example",
    impact: "Medium",
    source: "static",
    evidence: () =>
      "Environment variables are read at runtime but no template lists them. Agents cannot tell which variables a feature needs.",
    fix: "Commit a .env.example that lists every variable with a comment describing it.",
    bullets: [],
  },
  lowFanout: {
    title: "Reduce the blast radius of common changes",
    impact: "Medium",
    source: "deep",
    evidence: () =>
      "Adding one field appears to require edits in several distant modules. Every extra module is extra context an agent must load before it can act.",
    fix: "Group the pieces a change touches together:",
    bullets: [
      "Move types next to the code that owns them",
      "Collapse thin pass-through layers",
      "Keep a feature's schema, handler and test in one folder",
    ],
  },
  smallFiles: {
    title: "Break up the largest files",
    impact: "Medium",
    source: "static",
    evidence: (p) =>
      `The median file is ${p.medianFileLoc} lines and the largest is ${p.largestFileLoc}. Agents read whole files, so oversized files burn context on code unrelated to the task.`,
    fix: "Split the worst offenders along the boundaries they already have inside them.",
    bullets: [],
  },
  shallowTree: {
    title: "Flatten the deepest paths",
    impact: "Low",
    source: "static",
    evidence: (p) =>
      `Maximum directory depth is ${p.maxDirectoryDepth}. Deep paths are hard to guess, so agents fall back to listing directories.`,
    fix: "Flatten folders that only contain one child folder.",
    bullets: [],
  },
  ciWorkflow: {
    title: "Add a CI workflow",
    impact: "Medium",
    source: "static",
    evidence: () => "No CI workflow was found, so nothing independently verifies an agent's change.",
    fix: "Add a workflow that runs install, lint, typecheck and test on every pull request.",
    bullets: [],
  },
  colocatedTests: {
    title: "Colocate tests with source",
    impact: "Low",
    source: "static",
    evidence: () =>
      "Tests are stored away from the code they cover, so an agent must search to find the test for a file it just changed.",
    fix: "Move tests next to their source file, or document the mapping in AGENTS.md.",
    bullets: [],
  },
  readmeDepth: {
    title: "Expand the README",
    impact: "Low",
    source: "static",
    evidence: (p) => `The README is ${p.docs.readmeWords} words. It is the first file an agent reads.`,
    fix: "Cover what the project does, how to run it, and where the main code lives.",
    bullets: [],
  },
}

const IMPACT_ORDER = { High: 0, Medium: 1, Low: 2 } as const

export function recommend(p: RepoProfile, categories: ScoredCategory[]): Recommendation[] {
  const seen = new Set<SignalId>()
  const out: Recommendation[] = []

  for (const category of categories) {
    for (const signal of category.signals) {
      if (signal.earned || seen.has(signal.id)) continue
      const copy = COPY[signal.id]
      if (!copy) continue
      seen.add(signal.id)
      out.push({ ...copy, id: signal.id, category: category.name })
    }
  }

  return out.sort((a, b) => IMPACT_ORDER[a.impact] - IMPACT_ORDER[b.impact])
}
