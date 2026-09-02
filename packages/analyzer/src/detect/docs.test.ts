import { expect, test } from "bun:test"
import { detectDocs, type DocApplies } from "./docs"
import type { RawFacts } from "../types"

const ALL: DocApplies = {
  packageManager: null,
  tests: true,
  testScript: true,
  buildScript: true,
  devScript: true,
  database: true,
  api: true,
}

const applies = (packageManager: string | null = null): DocApplies => ({
  ...ALL,
  packageManager,
})

function facts(kept: Record<string, string>): RawFacts {
  return {
    paths: Object.keys(kept),
    codeFiles: [],
    keptText: new Map(Object.entries(kept)),
    sample: null,
    truncated: null,
  }
}

test("counts README words and applies the depth threshold at the boundary", () => {
  const thin = detectDocs(
    facts({ "README.md": "# Title\n\ninstall it" }),
    applies()
  )
  expect(thin.has.readme).toBe(true)
  expect(thin.has.readmeDepth).toBe(false)

  const deep = detectDocs(
    facts({ "README.md": `# Title\n\n${"word ".repeat(320)}` }),
    applies()
  )
  expect(deep.readmeWords).toBeGreaterThanOrEqual(300)
  expect(deep.has.readmeDepth).toBe(true)
})

test("detects agent instruction files", () => {
  const result = detectDocs(
    facts({ "AGENTS.md": "# Agents\n\nrules here", "CLAUDE.md": "x" }),
    applies()
  )
  expect(result.has.agentsMd).toBe(true)
  expect(result.has.claudeMd).toBe(true)
  expect(result.agentsMdWords).toBe(3)
})

test("finds section headings in either README or AGENTS.md", () => {
  const result = detectDocs(
    facts({
      "README.md": "## Architecture\n\nlayers\n\n## API Conventions\n\nroutes",
      "AGENTS.md": "## Database\n\nmigrations\n\n### Code style\n\nnaming",
    }),
    applies()
  )
  expect(result.has.docArchitecture).toBe(true)
  expect(result.has.docApiConventions).toBe(true)
  expect(result.has.docDatabase).toBe(true)
  expect(result.has.docCodeStyle).toBe(true)
  expect(result.sections.sort()).toEqual([
    "api",
    "architecture",
    "conventions",
    "database",
  ])
})

test("a heading match must be a heading, not a passing mention", () => {
  const result = detectDocs(
    facts({ "README.md": "We have a nice architecture and a database." }),
    applies()
  )
  expect(result.has.docArchitecture).toBe(false)
  expect(result.has.docDatabase).toBe(false)
})

test("detects documented commands", () => {
  const result = detectDocs(
    facts({
      "README.md": "```bash\nbun run test\nbun run build\nbun run dev\n```",
    }),
    applies("bun@1.3.10")
  )
  expect(result.has.docTestCommand).toBe(true)
  expect(result.has.docBuildCommand).toBe(true)
  expect(result.has.docPackageManager).toBe(true)
})

test("build and dev must both be documented for docBuildCommand", () => {
  const result = detectDocs(
    facts({ "README.md": "run `npm run build`" }),
    applies("npm")
  )
  expect(result.has.docBuildCommand).toBe(false)
})

test("detects a documented single-test invocation", () => {
  expect(
    detectDocs(facts({ "README.md": "`vitest run src/a.test.ts`" }), applies())
      .has.singleTestDocumented
  ).toBe(true)
  expect(
    detectDocs(facts({ "README.md": '`bun test -t "my case"`' }), applies()).has
      .singleTestDocumented
  ).toBe(true)
  expect(
    detectDocs(facts({ "README.md": "`bun test`" }), applies()).has
      .singleTestDocumented
  ).toBe(false)
})

test("no README at all fails cleanly", () => {
  const result = detectDocs(facts({}), applies())
  expect(result.has.readme).toBe(false)
  expect(result.readmeWords).toBe(0)
  expect(result.sections).toEqual([])
})

test("reads commands documented in CONTRIBUTING.md", () => {
  const result = detectDocs(
    facts({
      "README.md": "# Drizzle\n\nan ORM",
      "CONTRIBUTING.md":
        '## Running tests\n\n```bash\npnpm install && pnpm build\npnpm run dev\ncd x && pnpm test -t "case"\n```',
    }),
    applies("pnpm@10.6.3")
  )
  expect(result.has.docPackageManager).toBe(true)
  expect(result.has.docTestCommand).toBe(true)
  expect(result.has.docBuildCommand).toBe(true)
  expect(result.has.singleTestDocumented).toBe(true)
})

test("CONTRIBUTING.md does not count toward the README word count", () => {
  const result = detectDocs(
    facts({
      "README.md": "# T\n\nshort",
      "CONTRIBUTING.md": `# C\n\n${"word ".repeat(400)}`,
    }),
    applies()
  )
  expect(result.has.readmeDepth).toBe(false)
})

test("documentation checks do not apply to things the repository does not have", () => {
  const none = detectDocs(facts({ "README.md": "# T" }), {
    packageManager: null,
    tests: false,
    testScript: false,
    buildScript: false,
    devScript: false,
    database: false,
    api: false,
  })
  expect(none.has.docPackageManager).toBeNull()
  expect(none.has.docTestCommand).toBeNull()
  expect(none.has.docBuildCommand).toBeNull()
  expect(none.has.docDatabase).toBeNull()
  expect(none.has.docApiConventions).toBeNull()
  expect(none.has.singleTestDocumented).toBeNull()
  expect(none.has.docArchitecture).toBe(false)
})

test("README depth does not apply without a README", () => {
  expect(detectDocs(facts({}), applies()).has.readmeDepth).toBeNull()
})

test("a build-only library needs only the build command documented", () => {
  const result = detectDocs(facts({ "README.md": "run `npm run build`" }), {
    ...applies("npm"),
    devScript: false,
  })
  expect(result.has.docBuildCommand).toBe(true)
})

test("any tool-specific instruction file satisfies claudeMd", () => {
  const cursor = facts({ "README.md": "x" })
  cursor.paths.push(".cursor/rules/core.mdc")
  expect(detectDocs(cursor, applies()).has.claudeMd).toBe(true)
  const copilot = facts({ "README.md": "x" })
  copilot.paths.push(".github/copilot-instructions.md")
  expect(detectDocs(copilot, applies()).has.claudeMd).toBe(true)
  expect(detectDocs(facts({ "README.md": "x" }), applies()).has.claudeMd).toBe(
    false
  )
})
