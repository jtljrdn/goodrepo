import { describe, expect, test } from "bun:test"
import {
  DAILY_RUNS_PER_ACCOUNT,
  MONTHLY_RUNS_TOTAL,
  decideClaim,
  parseCeiling,
  type RunCounts,
} from "./quota"

const under: RunCounts = { monthRuns: 0, dayRuns: 0, alreadyRan: false }

describe("decideClaim", () => {
  test("lets a fresh account through", () => {
    expect(decideClaim(under)).toEqual({ allowed: true })
  })

  test("allows the last run under each limit", () => {
    expect(
      decideClaim({ ...under, dayRuns: DAILY_RUNS_PER_ACCOUNT - 1 })
    ).toEqual({ allowed: true })
    expect(
      decideClaim({ ...under, monthRuns: MONTHLY_RUNS_TOTAL - 1 })
    ).toEqual({ allowed: true })
  })

  test("refuses on the run that would exceed each limit", () => {
    expect(decideClaim({ ...under, dayRuns: DAILY_RUNS_PER_ACCOUNT })).toEqual({
      allowed: false,
      reason: "daily",
    })
    expect(decideClaim({ ...under, monthRuns: MONTHLY_RUNS_TOTAL })).toEqual({
      allowed: false,
      reason: "monthly",
    })
  })

  test("re-reading a commit you already ran is free at any limit", () => {
    expect(
      decideClaim({
        monthRuns: MONTHLY_RUNS_TOTAL,
        dayRuns: DAILY_RUNS_PER_ACCOUNT,
        alreadyRan: true,
      })
    ).toEqual({ allowed: true })
  })

  test("names the site-wide ceiling ahead of the personal one", () => {
    expect(
      decideClaim({
        monthRuns: MONTHLY_RUNS_TOTAL,
        dayRuns: DAILY_RUNS_PER_ACCOUNT,
        alreadyRan: false,
      })
    ).toEqual({ allowed: false, reason: "monthly" })
  })

  test("the monthly ceiling stays above a single account's month", () => {
    expect(MONTHLY_RUNS_TOTAL).toBeGreaterThan(DAILY_RUNS_PER_ACCOUNT * 31)
  })
})

describe("parseCeiling", () => {
  test("reads a whole count", () => {
    expect(parseCeiling("250")).toBe(250)
  })

  test("allows zero, which is how deep scans are stopped without a deploy", () => {
    expect(parseCeiling("0")).toBe(0)
  })

  test("falls back when unset or blank", () => {
    expect(parseCeiling(undefined)).toBeNull()
    expect(parseCeiling("")).toBeNull()
    expect(parseCeiling("   ")).toBeNull()
  })

  test("falls back rather than yielding NaN, which would remove the ceiling", () => {
    for (const bad of ["abc", "70o", "1e", "Infinity"]) {
      expect(parseCeiling(bad)).toBeNull()
    }
  })

  test("rejects negatives and fractions", () => {
    expect(parseCeiling("-5")).toBeNull()
    expect(parseCeiling("12.5")).toBeNull()
  })
})
