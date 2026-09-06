import { posix } from "node:path"
import { importResolver, type ImportResolver } from "../resolve-import"
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

const UI_SEGMENTS = new Set(["components", "views", "screens"])

const ROUTE_PATTERNS = [
  /\/route\.[cm]?[jt]sx?$/,
  /\+server\.[cm]?[jt]s$/,
  /(^|\/)pages\/api\//,
  /(^|\/)(routes?|controllers?)\//,
  /\.(controller|routes?)\.[cm]?[jt]s$/,
]

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

function isUiFile(
  file: RawFacts["codeFiles"][number],
  serverComponents: boolean
): boolean {
  if (isTestFile(file.path) || ROUTE_PATTERNS.some((re) => re.test(file.path)))
    return false
  if (file.client) return true
  // App Router files may be server components; only explicit client modules are UI evidence there.
  if (
    file.path.split("/").includes("app") ||
    (serverComponents && !file.path.split("/").includes("pages"))
  )
    return false
  return (
    file.path.split("/").some((seg) => UI_SEGMENTS.has(seg)) ||
    /(^|\/)pages\/.*\.[jt]sx$/.test(file.path)
  )
}

export function detectImports(
  facts: RawFacts,
  repository = facts,
  prefix = "",
  resolve: ImportResolver = importResolver(repository)
) {
  const measurements: Partial<Record<SignalId, Measurement>> = {}
  const sampled = facts.codeFiles.filter(
    (f): f is typeof f & { imports: string[] } =>
      f.imports !== null && !isTestFile(f.path)
  )

  const deps = readDependencies(readPackageJson(facts))
  const counts = new Map<string, number>()
  for (const file of sampled)
    for (const name of new Set(file.imports.map(rootPackage))) {
      if (VALIDATION_LIBS.includes(name))
        counts.set(name, (counts.get(name) ?? 0) + 1)
    }
  const declared = [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name)
  const validationTotal = [...counts.values()].reduce((sum, n) => sum + n, 0)
  const validationShare = validationTotal
    ? Math.max(...counts.values()) / validationTotal
    : 0
  measurements.singleValidationLib = measure(
    "validationDominance",
    validationShare
  )

  const dbDeclared =
    deps.some((name) => DB_LIBS.includes(name)) ||
    sampled.some((f) => f.imports.some((s) => DB_LIBS.includes(rootPackage(s))))
  const usesDatabase = dbDeclared || facts.paths.some((p) => DB_PATHS.test(p))

  const uiFiles = sampled.filter((f) => isUiFile(f, deps.includes("next")))
  const uiWithDb = uiFiles.filter((f) =>
    f.imports.some((s) => DB_LIBS.includes(rootPackage(s)))
  ).length
  const dbShare = uiFiles.length > 0 ? uiWithDb / uiFiles.length : 0
  measurements.singleDataLayer = measure("directDbInUi", dbShare)

  const fanouts = sampled.map((file) => {
    const dirs = new Set<string>()
    for (const specifier of file.imports) {
      const target = resolve(
        prefix ? `${prefix}/${file.path}` : file.path,
        specifier
      )
      if (target) dirs.add(posix.dirname(target))
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
      singleValidationLib:
        declared.length > 0
          ? passes("validationDominance", validationShare)
          : null,
      singleDataLayer:
        dbDeclared && uiFiles.length > 0
          ? passes("directDbInUi", dbShare)
          : null,
      lowFanout:
        sampled.length > 0 ? passes("medianFanout", medianFanout) : null,
    },
  }
}
