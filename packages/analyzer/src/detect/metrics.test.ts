import { expect, test } from "bun:test"
import { detectMetrics } from "./metrics"
import type { CodeFileFacts, RawFacts } from "../types"

function facts(files: [string, number][]): RawFacts {
  const codeFiles: CodeFileFacts[] = files.map(([path, lines]) => ({ path, lines, imports: [] }))
  return { paths: files.map(([p]) => p), codeFiles, keptText: new Map(), filesRead: 0, truncated: null }
}

test("computes the median of an odd and an even set", () => {
  expect(detectMetrics(facts([["a.ts", 10], ["b.ts", 20], ["c.ts", 30]])).medianFileLoc).toBe(20)
  expect(detectMetrics(facts([["a.ts", 10], ["b.ts", 20]])).medianFileLoc).toBe(15)
})

test("applies the median threshold at the boundary", () => {
  expect(detectMetrics(facts([["a.ts", 300]])).has.smallFiles).toBe(true)
  expect(detectMetrics(facts([["a.ts", 301]])).has.smallFiles).toBe(false)
})

test("applies the largest-file threshold at the boundary", () => {
  expect(detectMetrics(facts([["a.ts", 1500]])).has.noMegaFiles).toBe(true)
  expect(detectMetrics(facts([["a.ts", 1501]])).has.noMegaFiles).toBe(false)
})

test("reports total lines and the largest file", () => {
  const result = detectMetrics(facts([["a.ts", 10], ["b.ts", 40]]))
  expect(result.linesOfCode).toBe(50)
  expect(result.largestFileLoc).toBe(40)
})

test("passes consistentNaming when one casing dominates", () => {
  const kebab = detectMetrics(
    facts([["a-b.ts", 1], ["c-d.ts", 1], ["e-f.ts", 1], ["g-h.ts", 1], ["i-j.ts", 1], ["k-l.ts", 1], ["m-n.ts", 1], ["o-p.ts", 1], ["q-r.ts", 1], ["sT.ts", 1]])
  )
  expect(kebab.measurements.consistentNaming?.value).toBeCloseTo(0.9, 2)
  expect(kebab.has.consistentNaming).toBe(true)
})

test("fails consistentNaming when casing is mixed", () => {
  const mixed = detectMetrics(facts([["a-b.ts", 1], ["CdE.ts", 1], ["fGh.ts", 1], ["i_j.ts", 1]]))
  expect(mixed.has.consistentNaming).toBe(false)
})

test("an empty repository does not divide by zero and is not scored", () => {
  const empty = detectMetrics(facts([]))
  expect(empty.medianFileLoc).toBe(0)
  expect(empty.has.smallFiles).toBeNull()
})

test("lowercase and kebab-case are one convention, not two", () => {
  // honojs/hono: 337 single-word lowercase files, 47 hyphenated. Splitting them
  // scored 87.8% and failed a repository that is entirely consistent.
  const mixed = detectMetrics(facts([["context.ts", 1], ["serve-static.ts", 1], ["hono.ts", 1]]))
  expect(mixed.measurements.consistentNaming?.value).toBe(1)
  expect(mixed.has.consistentNaming).toBe(true)
})
