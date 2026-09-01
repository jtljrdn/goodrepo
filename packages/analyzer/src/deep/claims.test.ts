import { expect, test } from "bun:test"
import type { Checkout } from "../sandbox"
import { CAPS } from "../thresholds"
import { buildDocPrompt, docPaths } from "./claims"
import { shouldLand } from "./review"

function checkoutOf(paths: string[]): Checkout {
  return {
    entries: paths.map((path) => ({ path, bytes: 1 })),
    read: async (wanted) => new Map(wanted.map((p) => [p, `body of ${p}`])),
    run: async () => ({ stdout: "", exitCode: 0 }),
  }
}

test("docPaths finds documentation and ignores everything else", () => {
  expect(
    docPaths(
      checkoutOf([
        "src/index.ts",
        "README.md",
        "package.json",
        "AGENTS.md",
        "docs/design-notes.md",
        "CONTRIBUTING.md",
      ])
    )
  ).toEqual(["AGENTS.md", "CONTRIBUTING.md", "README.md"])
})

test("docPaths ignores documentation inside generated directories", () => {
  expect(docPaths(checkoutOf(["node_modules/foo/README.md", "dist/README.md", "README.md"]))).toEqual([
    "README.md",
  ])
})

test("docPaths returns nothing for a repository with no documentation", () => {
  expect(docPaths(checkoutOf(["src/index.ts"]))).toEqual([])
})

test("buildDocPrompt labels each document so quotes can be traced back", () => {
  const prompt = buildDocPrompt([
    ["README.md", "the readme"],
    ["AGENTS.md", "the agents file"],
  ])
  expect(prompt).toContain("--- README.md ---")
  expect(prompt).toContain("the readme")
  expect(prompt).toContain("--- AGENTS.md ---")
  expect(prompt.indexOf("README.md")).toBeLessThan(prompt.indexOf("AGENTS.md"))
})

test("buildDocPrompt truncates a document past the cap", () => {
  const prompt = buildDocPrompt([["README.md", "x".repeat(CAPS.deepDocBytes + 500)]])
  expect(prompt.length).toBeLessThan(CAPS.deepDocBytes + 200)
})

test("the agent keeps its tools until the landing window", () => {
  const { deepMaxSteps: max, deepLandingSteps: landing } = CAPS
  expect(shouldLand(0, max, landing)).toBe(false)
  expect(shouldLand(max - landing - 1, max, landing)).toBe(false)
})

test("the agent loses its tools once the landing window starts", () => {
  const { deepMaxSteps: max, deepLandingSteps: landing } = CAPS
  expect(shouldLand(max - landing, max, landing)).toBe(true)
  expect(shouldLand(max, max, landing)).toBe(true)
})
