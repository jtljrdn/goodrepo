import { expect, test } from "bun:test"
import { failureMessage, readSha } from "@/lib/scan"

test("no failure blames the user or leaks the word error", () => {
  for (const kind of [
    "not-js",
    "not-found",
    "rate-limited",
    "empty",
    "too-large",
  ] as const) {
    expect(failureMessage({ kind, message: "" }).detail, kind).not.toContain(
      "error"
    )
  }
})

test("the not-js message names the supported languages", () => {
  const message = failureMessage({ kind: "not-js", message: "" })
  expect(message.detail).toContain("JavaScript")
  expect(message.detail).toContain("TypeScript")
})

test("only a hex commit prefix is accepted from the url", () => {
  expect(readSha(undefined)).toBeNull()
  expect(readSha("D434AFA")).toBe("d434afa")
  expect(readSha("d434afa837b995d2db6f101e3b705461a250c655")).toBe(
    "d434afa837b995d2db6f101e3b705461a250c655"
  )
  expect(readSha("main")).toBe("invalid")
  expect(readSha("../other")).toBe("invalid")
  expect(readSha(["abc1234", "def5678"])).toBe("invalid")
})
