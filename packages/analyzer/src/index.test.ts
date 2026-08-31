import { expect, test } from "bun:test"
import { analyze } from "./index"
import type { RepoMeta, SignalId, TreeEntry } from "./types"

const meta: RepoMeta = {
  owner: "acme",
  repo: "app",
  description: "",
  stars: 0,
  defaultBranch: "main",
  commitSha: "abc",
  commitMessage: "",
}

type Fixture = { path: string; text?: string; bytes?: number }

function build(files: Fixture[]) {
  const entries: TreeEntry[] = files.map((f) => ({
    path: f.path,
    bytes: f.bytes ?? f.text?.length ?? 0,
  }))
  const texts = new Map<string, string>()
  const sampled = new Set<string>()
  for (const f of files) {
    if (f.text === undefined) continue
    texts.set(f.path, f.text)
    sampled.add(f.path)
  }
  return { entries, texts, sampled }
}

function run(files: Fixture[], truncated: Parameters<typeof analyze>[4] = null) {
  const { entries, texts, sampled } = build(files)
  return analyze(entries, texts, sampled, meta, truncated)
}

const file = (path: string, text = ""): Fixture => ({ path, text })

const ALL_SIGNALS: SignalId[] = [
  "readme", "readmeDepth", "predictableRoot", "shallowTree", "colocatedTests", "generatedExcluded",
  "agentsMd", "claudeMd", "docPackageManager", "docTestCommand", "docBuildCommand", "docArchitecture",
  "docDatabase", "docApiConventions", "docCodeStyle",
  "testScript", "testConfig", "testsExist", "typecheckScript", "singleTestDocumented", "ciRunsTests", "coverage",
  "singleValidationLib", "consistentRouteShape", "consistentNaming", "singleDataLayer", "consistentErrors",
  "lintConfig", "lockfile", "lintScript", "formatScript", "buildScript",
  "envExample", "container", "ciWorkflow", "nodePinned",
  "smallFiles", "noMegaFiles", "featureFolders", "lowFanout",
]

test("the signal set is exactly 40", () => {
  expect(ALL_SIGNALS).toHaveLength(40)
  expect(new Set(ALL_SIGNALS).size).toBe(40)
})

test("every signal is present in the profile", () => {
  const profile = run([file("package.json", "{}")])
  for (const id of ALL_SIGNALS) {
    expect(Object.hasOwn(profile.has, id), id).toBe(true)
  }
  expect(Object.keys(profile.has)).toHaveLength(40)
})

test("the two deep-scan signals are null, never false", () => {
  const profile = run([file("package.json", "{}")])
  expect(profile.has.consistentRouteShape).toBeNull()
  expect(profile.has.consistentErrors).toBeNull()
})

test("a healthy repository earns the signals it should", () => {
  const profile = run([
      file("package.json", JSON.stringify({
        packageManager: "bun@1.3.10",
        engines: { node: ">=20" },
        dependencies: { zod: "^4.0.0" },
        scripts: { build: "next build", dev: "next dev", test: "vitest run", lint: "eslint", typecheck: "tsc --noEmit" },
      })),
      file("bun.lock", null),
      file("README.md", `# App\n\n## Architecture\n\n${"word ".repeat(320)}\n\nrun \`bun run test\` and \`bun run build\` and \`bun run dev\``),
      file("AGENTS.md", "# Agents\n\nrules"),
      file("eslint.config.js", "export default []"),
      file("vitest.config.ts", "export default {}"),
      file(".env.example", "DATABASE_URL="),
      file("src/auth/login.ts", "import { z } from 'zod'\nconst a = 1\n"),
      file("src/auth/login.test.ts", "import { test } from 'vitest'\n"),
    file("src/billing/plan.ts", "import { z } from 'zod'\n"),
  ])
  expect(profile.has.readme).toBe(true)
  expect(profile.has.readmeDepth).toBe(true)
  expect(profile.has.agentsMd).toBe(true)
  expect(profile.has.lockfile).toBe(true)
  expect(profile.has.testScript).toBe(true)
  expect(profile.has.testConfig).toBe(true)
  expect(profile.has.colocatedTests).toBe(true)
  expect(profile.has.singleValidationLib).toBe(true)
  expect(profile.packageManager).toBe("bun@1.3.10")
  expect(profile.testFramework).toBe("vitest")
})

test("an empty repository produces zeroes and no thrown error", () => {
  const profile = run([])
  expect(profile.files).toBe(0)
  expect(profile.medianFileBytes).toBe(0)
  expect(profile.has.readme).toBe(false)
})

test("truncation is carried onto the profile", () => {
  const truncated = { cap: "tree" as const, detail: "tree truncated" }
  const profile = run([file("package.json", "{}")], truncated)
  expect(profile.truncated).toEqual(truncated)
})

test("the sample size is reported so the report can disclose it", () => {
  const { entries, texts } = build([
    file("package.json", "{}"),
    { path: "src/a.ts", text: "import { z } from 'zod'" },
    { path: "src/b.ts", bytes: 300 },
  ])
  const profile = analyze(entries, texts, new Set(["src/a.ts"]), meta)
  expect(profile.sample).toEqual({ sampled: 1, total: 2 })
})

test("measurements accompany every thresholded signal", () => {
  const profile = run([file("package.json", "{}"), file("src/a.ts", "const a = 1")])
  for (const id of ["smallFiles", "noMegaFiles", "shallowTree", "consistentNaming"] as SignalId[]) {
    expect(profile.measurements[id], id).toBeDefined()
  }
})
