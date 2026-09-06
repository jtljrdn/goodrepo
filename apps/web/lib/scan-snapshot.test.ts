import { expect, test } from "bun:test"
import {
  parseSnapshotPayload,
  SNAPSHOT_SCHEMA_VERSION,
} from "@/lib/scan-snapshot"

const payload = {
  schemaVersion: SNAPSHOT_SCHEMA_VERSION,
  overall: null,
  categories: [
    {
      key: "discoverability",
      name: "Discoverability",
      score: null,
      earnedPoints: 0,
      totalPoints: 0,
      signals: [
        {
          id: "readme",
          subject: "README",
          status: "not-measured",
          points: 10,
          finding: "Not inspected",
          measurement: null,
          unmeasuredReason: "not-inspected",
        },
      ],
    },
  ],
  coverage: { sample: null, config: null, truncated: null },
}

test("snapshot validation preserves null scores and structured unmeasured reasons", () => {
  expect(parseSnapshotPayload(payload)).toEqual(payload)
})

test("snapshot validation rejects unknown and duplicate signal IDs", () => {
  const unknown = structuredClone(payload)
  unknown.categories[0]!.signals[0]!.id = "unknown"
  expect(parseSnapshotPayload(unknown)).toBeNull()
  const duplicate = structuredClone(payload)
  duplicate.categories[0]!.signals.push(duplicate.categories[0]!.signals[0]!)
  expect(parseSnapshotPayload(duplicate)).toBeNull()
})
