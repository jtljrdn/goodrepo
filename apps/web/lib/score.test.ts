import { expect, test } from "bun:test"
import type { RepoProfile, SignalId } from "@/lib/profile"
import { CATEGORIES, scoreCategory, scoreRepo } from "@/lib/score"

function profileWith(has: Partial<Record<SignalId, boolean | null>>): RepoProfile {
  const full = {} as Record<SignalId, boolean | null>
  for (const category of CATEGORIES) {
    for (const signal of category.signals) full[signal.id] = false
  }
  return {
    owner: "a", repo: "b", description: "", stars: 0, defaultBranch: "main",
    commitSha: "x", commitMessage: "", framework: "nextjs", language: "TypeScript",
    files: 1, directories: 1, maxDirectoryDepth: 1, linesOfCode: 1,
    medianFileLoc: 1, largestFileLoc: 1, packageManager: null, scripts: {},
    testFramework: null, testFiles: 0, apiRoutes: 0, validationPatterns: [],
    docs: { readmeWords: 0, agentsMdWords: 0, sections: [] },
    has: { ...full, ...has }, measurements: {}, truncated: null,
  }
}

test("every signal appears in exactly one category", () => {
  const seen = new Map<SignalId, string>()
  for (const category of CATEGORIES) {
    for (const signal of category.signals) {
      expect(seen.has(signal.id), `${signal.id} is in both ${seen.get(signal.id)} and ${category.key}`).toBe(false)
      seen.set(signal.id, category.key)
    }
  }
  expect(seen.size).toBe(40)
})

test("namedBoundaries no longer exists", () => {
  const ids = CATEGORIES.flatMap((c) => c.signals.map((s) => s.id as string))
  expect(ids).not.toContain("namedBoundaries")
  expect(ids).toContain("featureFolders")
})

test("a not-measured signal is excluded from both sides of the fraction", () => {
  const consistency = CATEGORIES.find((c) => c.key === "consistency")
  if (!consistency) throw new Error("consistency category missing")

  const allNull = scoreCategory(consistency, profileWith({
    consistentRouteShape: null, consistentErrors: null,
  }))
  const notMeasured = allNull.signals.filter((s) => s.status === "not-measured")
  expect(notMeasured).toHaveLength(2)
  expect(allNull.totalPoints).toBe(
    consistency.signals
      .filter((s) => s.id !== "consistentRouteShape" && s.id !== "consistentErrors")
      .reduce((n, s) => n + s.points, 0)
  )
})

test("a not-measured signal never lowers the score", () => {
  const consistency = CATEGORIES.find((c) => c.key === "consistency")
  if (!consistency) throw new Error("consistency category missing")

  const measured = scoreCategory(consistency, profileWith({
    singleValidationLib: true, consistentNaming: true, singleDataLayer: true, lintConfig: true,
    consistentRouteShape: null, consistentErrors: null,
  }))
  expect(measured.score).toBe(100)
})

test("a category with every signal not measured has a null score", () => {
  const allNull: Partial<Record<SignalId, boolean | null>> = {}
  const consistency = CATEGORIES.find((c) => c.key === "consistency")
  if (!consistency) throw new Error("consistency category missing")
  for (const signal of consistency.signals) allNull[signal.id] = null

  const scored = scoreCategory(consistency, profileWith(allNull))
  expect(scored.score).toBeNull()
})

test("the overall score averages only the categories that produced a score", () => {
  const result = scoreRepo(profileWith({ consistentRouteShape: null, consistentErrors: null }))
  expect(result.overall).toBe(0)
  expect(result.categories).toHaveLength(6)
})
