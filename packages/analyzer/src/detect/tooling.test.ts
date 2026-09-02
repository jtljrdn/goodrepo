import { expect, test } from "bun:test"
import { detectTooling } from "./tooling"
import type { CodeFileFacts, RawFacts } from "../types"

function facts(paths: string[], codeFiles: CodeFileFacts[] = []): RawFacts {
  return {
    paths,
    codeFiles,
    keptText: new Map(),
    sample: null,
    truncated: null,
  }
}

test("detects lint config in any supported form", () => {
  expect(detectTooling(facts(["eslint.config.js"]), false).has.lintConfig).toBe(
    true
  )
  expect(detectTooling(facts([".eslintrc.json"]), false).has.lintConfig).toBe(
    true
  )
  expect(detectTooling(facts(["biome.json"]), false).has.lintConfig).toBe(true)
  expect(detectTooling(facts(["README.md"]), false).has.lintConfig).toBe(false)
})

test("detects env templates", () => {
  expect(detectTooling(facts([".env.example"]), false).has.envExample).toBe(
    true
  )
  expect(detectTooling(facts([".env.sample"]), false).has.envExample).toBe(true)
  expect(detectTooling(facts([".env"]), false).has.envExample).toBe(false)
})

test("detects containers and CI", () => {
  expect(detectTooling(facts(["Dockerfile"]), false).has.container).toBe(true)
  expect(
    detectTooling(facts([".devcontainer/devcontainer.json"]), false).has
      .container
  ).toBe(true)
  expect(
    detectTooling(facts([".github/workflows/ci.yml"]), false).has.ciWorkflow
  ).toBe(true)
  expect(
    detectTooling(facts([".github/ISSUE_TEMPLATE/bug.yml"]), false).has
      .ciWorkflow
  ).toBe(false)
})

test("a container does not apply to a library", () => {
  expect(detectTooling(facts(["README.md"]), true).has.container).toBeNull()
  expect(detectTooling(facts(["README.md"]), false).has.container).toBe(false)
})

test("an env template does not apply when sampled code never reads the environment", () => {
  const reads: CodeFileFacts = {
    path: "a.ts",
    bytes: 1,
    imports: [],
    readsEnv: true,
  }
  const silent: CodeFileFacts = {
    path: "b.ts",
    bytes: 1,
    imports: [],
    readsEnv: false,
  }
  expect(detectTooling(facts(["a.ts"], [reads]), false).has.envExample).toBe(
    false
  )
  expect(
    detectTooling(facts(["b.ts"], [silent]), false).has.envExample
  ).toBeNull()
  expect(
    detectTooling(facts([".env.example", "b.ts"], [silent]), false).has
      .envExample
  ).toBe(true)
})
