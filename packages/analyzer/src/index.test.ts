import { expect, test } from "bun:test"
import { analyze } from "./index"
import type { FileEntry, RepoMeta, SignalId } from "./types"

const meta: RepoMeta = {
  owner: "acme",
  repo: "app",
  description: "",
  stars: 0,
  defaultBranch: "main",
  commitSha: "abc",
  commitMessage: "",
}

async function* feed(entries: FileEntry[]) {
  for (const entry of entries) yield entry
}

const file = (path: string, text: string | null = ""): FileEntry => ({
  path,
  size: text?.length ?? 0,
  text,
})

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

test("every signal is present in the profile", async () => {
  const profile = await analyze(feed([file("package.json", "{}")]), meta)
  for (const id of ALL_SIGNALS) {
    expect(Object.hasOwn(profile.has, id), id).toBe(true)
  }
  expect(Object.keys(profile.has)).toHaveLength(40)
})

test("the two deep-scan signals are null, never false", async () => {
  const profile = await analyze(feed([file("package.json", "{}")]), meta)
  expect(profile.has.consistentRouteShape).toBeNull()
  expect(profile.has.consistentErrors).toBeNull()
})

test("a healthy repository earns the signals it should", async () => {
  const profile = await analyze(
    feed([
      file("package.json", JSON.stringify({
        packageManager: "bun@1.3.10",
        engines: { node: ">=20" },
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
    ]),
    meta
  )
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

test("an empty repository produces zeroes and no thrown error", async () => {
  const profile = await analyze(feed([]), meta)
  expect(profile.files).toBe(0)
  expect(profile.medianFileLoc).toBe(0)
  expect(profile.has.readme).toBe(false)
})

test("truncation is carried onto the profile", async () => {
  const truncated = { cap: "files" as const, detail: "stopped early" }
  const profile = await analyze(feed([file("package.json", "{}")]), meta, truncated)
  expect(profile.truncated).toEqual(truncated)
})

test("measurements accompany every thresholded signal", async () => {
  const profile = await analyze(feed([file("package.json", "{}"), file("src/a.ts", "const a = 1")]), meta)
  for (const id of ["smallFiles", "noMegaFiles", "shallowTree", "consistentNaming"] as SignalId[]) {
    expect(profile.measurements[id], id).toBeDefined()
  }
})
