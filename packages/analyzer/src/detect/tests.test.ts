import { expect, test } from "bun:test"
import { detectTests } from "./tests"
import type { RawFacts } from "../types"

function facts(paths: string[], kept: Record<string, string> = {}): RawFacts {
  return {
    paths,
    codeFiles: [],
    keptText: new Map(Object.entries(kept)),
    filesRead: 0,
    truncated: null,
  }
}

const pkg = (body: object) => JSON.stringify(body)

test("detects a test script and framework config", () => {
  const result = detectTests(
    facts(["package.json", "vitest.config.ts"], { "package.json": pkg({ scripts: { test: "vitest run" } }) })
  )
  expect(result.has.testScript).toBe(true)
  expect(result.has.testConfig).toBe(true)
  expect(result.testFramework).toBe("vitest")
})

test("falls back to the test script when there is no config file", () => {
  const result = detectTests(facts(["package.json"], { "package.json": pkg({ scripts: { test: "bun test" } }) }))
  expect(result.has.testConfig).toBe(false)
  expect(result.testFramework).toBe("bun")
})

test("counts test files", () => {
  const result = detectTests(facts(["src/a.test.ts", "src/__tests__/b.ts", "src/c.ts"]))
  expect(result.testFiles).toBe(2)
  expect(result.has.testsExist).toBe(true)
})

test("no test files fails testsExist", () => {
  const result = detectTests(facts(["src/c.ts"]))
  expect(result.testFiles).toBe(0)
  expect(result.has.testsExist).toBe(false)
})

test("detects coverage from a script or from config", () => {
  expect(
    detectTests(facts(["package.json"], { "package.json": pkg({ scripts: { "test:coverage": "vitest --coverage" } }) }))
      .has.coverage
  ).toBe(true)
  expect(
    detectTests(facts(["vitest.config.ts"], { "vitest.config.ts": "export default { test: { coverage: {} } }" })).has
      .coverage
  ).toBe(true)
  expect(detectTests(facts(["package.json"], { "package.json": pkg({}) })).has.coverage).toBe(false)
})

test("detects CI running the test suite", () => {
  const withTests = detectTests(
    facts([".github/workflows/ci.yml"], { ".github/workflows/ci.yml": "steps:\n  - run: bun run test\n" })
  )
  expect(withTests.has.ciRunsTests).toBe(true)

  const withoutTests = detectTests(
    facts([".github/workflows/ci.yml"], { ".github/workflows/ci.yml": "steps:\n  - run: bun run lint\n" })
  )
  expect(withoutTests.has.ciRunsTests).toBe(false)
})
