import { expect, test } from "bun:test"
import { relativeDays } from "@/lib/when"

const now = new Date("2026-09-02T12:00:00Z")
const ago = (ms: number) => new Date(now.getTime() - ms)
const days = (n: number) => ago(n * 86_400_000)

test("anything under a day reads as today", () => {
  expect(relativeDays(now, now)).toBe("today")
  expect(relativeDays(ago(23 * 3_600_000), now)).toBe("today")
})

test("a clock skewed into the future does not read as negative", () => {
  expect(relativeDays(new Date(now.getTime() + 5_000), now)).toBe("today")
})

test("counts whole days, then months", () => {
  expect(relativeDays(days(1), now)).toBe("yesterday")
  expect(relativeDays(days(3), now)).toBe("3 days ago")
  expect(relativeDays(days(29), now)).toBe("29 days ago")
  expect(relativeDays(days(30), now)).toBe("a month ago")
  expect(relativeDays(days(75), now)).toBe("2 months ago")
})
