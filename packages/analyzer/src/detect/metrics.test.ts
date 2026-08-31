import { expect, test } from "bun:test"
import { detectMetrics } from "./metrics"
import type { CodeFileFacts, RawFacts } from "../types"

function facts(files: [string, number][]): RawFacts {
  const codeFiles: CodeFileFacts[] = files.map(([path, bytes]) => ({ path, bytes, imports: [] }))
  return { paths: files.map(([p]) => p), codeFiles, keptText: new Map(), sample: null, truncated: null }
}

test("computes the median of an odd and an even set", () => {
  expect(detectMetrics(facts([["a.ts", 10], ["b.ts", 20], ["c.ts", 30]])).medianFileBytes).toBe(20)
  expect(detectMetrics(facts([["a.ts", 10], ["b.ts", 20]])).medianFileBytes).toBe(15)
})

test("applies the median byte threshold at the boundary", () => {
  expect(detectMetrics(facts([["a.ts", 10_000]])).has.smallFiles).toBe(true)
  expect(detectMetrics(facts([["a.ts", 10_001]])).has.smallFiles).toBe(false)
})

test("applies the largest-file byte threshold at the boundary", () => {
  expect(detectMetrics(facts([["a.ts", 50_000]])).has.noMegaFiles).toBe(true)
  expect(detectMetrics(facts([["a.ts", 50_001]])).has.noMegaFiles).toBe(false)
})

test("reports total bytes and the largest file", () => {
  const result = detectMetrics(facts([["a.ts", 10], ["b.ts", 40]]))
  expect(result.totalBytes).toBe(50)
  expect(result.largestFileBytes).toBe(40)
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
  expect(empty.medianFileBytes).toBe(0)
  expect(empty.has.smallFiles).toBeNull()
})

test("lowercase and kebab-case are one convention, not two", () => {
  const mixed = detectMetrics(facts([["context.ts", 1], ["serve-static.ts", 1], ["hono.ts", 1]]))
  expect(mixed.measurements.consistentNaming?.value).toBe(1)
  expect(mixed.has.consistentNaming).toBe(true)
})
