import { expect, test } from "bun:test"
import { normalizeVerificationRef, parseSelectedIds } from "@/lib/fix-input"

const SHA = "a".repeat(40)

test("verification refs accept only a full SHA or matching GitHub commit URL", () => {
  expect(normalizeVerificationRef("", "acme", "app")).toBeNull()
  expect(normalizeVerificationRef(SHA.toUpperCase(), "acme", "app")).toBe(SHA)
  expect(
    normalizeVerificationRef(
      `https://github.com/acme/app/commit/${SHA}`,
      "acme",
      "app"
    )
  ).toBe(SHA)
  for (const value of [
    "main",
    "abc1234",
    `https://evil.test/acme/app/commit/${SHA}`,
    `https://github.com/other/app/commit/${SHA}`,
    `https://github.com/acme/app/tree/${SHA}`,
  ])
    expect(normalizeVerificationRef(value, "acme", "app")).toBe("invalid")
})

test("selected IDs are known, unique and bounded", () => {
  expect(parseSelectedIds(["readme", "testScript"])).toEqual([
    "readme",
    "testScript",
  ])
  expect(parseSelectedIds([])).toBeNull()
  expect(parseSelectedIds(["readme", "readme"])).toBeNull()
  expect(parseSelectedIds(["unknown"])).toBeNull()
})
