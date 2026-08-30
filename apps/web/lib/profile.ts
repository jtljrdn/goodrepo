export type RepoProfile = {
  owner: string
  repo: string
  description: string
  stars: number
  defaultBranch: string
  commitSha: string
  commitMessage: string
  framework: string
  language: string
  files: number
  directories: number
  maxDirectoryDepth: number
  linesOfCode: number
  medianFileLoc: number
  largestFileLoc: number
  packageManager: string | null
  scripts: Record<string, string>
  testFramework: string | null
  testFiles: number
  apiRoutes: number
  validationPatterns: string[]
  docs: {
    readmeWords: number
    agentsMdWords: number
    sections: string[]
  }
  has: Record<SignalId, boolean>
}

export type SignalId =
  | "readme"
  | "readmeDepth"
  | "predictableRoot"
  | "shallowTree"
  | "namedBoundaries"
  | "colocatedTests"
  | "agentsMd"
  | "claudeMd"
  | "docPackageManager"
  | "docTestCommand"
  | "docBuildCommand"
  | "docArchitecture"
  | "docDatabase"
  | "docApiConventions"
  | "docCodeStyle"
  | "testScript"
  | "testConfig"
  | "testsExist"
  | "typecheckScript"
  | "singleTestDocumented"
  | "ciRunsTests"
  | "coverage"
  | "singleValidationLib"
  | "consistentRouteShape"
  | "consistentNaming"
  | "singleDataLayer"
  | "consistentErrors"
  | "lintConfig"
  | "lockfile"
  | "lintScript"
  | "formatScript"
  | "buildScript"
  | "envExample"
  | "container"
  | "ciWorkflow"
  | "nodePinned"
  | "smallFiles"
  | "noMegaFiles"
  | "featureFolders"
  | "lowFanout"
  | "generatedExcluded"

// ponytail: deterministic seeded mock. Swap for the real scanner later; the
// scoring below already reads only from RepoProfile.
function seeded(key: string) {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return () => {
    h += 0x6d2b79f5
    let t = h
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const FRAMEWORKS = ["nextjs", "vite", "remix", "express", "nestjs", "astro"]
const FRAMEWORK_COMMANDS: Record<string, { dev: string; build: string }> = {
  nextjs: { dev: "next dev", build: "next build" },
  vite: { dev: "vite", build: "vite build" },
  remix: { dev: "remix vite:dev", build: "remix vite:build" },
  express: { dev: "tsx watch src/server.ts", build: "tsc -p tsconfig.build.json" },
  nestjs: { dev: "nest start --watch", build: "nest build" },
  astro: { dev: "astro dev", build: "astro build" },
}
const PACKAGE_MANAGERS = ["bun@1.3.10", "pnpm@10.4.1", "npm@10.9.0", "yarn@4.6.0"]
const TEST_FRAMEWORKS = ["vitest", "jest", "playwright", "node:test"]

const SIGNAL_ODDS: Record<SignalId, number> = {
  readme: 0.97,
  readmeDepth: 0.62,
  predictableRoot: 0.8,
  shallowTree: 0.55,
  namedBoundaries: 0.6,
  colocatedTests: 0.45,
  agentsMd: 0.42,
  claudeMd: 0.3,
  docPackageManager: 0.7,
  docTestCommand: 0.6,
  docBuildCommand: 0.75,
  docArchitecture: 0.35,
  docDatabase: 0.28,
  docApiConventions: 0.3,
  docCodeStyle: 0.45,
  testScript: 0.78,
  testConfig: 0.7,
  testsExist: 0.72,
  typecheckScript: 0.55,
  singleTestDocumented: 0.3,
  ciRunsTests: 0.66,
  coverage: 0.35,
  singleValidationLib: 0.5,
  consistentRouteShape: 0.55,
  consistentNaming: 0.7,
  singleDataLayer: 0.5,
  consistentErrors: 0.42,
  lintConfig: 0.85,
  lockfile: 0.92,
  lintScript: 0.8,
  formatScript: 0.62,
  buildScript: 0.85,
  envExample: 0.48,
  container: 0.4,
  ciWorkflow: 0.75,
  nodePinned: 0.5,
  smallFiles: 0.55,
  noMegaFiles: 0.6,
  featureFolders: 0.5,
  lowFanout: 0.45,
  generatedExcluded: 0.7,
}

export function buildProfile(owner: string, repo: string): RepoProfile {
  const rand = seeded(`${owner}/${repo}`)
  const pick = <T,>(list: T[]): T => list[Math.floor(rand() * list.length)]!
  const int = (min: number, max: number) => Math.floor(min + rand() * (max - min))

  const has = {} as Record<SignalId, boolean>
  for (const id of Object.keys(SIGNAL_ODDS) as SignalId[]) {
    has[id] = rand() < SIGNAL_ODDS[id]
  }

  const packageManager = has.lockfile ? pick(PACKAGE_MANAGERS) : null
  const testFramework = has.testConfig ? pick(TEST_FRAMEWORKS) : null
  const files = int(120, 1400)

  const framework = pick(FRAMEWORKS)
  const commands = FRAMEWORK_COMMANDS[framework]!
  const scripts: Record<string, string> = { dev: commands.dev }
  if (has.buildScript) scripts.build = commands.build
  if (has.testScript) scripts.test = testFramework ?? "vitest run"
  if (has.lintScript) scripts.lint = "eslint ."
  if (has.formatScript) scripts.format = "prettier --write ."
  if (has.typecheckScript) scripts.typecheck = "tsc --noEmit"

  const sections = [
    has.docArchitecture && "architecture",
    has.docTestCommand && "testing",
    has.docDatabase && "database",
    has.docApiConventions && "api",
    has.docCodeStyle && "conventions",
  ].filter(Boolean) as string[]

  const validationPatterns = has.singleValidationLib
    ? ["zod", "zod", "zod"]
    : ["zod", "manual", "yup", "zod"]

  return {
    owner,
    repo,
    description: `${repo} — analyzed from the default branch`,
    stars: int(40, 68000),
    defaultBranch: "main",
    commitSha: Array.from({ length: 7 }, () =>
      "0123456789abcdef"[Math.floor(rand() * 16)]
    ).join(""),
    commitMessage: pick([
      "fix: guard null session in middleware",
      "chore: bump dependencies",
      "feat: add pagination to list endpoints",
      "refactor: extract query helpers",
    ]),
    framework,
    language: "TypeScript",
    files,
    directories: Math.round(files / int(5, 12)),
    maxDirectoryDepth: has.shallowTree ? int(4, 7) : int(8, 12),
    linesOfCode: files * int(60, 190),
    medianFileLoc: has.smallFiles ? int(60, 180) : int(300, 620),
    largestFileLoc: has.noMegaFiles ? int(400, 1200) : int(1800, 5200),
    packageManager,
    scripts,
    testFramework,
    testFiles: has.testsExist ? int(8, 240) : 0,
    apiRoutes: int(4, 84),
    validationPatterns,
    docs: {
      readmeWords: has.readme ? (has.readmeDepth ? int(700, 2600) : int(60, 320)) : 0,
      agentsMdWords: has.agentsMd ? int(120, 900) : 0,
      sections,
    },
    has,
  }
}
