import { expect, test } from "bun:test"
import { classifyRepo, isFailure } from "./github"
import type { TreeEntry } from "../types"

const tree = (...paths: string[]): TreeEntry[] => paths.map((path) => ({ path, bytes: 10 }))

test("accepts a repository with package.json at the root", () => {
  expect(classifyRepo(tree("package.json", "README.md", "src/a.ts"))).toBeNull()
})

test("accepts a monorepo whose root has package.json", () => {
  expect(classifyRepo(tree("package.json", "turbo.json", "apps/web/package.json"))).toBeNull()
})

test("a nested package.json alone is not enough", () => {
  expect(classifyRepo(tree("apps/web/package.json", "README.md"))?.kind).toBe("not-js")
})

test("refuses a repository with no root package.json", () => {
  const result = classifyRepo(tree("pyproject.toml", "README.md", "src/main.py"))
  expect(result?.kind).toBe("not-js")
  expect(result?.message).toContain("JavaScript")
})

test("refuses an empty repository", () => {
  expect(classifyRepo([])?.kind).toBe("empty")
})

test("isFailure distinguishes a failure from a result", () => {
  expect(isFailure({ kind: "empty", message: "x" })).toBe(true)
  expect(isFailure({ entries: [], sha: "a", truncated: false })).toBe(false)
})
