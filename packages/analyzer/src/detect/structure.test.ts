import { expect, test } from "bun:test"
import { detectStructure } from "./structure"
import type { CodeFileFacts, RawFacts } from "../types"

function facts(paths: string[]): RawFacts {
  const codeFiles: CodeFileFacts[] = paths
    .filter((p) => /\.[cm]?[jt]sx?$/.test(p))
    .map((path) => ({ path, bytes: 100, imports: [] }))
  return { paths, codeFiles, keptText: new Map(), sample: null, truncated: null }
}

test("passes predictableRoot when most code sits under one top-level folder", () => {
  const result = detectStructure(facts(["src/a.ts", "src/b.ts", "src/c.ts", "src/d.ts", "scripts/e.ts"]))
  expect(result.has.predictableRoot).toBe(true)
  expect(result.measurements.predictableRoot?.value).toBeCloseTo(0.8, 2)
})

test("fails predictableRoot when code is scattered across top-level folders", () => {
  expect(detectStructure(facts(["a/x.ts", "b/y.ts", "c/z.ts", "d/w.ts"])).has.predictableRoot).toBe(false)
})

test("measures depth and applies the threshold at the boundary", () => {
  expect(detectStructure(facts(["a/b/c/d/e/f/g.ts"])).has.shallowTree).toBe(true)
  expect(detectStructure(facts(["a/b/c/d/e/f/g/h.ts"])).has.shallowTree).toBe(false)
})

test("passes colocatedTests when tests sit beside their source", () => {
  const result = detectStructure(facts(["src/a.ts", "src/a.test.ts", "src/b.ts", "src/b.test.ts"]))
  expect(result.has.colocatedTests).toBe(true)
})

test("fails colocatedTests when tests live in a distant tree", () => {
  const result = detectStructure(facts(["src/a.ts", "src/b.ts", "test/unit/a.test.ts", "test/unit/b.test.ts"]))
  expect(result.has.colocatedTests).toBe(false)
})

test("a __tests__ sibling counts as colocated", () => {
  const result = detectStructure(facts(["src/a.ts", "src/__tests__/a.ts"]))
  expect(result.has.colocatedTests).toBe(true)
})

test("fails generatedExcluded when build output is committed", () => {
  expect(detectStructure(facts(["src/a.ts", "dist/a.js"])).has.generatedExcluded).toBe(false)
  expect(detectStructure(facts(["src/a.ts"])).has.generatedExcluded).toBe(true)
})

test("a build/ directory holding source is not treated as build output", () => {
  expect(detectStructure(facts(["src/a.ts", "build/build.ts"])).has.generatedExcluded).toBe(true)
  expect(detectStructure(facts(["src/a.ts", "out/page.ts"])).has.generatedExcluded).toBe(true)
})

test("featureFolders looks only at the source root's immediate children", () => {
  const byDomain = detectStructure(
    facts(["src/auth/a.ts", "src/billing/b.ts", "src/dashboard/c.ts", "src/components/d.ts", "src/lib/e.ts"])
  )
  expect(byDomain.has.featureFolders).toBe(true)
  expect(byDomain.measurements.featureFolders?.value).toBeCloseTo(0.4, 2)

  const byType = detectStructure(
    facts(["src/components/a.ts", "src/hooks/b.ts", "src/utils/c.ts", "src/types/d.ts", "src/services/e.ts"])
  )
  expect(byType.has.featureFolders).toBe(false)
  expect(byType.measurements.featureFolders?.value).toBeCloseTo(1, 2)
})
