import { expect, test } from "bun:test"
import { classifyRepo } from "./github"
import type { TreeEntry } from "../types"

const tree = (...paths: string[]): TreeEntry[] =>
  paths.map((path) => ({ path, bytes: 10 }))

test("accepts a repository with package.json at the root", () => {
  expect(classifyRepo(tree("package.json", "README.md", "src/a.ts"))).toBeNull()
})

test("a nested package.json alone is not enough", () => {
  expect(classifyRepo(tree("apps/web/package.json", "README.md"))?.kind).toBe(
    "not-js"
  )
})

test("refuses a repository with no root package.json", () => {
  const result = classifyRepo(
    tree("pyproject.toml", "README.md", "src/main.py")
  )
  expect(result?.kind).toBe("not-js")
  expect(result?.message).toContain("JavaScript")
})

test("refuses an empty repository", () => {
  expect(classifyRepo([])?.kind).toBe("empty")
})
