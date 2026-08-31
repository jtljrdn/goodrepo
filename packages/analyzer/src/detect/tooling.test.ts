import { expect, test } from "bun:test"
import { detectTooling } from "./tooling"
import type { RawFacts } from "../types"

function facts(paths: string[]): RawFacts {
  return { paths, codeFiles: [], keptText: new Map(), filesRead: 0, truncated: null }
}

test("detects lint config in any supported form", () => {
  expect(detectTooling(facts(["eslint.config.js"])).has.lintConfig).toBe(true)
  expect(detectTooling(facts([".eslintrc.json"])).has.lintConfig).toBe(true)
  expect(detectTooling(facts(["biome.json"])).has.lintConfig).toBe(true)
  expect(detectTooling(facts(["README.md"])).has.lintConfig).toBe(false)
})

test("detects env templates", () => {
  expect(detectTooling(facts([".env.example"])).has.envExample).toBe(true)
  expect(detectTooling(facts([".env.sample"])).has.envExample).toBe(true)
  expect(detectTooling(facts([".env"])).has.envExample).toBe(false)
})

test("detects containers and CI", () => {
  expect(detectTooling(facts(["Dockerfile"])).has.container).toBe(true)
  expect(detectTooling(facts([".devcontainer/devcontainer.json"])).has.container).toBe(true)
  expect(detectTooling(facts([".github/workflows/ci.yml"])).has.ciWorkflow).toBe(true)
  expect(detectTooling(facts([".github/ISSUE_TEMPLATE/bug.yml"])).has.ciWorkflow).toBe(false)
})
