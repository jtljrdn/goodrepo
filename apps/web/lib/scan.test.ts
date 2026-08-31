import { expect, test } from "bun:test"
import { failureMessage } from "@/lib/scan"

test("no failure blames the user or leaks the word error", () => {
  for (const kind of ["not-js", "not-found", "rate-limited", "empty", "too-large"] as const) {
    expect(failureMessage({ kind, message: "" }).detail, kind).not.toContain("error")
  }
})

test("the not-js message names the supported languages", () => {
  const message = failureMessage({ kind: "not-js", message: "" })
  expect(message.detail).toContain("JavaScript")
  expect(message.detail).toContain("TypeScript")
})
