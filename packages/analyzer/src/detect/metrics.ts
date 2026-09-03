import { measure, passes } from "../thresholds"
import type { Measurement, RawFacts, SignalId } from "../types"

type Casing = "kebab" | "camel" | "pascal" | "snake"

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid] ?? 0
  return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
}

function dirOf(path: string): string {
  const slash = path.lastIndexOf("/")
  return slash === -1 ? "" : path.slice(0, slash)
}

function casingOf(path: string): Casing {
  const base = path.slice(path.lastIndexOf("/") + 1)
  const name = base.split(".")[0] ?? ""
  if (/^[A-Z]/.test(name)) return "pascal"
  if (name.includes("_")) return "snake"
  if (/[A-Z]/.test(name)) return "camel"
  return "kebab"
}

// Naming is judged folder by folder: PascalCase components beside kebab-case
// utilities is a convention, two casings inside one folder is not.
function namingConsistency(paths: string[]): number | null {
  const byDir = new Map<string, Map<Casing, number>>()
  for (const path of paths) {
    if (/^index\.[cm]?[jt]sx?$/.test(path.slice(path.lastIndexOf("/") + 1)))
      continue
    const dir = dirOf(path)
    const counts = byDir.get(dir) ?? new Map<Casing, number>()
    const casing = casingOf(path)
    counts.set(casing, (counts.get(casing) ?? 0) + 1)
    byDir.set(dir, counts)
  }
  let dominant = 0
  let total = 0
  for (const counts of byDir.values()) {
    const files = [...counts.values()].reduce((n, c) => n + c, 0)
    if (files < 2) continue
    dominant += Math.max(...counts.values())
    total += files
  }
  return total === 0 ? null : dominant / total
}

export function detectMetrics(facts: RawFacts) {
  const sizes = facts.codeFiles.map((f) => f.bytes)
  const medianFileBytes = Math.round(median(sizes))
  const largestFileBytes = Math.max(0, ...sizes)
  const measurements: Partial<Record<SignalId, Measurement>> = {}

  measurements.smallFiles = measure("medianFileBytes", medianFileBytes)
  measurements.noMegaFiles = measure("largestFileBytes", largestFileBytes)

  const namingShare = namingConsistency(facts.codeFiles.map((f) => f.path))
  measurements.consistentNaming = measure("namingConsistency", namingShare ?? 0)

  const hasFiles = facts.codeFiles.length > 0

  return {
    medianFileBytes,
    largestFileBytes,
    totalBytes: sizes.reduce((total, n) => total + n, 0),
    measurements,
    has: {
      smallFiles: hasFiles ? passes("medianFileBytes", medianFileBytes) : null,
      noMegaFiles: hasFiles
        ? passes("largestFileBytes", largestFileBytes)
        : null,
      consistentNaming:
        namingShare === null ? null : passes("namingConsistency", namingShare),
    },
  }
}
