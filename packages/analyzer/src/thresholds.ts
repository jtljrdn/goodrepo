export const THRESHOLDS = {
  readmeWords: { threshold: 300, unit: "words", direction: "atLeast" },
  maxDepth: { threshold: 7, unit: "levels", direction: "atMost" },
  // Bytes, not lines: the tree API gives an exact size for every file at no
  // extra cost, where line counts would require downloading every file body.
  // ~33 bytes per line, so these preserve the previous 300 / 1500 line meaning.
  medianFileBytes: { threshold: 10_000, unit: "bytes", direction: "atMost" },
  largestFileBytes: { threshold: 50_000, unit: "bytes", direction: "atMost" },
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
  /** Code files whose bodies are fetched to measure imports. */
  importSample: 200,
  /** Config and doc files are always fetched; this bounds a pathological repo. */
  configFiles: 40,
  /** Files above this are counted in the tree but never fetched. */
  perFileBytes: 2 * 1024 * 1024,
} as const

export function passes(key: ThresholdKey, value: number): boolean {
  const { threshold, direction } = THRESHOLDS[key]
  if (direction === "atLeast") return value >= threshold
  if (direction === "atMost") return value <= threshold
  return value < threshold
}
