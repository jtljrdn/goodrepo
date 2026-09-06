import type { SignalId } from "@/lib/profile"
import type {
  ScanSnapshot,
  SnapshotCategory,
  SnapshotSignal,
} from "@/lib/scan-snapshot"

export type Transition =
  | "now-passing"
  | "now-failing"
  | "still-failing"
  | "still-passing"
  | "newly-measured"
  | "no-longer-measured"
  | "not-comparable"

export type SignalComparison = {
  id: SignalId
  transition: Transition
  baseline: SnapshotSignal | null
  target: SnapshotSignal | null
  measurementChanged: boolean
}

export type CategoryComparison = {
  key: string
  name: string
  baselineScore: number | null
  targetScore: number | null
  pointsDelta: number | null
  compatible: boolean
}

export type ScanComparison = {
  comparable: boolean
  sameCommit: boolean
  pointsDelta: number | null
  pointsCompatible: boolean
  signals: SignalComparison[]
  categories: CategoryComparison[]
  counts: { nowPassing: number; nowFailing: number; coverageChanged: number }
}

function coverageKey(snapshot: ScanSnapshot): string {
  return JSON.stringify(snapshot.payload.coverage)
}

function measuredIds(category: SnapshotCategory): string {
  return category.signals
    .filter((signal) => signal.status !== "not-measured")
    .map((signal) => signal.id)
    .sort()
    .join(",")
}

function transition(
  baseline: SnapshotSignal | null,
  target: SnapshotSignal | null,
  compatible: boolean
): Transition {
  if (!compatible || !baseline || !target) return "not-comparable"
  if (baseline.status === "not-measured")
    return target.status === "not-measured"
      ? "not-comparable"
      : "newly-measured"
  if (target.status === "not-measured") return "no-longer-measured"
  if (baseline.status === "fail")
    return target.status === "pass" ? "now-passing" : "still-failing"
  return target.status === "fail" ? "now-failing" : "still-passing"
}

export function compareSnapshots(
  baseline: ScanSnapshot,
  target: ScanSnapshot
): ScanComparison {
  const comparable =
    baseline.repositoryId === target.repositoryId &&
    baseline.mode === target.mode &&
    baseline.analysisVersion === target.analysisVersion &&
    baseline.schemaVersion === target.schemaVersion
  const baseSignals = new Map(
    baseline.payload.categories.flatMap((category) =>
      category.signals.map((signal) => [signal.id, signal] as const)
    )
  )
  const targetSignals = new Map(
    target.payload.categories.flatMap((category) =>
      category.signals.map((signal) => [signal.id, signal] as const)
    )
  )
  const ids = new Set([...baseSignals.keys(), ...targetSignals.keys()])
  const signals = [...ids].map((id) => {
    const before = baseSignals.get(id) ?? null
    const after = targetSignals.get(id) ?? null
    return {
      id,
      transition: transition(before, after, comparable),
      baseline: before,
      target: after,
      measurementChanged:
        before !== null &&
        after !== null &&
        JSON.stringify(before.measurement) !==
          JSON.stringify(after.measurement),
    }
  })

  const baseCategories = new Map(
    baseline.payload.categories.map((category) => [category.key, category])
  )
  const categories = target.payload.categories.map((category) => {
    const before = baseCategories.get(category.key)
    const compatible =
      comparable &&
      before !== undefined &&
      measuredIds(before) === measuredIds(category) &&
      coverageKey(baseline) === coverageKey(target)
    return {
      key: category.key,
      name: category.name,
      baselineScore: before?.score ?? null,
      targetScore: category.score,
      pointsDelta:
        compatible && before?.score != null && category.score != null
          ? category.score - before.score
          : null,
      compatible,
    }
  })
  const allMeasured = (snapshot: ScanSnapshot) =>
    snapshot.payload.categories
      .flatMap((category) => category.signals)
      .filter((signal) => signal.status !== "not-measured")
      .map((signal) => signal.id)
      .sort()
      .join(",")
  const pointsCompatible =
    comparable &&
    allMeasured(baseline) === allMeasured(target) &&
    coverageKey(baseline) === coverageKey(target)
  const pointsDelta =
    pointsCompatible &&
    baseline.payload.overall != null &&
    target.payload.overall != null
      ? target.payload.overall - baseline.payload.overall
      : null

  return {
    comparable,
    sameCommit: baseline.commitSha === target.commitSha,
    pointsDelta,
    pointsCompatible,
    signals,
    categories,
    counts: {
      nowPassing: signals.filter((item) => item.transition === "now-passing")
        .length,
      nowFailing: signals.filter((item) => item.transition === "now-failing")
        .length,
      coverageChanged: signals.filter(
        (item) =>
          item.transition === "newly-measured" ||
          item.transition === "no-longer-measured"
      ).length,
    },
  }
}
