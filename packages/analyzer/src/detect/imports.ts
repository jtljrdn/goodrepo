import { passes, THRESHOLDS } from "../thresholds"
import type { Measurement, RawFacts, SignalId } from "../types"

const VALIDATION_LIBS = ["zod", "yup", "joi", "valibot", "superstruct", "ajv", "arktype"]
const DB_LIBS = [
  "drizzle-orm", "@prisma/client", "prisma", "kysely", "mongoose", "pg", "mysql2", "postgres",
]
const UI_SEGMENTS = new Set(["components", "app", "pages", "views", "screens"])

const ROUTE_PATTERNS = [/\/route\.[cm]?[jt]s$/, /^pages\/api\//, /\/pages\/api\//]

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

function rootPackage(specifier: string): string {
  if (specifier.startsWith(".")) return ""
  const parts = specifier.split("/")
  if (specifier.startsWith("@")) return parts.slice(0, 2).join("/")
  return parts[0] ?? ""
}

function dirOf(path: string): string {
  const slash = path.lastIndexOf("/")
  return slash === -1 ? "" : path.slice(0, slash)
}

function isUiFile(path: string): boolean {
  return path.split("/").some((seg) => UI_SEGMENTS.has(seg))
}

export function detectImports(facts: RawFacts) {
  const measurements: Partial<Record<SignalId, Measurement>> = {}

  const validationCounts = new Map<string, number>()
  for (const file of facts.codeFiles) {
    for (const specifier of file.imports) {
      const pkg = rootPackage(specifier)
      if (VALIDATION_LIBS.includes(pkg)) {
        validationCounts.set(pkg, (validationCounts.get(pkg) ?? 0) + 1)
      }
    }
  }
  const validationTotal = [...validationCounts.values()].reduce((n, c) => n + c, 0)
  const validationTop = Math.max(0, ...validationCounts.values())
  const validationShare = validationTotal > 0 ? validationTop / validationTotal : 0
  measurements.singleValidationLib = measure("validationDominance", validationShare)

  const uiFiles = facts.codeFiles.filter((f) => isUiFile(f.path))
  const uiWithDb = uiFiles.filter((f) =>
    f.imports.some((s) => DB_LIBS.includes(rootPackage(s)))
  ).length
  const dbShare = uiFiles.length > 0 ? uiWithDb / uiFiles.length : 0
  measurements.singleDataLayer = measure("directDbInUi", dbShare)

  const fanouts = facts.codeFiles.map((file) => {
    const dirs = new Set<string>()
    for (const specifier of file.imports) {
      dirs.add(specifier.startsWith(".") ? dirOf(specifier) : rootPackage(specifier))
    }
    return dirs.size
  })
  const medianFanout = median(fanouts)
  measurements.lowFanout = measure("medianFanout", medianFanout)

  return {
    validationPatterns: [...validationCounts.keys()],
    apiRoutes: facts.paths.filter((p) => ROUTE_PATTERNS.some((re) => re.test(p))).length,
    measurements,
    has: {
      singleValidationLib: validationTotal > 0 && passes("validationDominance", validationShare),
      singleDataLayer: uiFiles.length > 0 && passes("directDbInUi", dbShare),
      lowFanout: facts.codeFiles.length > 0 && passes("medianFanout", medianFanout),
    },
  }
}
