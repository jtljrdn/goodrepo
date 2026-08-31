import { expect, test } from "bun:test"
import { passes } from "./thresholds"

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
