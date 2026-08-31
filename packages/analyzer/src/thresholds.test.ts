import { expect, test } from "bun:test"
import { CAPS, passes, THRESHOLDS } from "./thresholds"

test("passes respects each direction at the boundary", () => {
  expect(passes("readmeWords", 300)).toBe(true)
  expect(passes("readmeWords", 299)).toBe(false)

  expect(passes("maxDepth", 7)).toBe(true)
  expect(passes("maxDepth", 8)).toBe(false)

  expect(passes("typeNamedFolders", 0.49)).toBe(true)
  expect(passes("typeNamedFolders", 0.5)).toBe(false)
})

test("caps clear the largest example repository", () => {
  // vercel/next.js measured 2026-08-31: 50.7MB compressed, ~20,900 code files
  expect(CAPS.downloadBytes).toBeGreaterThan(50.7 * 1024 * 1024)
  expect(CAPS.filesRead).toBeGreaterThan(20_900)
})

test("every threshold declares a unit and a direction", () => {
  for (const [key, t] of Object.entries(THRESHOLDS)) {
    expect(t.unit, key).toBeTruthy()
    expect(["atLeast", "atMost", "lessThan"], key).toContain(t.direction)
  }
})
