import { expect, test } from "bun:test"
import { CAPS, passes, THRESHOLDS } from "./thresholds"

test("passes respects each direction at the boundary", () => {
  expect(passes("readmeWords", 300)).toBe(true)
  expect(passes("readmeWords", 299)).toBe(false)

  expect(passes("maxDepth", 7)).toBe(true)
  expect(passes("maxDepth", 8)).toBe(false)

  expect(passes("typeNamedFolders", 0.49)).toBe(true)
  expect(passes("typeNamedFolders", 0.5)).toBe(false)

  expect(passes("medianFileBytes", 10_000)).toBe(true)
  expect(passes("medianFileBytes", 10_001)).toBe(false)
})

test("caps bound what a single scan fetches", () => {
  // The scan never downloads a repository. It reads the tree, then fetches a
  // bounded sample, so cost is capped by these numbers rather than repo size.
  expect(CAPS.importSample).toBeLessThanOrEqual(500)
  expect(CAPS.configFiles).toBeLessThanOrEqual(100)
  expect(CAPS.perFileBytes).toBeLessThanOrEqual(4 * 1024 * 1024)
})

test("every threshold declares a unit and a direction", () => {
  for (const [key, t] of Object.entries(THRESHOLDS)) {
    expect(t.unit, key).toBeTruthy()
    expect(["atLeast", "atMost", "lessThan"], key).toContain(t.direction)
  }
})
