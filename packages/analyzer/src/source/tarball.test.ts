import { expect, test } from "bun:test"
import { classifyRepo, stripArchivePrefix } from "./tarball"

test("strips the owner-repo-sha archive prefix", () => {
  expect(stripArchivePrefix("vercel-next.js-d434afa/package.json")).toBe("package.json")
  expect(stripArchivePrefix("vercel-next.js-d434afa/src/app/page.tsx")).toBe("src/app/page.tsx")
  expect(stripArchivePrefix("vercel-next.js-d434afa/")).toBe("")
})

test("accepts a repository with package.json at the root", () => {
  expect(classifyRepo(["package.json", "README.md", "src"])).toBeNull()
})

test("accepts a monorepo whose root has package.json and workspaces", () => {
  expect(classifyRepo(["package.json", "turbo.json", "apps", "packages"])).toBeNull()
})

test("refuses a repository with no root package.json", () => {
  const result = classifyRepo(["pyproject.toml", "README.md", "src"])
  expect(result?.kind).toBe("not-js")
  expect(result?.message).toContain("JavaScript")
})

test("refuses an empty repository", () => {
  expect(classifyRepo([])?.kind).toBe("empty")
})
