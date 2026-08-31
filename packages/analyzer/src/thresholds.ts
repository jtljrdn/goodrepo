export const THRESHOLDS = {
  readmeWords: { threshold: 300, unit: "words", direction: "atLeast" },
  maxDepth: { threshold: 7, unit: "levels", direction: "atMost" },
  medianFileLoc: { threshold: 300, unit: "lines", direction: "atMost" },
  largestFileLoc: { threshold: 1500, unit: "lines", direction: "atMost" },
  namingConsistency: { threshold: 0.9, unit: "share", direction: "atLeast" },
  testColocation: { threshold: 0.6, unit: "share", direction: "atLeast" },
  rootConcentration: { threshold: 0.8, unit: "share", direction: "atLeast" },
  typeNamedFolders: { threshold: 0.5, unit: "share", direction: "lessThan" },
  validationDominance: { threshold: 0.9, unit: "share", direction: "atLeast" },
  directDbInUi: { threshold: 0.1, unit: "share", direction: "lessThan" },
  medianFanout: { threshold: 3, unit: "directories", direction: "atMost" },
} as const

export type ThresholdKey = keyof typeof THRESHOLDS

export const CAPS = {
  downloadBytes: 100 * 1024 * 1024,
  filesRead: 50_000,
  perFileBytes: 2 * 1024 * 1024,
} as const

export function passes(key: ThresholdKey, value: number): boolean {
  const { threshold, direction } = THRESHOLDS[key]
  if (direction === "atLeast") return value >= threshold
  if (direction === "atMost") return value <= threshold
  return value < threshold
}
