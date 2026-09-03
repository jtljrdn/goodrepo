import { isTestFile } from "../skip"
import { measure, passes } from "../thresholds"
import type { Measurement, RawFacts, SignalId } from "../types"
import { readDependencies, readPackageJson } from "./manifest"

const VALIDATION_LIBS = [
  "zod",
  "yup",
  "joi",
  "valibot",
  "superstruct",
  "ajv",
  "arktype",
]
const DB_LIBS = [
  "drizzle-orm",
  "@prisma/client",
  "prisma",
  "kysely",
  "mongoose",
  "pg",
  "mysql2",
  "postgres",
  "better-sqlite3",
  "@libsql/client",
  "typeorm",
  "sequelize",
  "knex",
]
const DB_PATHS =
  /(^|\/)(migrations?|prisma|supabase)\/|(^|\/)(drizzle|knexfile)\.config\.|\.prisma$/

const UI_SEGMENTS = new Set(["components", "app", "pages", "views", "screens"])

const ROUTE_PATTERNS = [
  /\/route\.[cm]?[jt]sx?$/,
  /\+server\.[cm]?[jt]s$/,
  /(^|\/)pages\/api\//,
  /(^|\/)(routes?|controllers?)\//,
  /\.(controller|routes?)\.[cm]?[jt]s$/,
]

// Path aliases that point back into this repository, not at a package.
const LOCAL_IMPORT = /^(\.|@\/|~\/|#|\$lib\/)/

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
  const sampled = facts.codeFiles.filter(
    (f): f is typeof f & { imports: string[] } => f.imports !== null
  )

  const deps = readDependencies(readPackageJson(facts))
  const declared = deps.filter((name) => VALIDATION_LIBS.includes(name))
  const validationShare = declared.length === 0 ? 0 : 1 / declared.length
  measurements.singleValidationLib = measure(
    "validationDominance",
    validationShare
  )

  const dbDeclared = deps.some((name) => DB_LIBS.includes(name))
  const usesDatabase = dbDeclared || facts.paths.some((p) => DB_PATHS.test(p))

  const uiFiles = sampled.filter((f) => isUiFile(f.path))
  const uiWithDb = uiFiles.filter((f) =>
    f.imports.some((s) => DB_LIBS.includes(rootPackage(s)))
  ).length
  const dbShare = uiFiles.length > 0 ? uiWithDb / uiFiles.length : 0
  measurements.singleDataLayer = measure("directDbInUi", dbShare)

  const fanouts = sampled.map((file) => {
    const dirs = new Set<string>()
    for (const specifier of file.imports) {
      if (LOCAL_IMPORT.test(specifier)) dirs.add(dirOf(specifier))
    }
    return dirs.size
  })
  const medianFanout = median(fanouts)
  measurements.lowFanout = measure("medianFanout", medianFanout)

  return {
    validationPatterns: declared,
    usesDatabase,
    apiRoutes: facts.codeFiles.filter(
      (f) => !isTestFile(f.path) && ROUTE_PATTERNS.some((re) => re.test(f.path))
    ).length,
    measurements,
    has: {
      singleValidationLib: declared.length > 0 ? declared.length === 1 : null,
      singleDataLayer:
        dbDeclared && uiFiles.length > 0
          ? passes("directDbInUi", dbShare)
          : null,
      lowFanout:
        sampled.length > 0 ? passes("medianFanout", medianFanout) : null,
    },
  }
}
