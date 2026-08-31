import { expect, test } from "bun:test"
import { detectDocs } from "./docs"
import type { RawFacts } from "../types"

function facts(kept: Record<string, string>): RawFacts {
  return {
    paths: Object.keys(kept),
    codeFiles: [],
    keptText: new Map(Object.entries(kept)),
    filesRead: 0,
    truncated: null,
  }
}

test("counts README words and applies the depth threshold at the boundary", () => {
  const thin = detectDocs(facts({ "README.md": "# Title\n\ninstall it" }), null)
  expect(thin.has.readme).toBe(true)
  expect(thin.has.readmeDepth).toBe(false)

  const deep = detectDocs(facts({ "README.md": `# Title\n\n${"word ".repeat(320)}` }), null)
  expect(deep.readmeWords).toBeGreaterThanOrEqual(300)
  expect(deep.has.readmeDepth).toBe(true)
})

test("detects agent instruction files", () => {
  const result = detectDocs(facts({ "AGENTS.md": "# Agents\n\nrules here", "CLAUDE.md": "x" }), null)
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
    null
  )
  expect(result.has.docArchitecture).toBe(true)
  expect(result.has.docApiConventions).toBe(true)
  expect(result.has.docDatabase).toBe(true)
  expect(result.has.docCodeStyle).toBe(true)
  expect(result.sections.sort()).toEqual(["api", "architecture", "conventions", "database"])
})

test("a heading match must be a heading, not a passing mention", () => {
  const result = detectDocs(facts({ "README.md": "We have a nice architecture and a database." }), null)
  expect(result.has.docArchitecture).toBe(false)
  expect(result.has.docDatabase).toBe(false)
})

test("detects documented commands", () => {
  const result = detectDocs(
    facts({ "README.md": "```bash\nbun run test\nbun run build\nbun run dev\n```" }),
    "bun@1.3.10"
  )
  expect(result.has.docTestCommand).toBe(true)
  expect(result.has.docBuildCommand).toBe(true)
  expect(result.has.docPackageManager).toBe(true)
})

test("build and dev must both be documented for docBuildCommand", () => {
  const result = detectDocs(facts({ "README.md": "run `npm run build`" }), "npm")
  expect(result.has.docBuildCommand).toBe(false)
})

test("detects a documented single-test invocation", () => {
  expect(detectDocs(facts({ "README.md": "`vitest run src/a.test.ts`" }), null).has.singleTestDocumented).toBe(true)
  expect(detectDocs(facts({ "README.md": '`bun test -t "my case"`' }), null).has.singleTestDocumented).toBe(true)
  expect(detectDocs(facts({ "README.md": "`bun test`" }), null).has.singleTestDocumented).toBe(false)
})

test("no README at all fails cleanly", () => {
  const result = detectDocs(facts({}), null)
  expect(result.has.readme).toBe(false)
  expect(result.readmeWords).toBe(0)
  expect(result.sections).toEqual([])
})
