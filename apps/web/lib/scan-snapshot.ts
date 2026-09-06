import type { Measurement, RepoProfile, SignalId } from "@/lib/profile"
import {
  CATEGORIES,
  signalSubject,
  type CategoryKey,
  type ScoredCategory,
  type SignalStatus,
} from "@/lib/score"

export const ANALYSIS_VERSION = "quick-v6"
export const SNAPSHOT_SCHEMA_VERSION = 1
export const MAX_SNAPSHOT_BYTES = 128 * 1024

export type QuickScanMode = "public" | "private"
export type UnmeasuredReason = "not-inspected" | "not-applicable"

export type SnapshotSignal = {
  id: SignalId
  subject: string
  status: SignalStatus
  points: number
  finding: string
  measurement: Measurement | null
  unmeasuredReason: UnmeasuredReason | null
}

export type SnapshotCategory = {
  key: CategoryKey
  name: string
  score: number | null
  earnedPoints: number
  totalPoints: number
  signals: SnapshotSignal[]
}

export type SnapshotCoverage = {
  sample: RepoProfile["sample"]
  config: RepoProfile["configCoverage"] | null
  truncated: RepoProfile["truncated"]
}

export type ScanSnapshotPayload = {
  schemaVersion: typeof SNAPSHOT_SCHEMA_VERSION
  overall: number | null
  categories: SnapshotCategory[]
  coverage: SnapshotCoverage
}

export type ScanSnapshot = {
  id: string
  userId: string
  repositoryId: string
  owner: string
  repo: string
  commitSha: string
  mode: QuickScanMode
  analysisVersion: string
  schemaVersion: number
  observedAt: Date
  payload: ScanSnapshotPayload
}

const SIGNAL_IDS = new Set(
  CATEGORIES.flatMap((category) => category.signals.map((signal) => signal.id))
)

export function snapshotPayload(
  profile: RepoProfile,
  overall: number | null,
  categories: ScoredCategory[]
): ScanSnapshotPayload {
  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    overall,
    categories: categories.map((category) => ({
      key: category.key,
      name: category.name,
      score: category.score,
      earnedPoints: category.earnedPoints,
      totalPoints: category.totalPoints,
      signals: category.signals.map((signal) => ({
        id: signal.id,
        subject: signalSubject(signal.id),
        status: signal.status,
        points: signal.points,
        finding: signal.text,
        measurement: signal.measurement ?? null,
        unmeasuredReason:
          signal.status === "not-measured"
            ? (profile.unmeasured?.[signal.id] ?? "not-applicable")
            : null,
      })),
    })),
    coverage: {
      sample: profile.sample,
      config: profile.configCoverage ?? null,
      truncated: profile.truncated,
    },
  }
}

function isNumberOrNull(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value))
}

export function parseSnapshotPayload(
  value: unknown
): ScanSnapshotPayload | null {
  if (JSON.stringify(value).length > MAX_SNAPSHOT_BYTES) return null
  if (!value || typeof value !== "object") return null
  const payload = value as Partial<ScanSnapshotPayload>
  if (
    payload.schemaVersion !== SNAPSHOT_SCHEMA_VERSION ||
    !isNumberOrNull(payload.overall) ||
    !Array.isArray(payload.categories) ||
    !payload.coverage ||
    typeof payload.coverage !== "object"
  )
    return null

  const seen = new Set<string>()
  for (const category of payload.categories) {
    if (
      !category ||
      typeof category !== "object" ||
      !Array.isArray(category.signals)
    )
      return null
    for (const signal of category.signals) {
      if (
        !signal ||
        typeof signal !== "object" ||
        !SIGNAL_IDS.has(signal.id) ||
        seen.has(signal.id) ||
        !["pass", "fail", "not-measured"].includes(signal.status) ||
        typeof signal.points !== "number" ||
        typeof signal.finding !== "string"
      )
        return null
      seen.add(signal.id)
    }
  }
  return payload as ScanSnapshotPayload
}

export function failedSignalIds(payload: ScanSnapshotPayload): SignalId[] {
  return payload.categories.flatMap((category) =>
    category.signals.flatMap((signal) =>
      signal.status === "fail" ? [signal.id] : []
    )
  )
}
