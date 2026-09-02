import { expect, test } from "bun:test"
import type { RepoProfile, SignalId } from "../types"
import {
  AGENT_SIGNALS,
  judgeConsistency,
  partitionVerdicts,
  repoBrief,
  unresolvedSignals,
  type SignalVerdict,
} from "./signals"

function profileWith(
  has: Partial<Record<SignalId, boolean | null>>
): RepoProfile {
  const full = Object.fromEntries(
    (Object.keys(AGENT_SIGNALS) as SignalId[]).map((id) => [id, true])
  ) as Record<SignalId, boolean | null>
  return { has: { ...full, ...has } } as RepoProfile
}

test("only signals the static pass left open are handed to the agent", () => {
  expect(
    unresolvedSignals(
      profileWith({ consistentErrors: null, singleDataLayer: null })
    )
  ).toEqual(["consistentErrors", "singleDataLayer"])
})

test("a repository the static pass fully answered gives the agent nothing to do", () => {
  expect(unresolvedSignals(profileWith({}))).toEqual([])
})

test("a signal answered false is settled, not open", () => {
  expect(unresolvedSignals(profileWith({ consistentErrors: false }))).toEqual(
    []
  )
})

test("every agent signal states both the question and what to look for", () => {
  for (const [id, spec] of Object.entries(AGENT_SIGNALS)) {
    expect(spec.question.length, id).toBeGreaterThan(20)
    expect(spec.lookFor.length, id).toBeGreaterThan(40)
    expect(spec.question.endsWith("?"), id).toBe(true)
  }
})

test("a zero static route count does not withhold the routing question", () => {
  // honojs/hono reports apiRoutes=0 under the static heuristic and is still an HTTP framework
  // the agent judged consistent. Static absence is not evidence of absence here.
  const profile = {
    ...profileWith({ consistentRouteShape: null }),
    apiRoutes: 0,
  } as RepoProfile
  expect(unresolvedSignals(profile)).toEqual(["consistentRouteShape"])
})

test("the brief hands over what the static pass already measured", () => {
  const profile = {
    ...profileWith({}),
    owner: "acme",
    repo: "app",
    framework: "nextjs",
    language: "TypeScript",
    files: 99,
    directories: 30,
    apiRoutes: 4,
    testFiles: 12,
    testFramework: "bun:test",
  } as RepoProfile
  const checkout = {
    entries: [
      { path: "apps/web/a.ts", bytes: 1 },
      { path: "apps/web/b.ts", bytes: 1 },
      { path: "packages/ui/c.ts", bytes: 1 },
      { path: "README.md", bytes: 1 },
    ],
    read: async () => new Map(),
    run: async () => ({ stdout: "", exitCode: 0 }),
  }
  const brief = repoBrief(profile, checkout)
  expect(brief).toContain("acme/app")
  expect(brief).toContain("4 route files")
  expect(brief).toContain("bun:test")
  expect(brief).toContain("apps/ (2)")
  expect(brief).toContain("packages/ (1)")
})

test("the brief ignores root files when describing the layout", () => {
  const checkout = {
    entries: [{ path: "README.md", bytes: 1 }],
    read: async () => new Map(),
    run: async () => ({ stdout: "", exitCode: 0 }),
  }
  expect(repoBrief(profileWith({}) as RepoProfile, checkout)).not.toContain(
    "README.md"
  )
})
const answer = (
  signal: string,
  over: Partial<SignalVerdict> = {}
): SignalVerdict => ({
  signal,
  applicable: true,
  patterns: [{ pattern: "one way", path: "src/index.ts", reach: "most" }],
  reason: "what I saw",
  ...over,
})

const inRepo = new Set(["src/index.ts", "src/other.ts"])
const asked: SignalId[] = ["consistentErrors", "singleDataLayer"]

test("a grounded observation for a question we asked is kept", () => {
  const out = partitionVerdicts([answer("consistentErrors")], asked, inRepo)
  expect(out.verdicts.map((v) => v.signal)).toEqual(["consistentErrors"])
  expect(out.unsupported).toEqual([])
  expect(out.unmatched).toEqual([])
})

test("surrounding whitespace in a signal name does not lose the answer", () => {
  expect(
    partitionVerdicts([answer("  consistentErrors ")], asked, inRepo).verdicts
  ).toHaveLength(1)
})

test("a pattern citing a file outside the checkout is set aside", () => {
  const out = partitionVerdicts(
    [
      answer("consistentErrors", {
        patterns: [
          { pattern: "x", path: "node_modules/x/i.js", reach: "most" },
        ],
      }),
    ],
    asked,
    inRepo
  )
  expect(out.verdicts).toEqual([])
  expect(out.unsupported).toHaveLength(1)
})

test("one bad path among several spoils the whole answer", () => {
  const out = partitionVerdicts(
    [
      answer("consistentErrors", {
        patterns: [
          { pattern: "good", path: "src/index.ts", reach: "most" },
          { pattern: "bad", path: "dist/bundle.js", reach: "few" },
        ],
      }),
    ],
    asked,
    inRepo
  )
  expect(out.unsupported).toHaveLength(1)
})

test("an applicable answer with no patterns at all is set aside", () => {
  const out = partitionVerdicts(
    [answer("consistentErrors", { patterns: [] })],
    asked,
    inRepo
  )
  expect(out.unsupported).toHaveLength(1)
})

test("nothing of the kind needs no files to prove it", () => {
  const out = partitionVerdicts(
    [answer("consistentErrors", { applicable: false, patterns: [] })],
    asked,
    inRepo
  )
  expect(out.verdicts).toHaveLength(1)
})

test("a signal we never asked about is set aside rather than dropped", () => {
  const out = partitionVerdicts([answer("readme")], asked, inRepo)
  expect(out.verdicts).toEqual([])
  expect(out.unmatched.map((v) => v.signal)).toEqual(["readme"])
})

test("the first answer wins and a contradicting second one is set aside", () => {
  const out = partitionVerdicts(
    [answer("consistentErrors"), answer("consistentErrors", { patterns: [] })],
    asked,
    inRepo
  )
  expect(out.verdicts).toHaveLength(1)
  expect(out.unmatched).toHaveLength(1)
})

test("no answer is ever lost between the three buckets", () => {
  const raw = [
    answer("consistentErrors"),
    answer("readme"),
    answer("consistentErrors"),
    answer("singleDataLayer", {
      patterns: [{ pattern: "x", path: "nope.ts", reach: "most" }],
    }),
  ]
  const out = partitionVerdicts(raw, asked, inRepo)
  expect(
    out.verdicts.length + out.unsupported.length + out.unmatched.length
  ).toBe(raw.length)
})

test("the cutoff lives in code: identical observations always give the same verdict", () => {
  const observed = answer("consistentErrors", {
    patterns: [
      { pattern: "thrown", path: "src/index.ts", reach: "most" },
      { pattern: "returned", path: "src/other.ts", reach: "most" },
    ],
  })
  expect(judgeConsistency(observed)).toBe(false)
  expect(judgeConsistency(observed)).toBe(false)
})
