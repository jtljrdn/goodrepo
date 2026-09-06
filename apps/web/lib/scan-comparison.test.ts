import { expect, test } from "bun:test"
import type { SignalId } from "@/lib/profile"
import { compareSnapshots } from "@/lib/scan-comparison"
import type { ScanSnapshot, SnapshotSignal } from "@/lib/scan-snapshot"

const signal = (
  id: SignalId,
  status: SnapshotSignal["status"],
  value?: number
): SnapshotSignal => ({
  id,
  subject: id,
  status,
  points: 10,
  finding: `${id} ${status}`,
  measurement:
    value === undefined
      ? null
      : { value, threshold: 1, unit: "files", direction: "atMost" },
  unmeasuredReason: status === "not-measured" ? "not-inspected" : null,
})

function snapshot(
  sha: string,
  signals: SnapshotSignal[],
  options: Partial<ScanSnapshot> = {}
): ScanSnapshot {
  const measured = signals.filter((item) => item.status !== "not-measured")
  const earned = measured.filter((item) => item.status === "pass").length * 10
  const total = measured.length * 10
  return {
    id: sha,
    userId: "user",
    repositoryId: "repo-1",
    owner: "acme",
    repo: "app",
    commitSha: sha.padEnd(40, "0").slice(0, 40),
    mode: "public",
    analysisVersion: "quick-v6",
    schemaVersion: 1,
    observedAt: new Date("2026-09-06T00:00:00Z"),
    payload: {
      schemaVersion: 1,
      overall: total ? Math.round((earned / total) * 100) : null,
      categories: [
        {
          key: "discoverability",
          name: "Discoverability",
          score: total ? Math.round((earned / total) * 100) : null,
          earnedPoints: earned,
          totalPoints: total,
          signals,
        },
      ],
      coverage: {
        sample: { sampled: 2, total: 2 },
        config: { read: 1, total: 1 },
        truncated: null,
      },
    },
    ...options,
  }
}

test("classifies every measured and coverage transition", () => {
  const before = snapshot("a", [
    signal("readme", "fail"),
    signal("readmeDepth", "pass"),
    signal("predictableRoot", "fail", 2),
    signal("shallowTree", "pass"),
    signal("colocatedTests", "not-measured"),
    signal("generatedExcluded", "pass"),
  ])
  const after = snapshot("b", [
    signal("readme", "pass"),
    signal("readmeDepth", "fail"),
    signal("predictableRoot", "fail", 3),
    signal("shallowTree", "pass"),
    signal("colocatedTests", "pass"),
    signal("generatedExcluded", "not-measured"),
  ])
  const result = compareSnapshots(before, after)
  expect(result.signals.map((item) => item.transition)).toEqual([
    "now-passing",
    "now-failing",
    "still-failing",
    "still-passing",
    "newly-measured",
    "no-longer-measured",
  ])
  expect(result.signals[2]?.measurementChanged).toBe(true)
  expect(result.counts).toEqual({
    nowPassing: 1,
    nowFailing: 1,
    coverageChanged: 2,
  })
  expect(result.pointsDelta).toBeNull()
})

test("only reports score deltas for compatible measured sets and coverage", () => {
  const before = snapshot("a", [signal("readme", "fail")])
  const after = snapshot("b", [signal("readme", "pass")])
  expect(compareSnapshots(before, after).pointsDelta).toBe(100)

  after.payload.coverage.sample = { sampled: 1, total: 2 }
  expect(compareSnapshots(before, after).pointsDelta).toBeNull()
})

test("changed versions, modes, repositories and missing signals are not comparable", () => {
  const before = snapshot("a", [signal("readme", "fail")])
  const cases = [
    snapshot("b", [signal("readme", "pass")], { analysisVersion: "next" }),
    snapshot("b", [signal("readme", "pass")], { mode: "private" }),
    snapshot("b", [signal("readme", "pass")], { repositoryId: "repo-2" }),
    snapshot("b", [signal("readmeDepth", "pass")]),
  ]
  for (const target of cases) {
    const result = compareSnapshots(before, target)
    expect(result.pointsDelta).toBeNull()
    expect(
      result.signals.some((item) => item.transition === "not-comparable")
    ).toBe(true)
  }
})

test("same and reverse commit comparisons label identity without assuming ancestry", () => {
  const before = snapshot("b", [signal("readme", "fail")])
  expect(compareSnapshots(before, before).sameCommit).toBe(true)
  expect(
    compareSnapshots(before, snapshot("a", [signal("readme", "pass")]))
      .sameCommit
  ).toBe(false)
})
