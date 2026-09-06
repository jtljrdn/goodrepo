import { expect, test } from "bun:test"
import type { RepoProfile, SignalId } from "@/lib/profile"
import { buildAgentInstructions } from "@/lib/agent-instructions"
import { scoreRepo, CATEGORIES } from "@/lib/score"

function fixture(): RepoProfile {
  const has = {} as Record<SignalId, boolean | null>
  for (const category of CATEGORIES)
    for (const signal of category.signals) has[signal.id] = true
  has.readme = false
  has.testScript = false
  return {
    repositoryId: "123",
    owner: "quoted-owner",
    repo: "quoted-repo",
    description: "",
    stars: 0,
    defaultBranch: "main",
    commitSha: "a".repeat(40),
    commitMessage: "",
    framework: "nextjs",
    language: "TypeScript",
    files: 2,
    directories: 1,
    maxDirectoryDepth: 1,
    totalBytes: 100,
    medianFileBytes: 50,
    largestFileBytes: 50,
    packageManager: "bun@1.3.10",
    scripts: { test: "untrusted `command`" },
    testFramework: "bun:test",
    testFiles: 1,
    apiRoutes: 0,
    validationPatterns: [],
    docs: { readmeWords: 0, agentsMdWords: 20, sections: [] },
    has,
    measurements: {},
    sample: { sampled: 1, total: 1 },
    configCoverage: { read: 1, total: 1 },
    truncated: null,
  }
}

test("selected instructions contain only the chosen failed checks", () => {
  const profile = fixture()
  const scored = scoreRepo(profile)
  const value = buildAgentInstructions({
    profile,
    ...scored,
    selectedIds: ["readme"],
    returnUrl: "https://goodrepo.dev/fixes/plan",
  })
  expect(value).toContain('"id": "readme"')
  expect(value).not.toContain('"id": "testScript"')
  expect(value).toContain(profile.commitSha)
  expect(value).toContain("push the completed changes")
  expect(value).toContain("https://goodrepo.dev/fixes/plan")
  expect(value).toContain("untrusted \\u0060command\\u0060")
})

test("unknown, passing, duplicate and empty selections are rejected", () => {
  const profile = fixture()
  const scored = scoreRepo(profile)
  for (const selectedIds of [
    [],
    ["readme", "readme"],
    ["readmeDepth"],
    ["unknown"],
  ]) {
    expect(() =>
      buildAgentInstructions({
        profile,
        ...scored,
        selectedIds: selectedIds as SignalId[],
      })
    ).toThrow()
  }
})
