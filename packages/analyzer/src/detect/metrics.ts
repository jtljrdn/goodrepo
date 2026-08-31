import { passes, THRESHOLDS } from "../thresholds"
import type { Measurement, RawFacts, SignalId } from "../types"

type Casing = "kebab" | "camel" | "pascal" | "snake"

function measure(key: keyof typeof THRESHOLDS, value: number): Measurement {
  return { value, threshold: THRESHOLDS[key].threshold, unit: THRESHOLDS[key].unit }
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid] ?? 0
  return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
}

// A single-word lowercase name and a hyphenated one are the SAME convention.
// Splitting them punishes repositories that are perfectly consistent.
function casingOf(path: string): Casing {
  const base = path.slice(path.lastIndexOf("/") + 1)
  const name = base.split(".")[0] ?? ""
  if (/^[A-Z]/.test(name)) return "pascal"
  if (name.includes("_")) return "snake"
  if (/[A-Z]/.test(name)) return "camel"
  return "kebab"
}

export function detectMetrics(facts: RawFacts) {
  const lines = facts.codeFiles.map((f) => f.lines)
  const medianFileLoc = Math.round(median(lines))
  const largestFileLoc = Math.max(0, ...lines)
  const measurements: Partial<Record<SignalId, Measurement>> = {}

  measurements.smallFiles = measure("medianFileLoc", medianFileLoc)
  measurements.noMegaFiles = measure("largestFileLoc", largestFileLoc)

  const counts = new Map<Casing, number>()
  for (const file of facts.codeFiles) {
    const casing = casingOf(file.path)
    counts.set(casing, (counts.get(casing) ?? 0) + 1)
  }
  const dominant = Math.max(0, ...counts.values())
  const namingShare = facts.codeFiles.length > 0 ? dominant / facts.codeFiles.length : 0
  measurements.consistentNaming = measure("namingConsistency", namingShare)

  const hasFiles = facts.codeFiles.length > 0

  return {
    medianFileLoc,
    largestFileLoc,
    linesOfCode: lines.reduce((total, n) => total + n, 0),
    measurements,
    has: {
      smallFiles: hasFiles ? passes("medianFileLoc", medianFileLoc) : null,
      noMegaFiles: hasFiles ? passes("largestFileLoc", largestFileLoc) : null,
      consistentNaming: hasFiles ? passes("namingConsistency", namingShare) : null,
    },
  }
}
