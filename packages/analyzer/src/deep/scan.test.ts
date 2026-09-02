import { expect, test } from "bun:test"
import type { RepoProfile, SignalId } from "../types"
import { applyVerdicts } from "./scan"
import type { SignalVerdict } from "./signals"

function profileWith(
  has: Partial<Record<SignalId, boolean | null>>
): RepoProfile {
  return { has: has as Record<SignalId, boolean | null> } as RepoProfile
}

const seen = (
  signal: string,
  patterns: [string, "most" | "some" | "few"][]
): SignalVerdict => ({
  signal,
  applicable: true,
  patterns: patterns.map(([pattern, reach]) => ({
    pattern,
    path: `src/${pattern}.ts`,
    reach,
  })),
  reason: "what I saw",
})

const nothingOfTheKind = (signal: string): SignalVerdict => ({
  signal,
  applicable: false,
  patterns: [],
  reason: "no handlers here",
})

test("one way of doing it fills the signal in as a pass", () => {
  const out = applyVerdicts(profileWith({ consistentErrors: null }), [
    seen("consistentErrors", [["result objects", "most"]]),
  ])
  expect(out.has.consistentErrors).toBe(true)
})

test("two competing mainstream patterns fill it in as a fail", () => {
  const out = applyVerdicts(profileWith({ consistentErrors: null }), [
    seen("consistentErrors", [
      ["thrown errors", "most"],
      ["returned nulls", "most"],
    ]),
  ])
  expect(out.has.consistentErrors).toBe(false)
})

test("one dominant pattern with stragglers is still a pass", () => {
  const out = applyVerdicts(profileWith({ consistentErrors: null }), [
    seen("consistentErrors", [
      ["result objects", "most"],
      ["thrown errors", "few"],
    ]),
  ])
  expect(out.has.consistentErrors).toBe(true)
})

test("several patterns with no dominant one is a fail", () => {
  const out = applyVerdicts(profileWith({ consistentErrors: null }), [
    seen("consistentErrors", [
      ["a", "some"],
      ["b", "some"],
      ["c", "few"],
    ]),
  ])
  expect(out.has.consistentErrors).toBe(false)
})

test("a repository with nothing of the kind leaves the signal null", () => {
  const out = applyVerdicts(profileWith({ consistentRouteShape: null }), [
    nothingOfTheKind("consistentRouteShape"),
  ])
  expect(out.has.consistentRouteShape).toBeNull()
})

test("an applicable signal with no patterns observed leaves it null", () => {
  const out = applyVerdicts(profileWith({ consistentErrors: null }), [
    seen("consistentErrors", []),
  ])
  expect(out.has.consistentErrors).toBeNull()
})

test("signals the static pass already settled are never overwritten", () => {
  const out = applyVerdicts(
    profileWith({ readme: true, consistentErrors: null }),
    [seen("consistentErrors", [["one way", "most"]])]
  )
  expect(out.has.readme).toBe(true)
})

test("applying verdicts does not mutate the original profile", () => {
  const original = profileWith({ consistentErrors: null })
  applyVerdicts(original, [seen("consistentErrors", [["one way", "most"]])])
  expect(original.has.consistentErrors).toBeNull()
})
