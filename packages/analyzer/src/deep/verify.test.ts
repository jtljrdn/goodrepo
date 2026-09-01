import { expect, test } from "bun:test"
import type { DeepFinding } from "./review"
import { checkFinding, directoriesOf, normalize, verifyFindings } from "./verify"
import type { Checkout } from "../sandbox"

const files = new Set(["README.md", "AGENTS.md", "package.json", "src/index.ts"])
const dirs = directoriesOf([...files])

const readme = "Run it locally\n\ncp .env.example .env.local // or vercel env pull .env.local\n"

function finding(over: Partial<DeepFinding> = {}): DeepFinding {
  return {
    severity: "medium",
    title: "README setup snippet uses invalid shell comment syntax",
    path: "README.md",
    quote: "cp .env.example .env.local // or vercel env pull .env.local",
    checkedPath: "README.md",
    evidence: "`//` is not a comment in sh.",
    fix: "Use `#`.",
    ...over,
  }
}

test("directoriesOf collects every parent prefix", () => {
  expect(directoriesOf(["a/b/c.ts", "a/d.ts", "top.md"])).toEqual(new Set(["a", "a/b"]))
})

test("normalize collapses the whitespace a model reflows", () => {
  expect(normalize("  a\n\n  b\tc ")).toBe("a b c")
})

test("a grounded finding survives", () => {
  expect(checkFinding(finding(), files, dirs, readme)).toBeNull()
})

test("a quote reflowed across lines still matches", () => {
  const reflowed = finding({ quote: "cp .env.example .env.local   //\n  or vercel env pull .env.local" })
  expect(checkFinding(reflowed, files, dirs, readme)).toBeNull()
})

test("a directory is an acceptable thing to have checked", () => {
  expect(checkFinding(finding({ checkedPath: "src" }), files, dirs, readme)).toBeNull()
})

test("a claim checked against something outside the checkout is dropped", () => {
  // The real false positive: next/dist/docs does exist, but a shallow clone has no
  // node_modules, so the agent concluded absence from a directory it cannot see.
  const bogus = finding({
    title: "AGENTS.md instructs agent to read nonexistent Next.js docs path",
    path: "AGENTS.md",
    quote: "Read the relevant guide in",
    checkedPath: "node_modules/next/dist/docs",
  })
  expect(checkFinding(bogus, files, dirs, "Read the relevant guide in node_modules/next/dist/docs/")).toBe(
    "node_modules/next/dist/docs is not in this repository, so the claim was never checked against it."
  )
})

test("a finding about a file that is not in the repository is dropped", () => {
  expect(checkFinding(finding({ path: "CHANGELOG.md" }), files, dirs, readme)).toBe(
    "CHANGELOG.md is not a file in this repository."
  )
})

test("a quote that does not appear in the cited file is dropped", () => {
  expect(checkFinding(finding({ quote: "this sentence was never written" }), files, dirs, readme)).toBe(
    "The quote does not appear in README.md."
  )
})

test("a quote too short to locate is dropped", () => {
  expect(checkFinding(finding({ quote: "cp" }), files, dirs, readme)).toBe("The quote is too short to locate.")
})

test("an unreadable file is dropped rather than assumed", () => {
  expect(checkFinding(finding(), files, dirs, undefined)).toBe("README.md could not be read back.")
})

test("verifyFindings splits a mixed batch and reads each cited file once", async () => {
  let reads = 0
  const checkout: Checkout = {
    entries: [...files].map((path) => ({ path, bytes: 1 })),
    read: async (paths) => {
      reads += 1
      return new Map(paths.map((p) => [p, p === "README.md" ? readme : "other"]))
    },
    run: async () => ({ stdout: "", exitCode: 0 }),
  }

  const result = await verifyFindings(
    [finding(), finding({ checkedPath: "node_modules/next/dist/docs" }), finding()],
    checkout
  )
  expect(result.kept).toHaveLength(2)
  expect(result.dropped).toHaveLength(1)
  expect(result.dropped[0]?.reason).toContain("never checked against it")
  expect(reads).toBe(1)
})

test("verifyFindings does no work when there is nothing to verify", async () => {
  const checkout = {
    entries: [],
    read: async () => { throw new Error("should not read") },
    run: async () => ({ stdout: "", exitCode: 0 }),
  } satisfies Checkout
  expect(await verifyFindings([], checkout)).toEqual({ kept: [], dropped: [] })
})

test("a finding the agent could not settle in the repository is dropped, not hidden", () => {
  expect(checkFinding(finding({ checkedPath: null }), files, dirs, readme)).toBe(
    "Nothing in this repository settles the claim."
  )
})
