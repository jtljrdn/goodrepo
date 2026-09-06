import { expect, test } from "bun:test"
import { detectTests } from "./tests"
import type { RawFacts } from "../types"

function facts(paths: string[], kept: Record<string, string> = {}): RawFacts {
  return {
    paths,
    codeFiles: [],
    keptText: new Map(Object.entries(kept)),
    sample: null,
    truncated: null,
  }
}

const pkg = (body: object) => JSON.stringify(body)

test("detects a test script and framework config", () => {
  const result = detectTests(
    facts(["package.json", "vitest.config.ts"], {
      "package.json": pkg({ scripts: { test: "vitest run" } }),
    })
  )
  expect(result.has.testScript).toBe(true)
  expect(result.has.testConfig).toBe(true)
  expect(result.testFramework).toBe("vitest")
})

test("a runner named in the test script counts as a framework, config or not", () => {
  const result = detectTests(
    facts(["package.json"], {
      "package.json": pkg({ scripts: { test: "bun test" } }),
    })
  )
  expect(result.has.testConfig).toBe(true)
  expect(result.testFramework).toBe("bun")

  const bare = detectTests(
    facts(["package.json"], {
      "package.json": pkg({ scripts: { test: "echo no tests" } }),
    })
  )
  expect(bare.has.testConfig).toBe(false)
  expect(bare.testFramework).toBeNull()
})

test("counts test files", () => {
  const result = detectTests(
    facts(["src/a.test.ts", "src/__tests__/b.ts", "src/c.ts"])
  )
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
    detectTests(
      facts(["package.json", "src/a.test.ts"], {
        "package.json": pkg({
          scripts: { "test:coverage": "vitest --coverage" },
        }),
      })
    ).has.coverage
  ).toBe(true)
  expect(
    detectTests(
      facts(["vitest.config.ts", "src/a.test.ts"], {
        "vitest.config.ts": "export default { test: { coverage: {} } }",
      })
    ).has.coverage
  ).toBe(true)
  expect(
    detectTests(
      facts(["package.json", "src/a.test.ts"], { "package.json": pkg({}) })
    ).has.coverage
  ).toBe(false)
})

test("coverage does not apply when there are no tests to cover", () => {
  expect(
    detectTests(facts(["package.json"], { "package.json": pkg({}) })).has
      .coverage
  ).toBeNull()
})

test("ciRunsTests does not apply when there is no workflow to read", () => {
  expect(detectTests(facts(["src/a.test.ts"])).has.ciRunsTests).toBeNull()
})

test("detects CI running the test suite", () => {
  const withTests = detectTests(
    facts([".github/workflows/ci.yml"], {
      ".github/workflows/ci.yml": "steps:\n  - run: bun run test\n",
    })
  )
  expect(withTests.has.ciRunsTests).toBe(true)

  const withoutTests = detectTests(
    facts([".github/workflows/ci.yml"], {
      ".github/workflows/ci.yml": "steps:\n  - run: bun run lint\n",
    })
  )
  expect(withoutTests.has.ciRunsTests).toBe(false)
})

test("a root test script that only delegates to workspaces is not scored for a framework", () => {
  const result = detectTests(
    facts(["package.json"], {
      "package.json": pkg({ scripts: { test: "turbo run test" } }),
    })
  )
  expect(result.has.testConfig).toBeNull()
  expect(result.testFramework).toBeNull()
})

test("placeholder scripts and generated test files do not establish tests", () => {
  const input = facts(
    ["package.json", "dist/a.test.js", "node_modules/pkg/tests/a.js"],
    {
      "package.json": pkg({
        scripts: { test: 'echo "Error: no test specified" && exit 1' },
      }),
    }
  )
  const result = detectTests(input)
  expect(result.has.testScript).toBe(false)
  expect(result.testFiles).toBe(0)
})

test("CI comments, step names, echoes and disabled steps do not run tests", () => {
  const input = facts([".github/workflows/ci.yml"], {
    ".github/workflows/ci.yml": `# npm test
jobs:
  build:
    steps:
      - name: npm test
        run: echo "npm test"
      - if: false
        run: bun test
      - run: npm run build
`,
  })
  expect(detectTests(input).has.ciRunsTests).toBe(false)
})

test("CI follows script aliases but rejects cycles and placeholder targets", () => {
  const workflow = "jobs:\n  test:\n    steps:\n      - run: npm run verify\n"
  const input = (scripts: Record<string, string>) =>
    facts(["package.json", ".github/workflows/ci.yml"], {
      "package.json": pkg({ scripts }),
      ".github/workflows/ci.yml": workflow,
    })
  expect(
    detectTests(input({ verify: "npm run test", test: "vitest run" })).has
      .ciRunsTests
  ).toBe(true)
  expect(detectTests(input({ verify: "npm run verify" })).has.ciRunsTests).toBe(
    false
  )
  expect(
    detectTests(input({ verify: 'echo "vitest run"' })).has.ciRunsTests
  ).toBe(false)
})

test("malformed and reusable workflows are unresolved instead of absent tests", () => {
  for (const workflow of [
    "jobs: [",
    "jobs:\n  tests:\n    uses: org/repo/.github/workflows/test.yml@main\n",
  ]) {
    expect(
      detectTests(
        facts([".github/workflows/ci.yml"], {
          ".github/workflows/ci.yml": workflow,
        })
      ).has.ciRunsTests
    ).toBeNull()
  }
})

test("CI resolves scripts in the step working directory", () => {
  const input = facts(
    ["package.json", "apps/web/package.json", ".github/workflows/ci.yml"],
    {
      "package.json": pkg({ scripts: { test: 'echo "no tests"' } }),
      "apps/web/package.json": pkg({ scripts: { verify: "vitest run" } }),
      ".github/workflows/ci.yml":
        "jobs:\n  check:\n    steps:\n      - working-directory: apps/web\n        run: npm run verify\n",
    }
  )
  expect(detectTests(input).has.ciRunsTests).toBe(true)
  input.keptText.delete("apps/web/package.json")
  expect(detectTests(input).has.ciRunsTests).toBeNull()
})
