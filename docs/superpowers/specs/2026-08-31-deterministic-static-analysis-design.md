# Deterministic Static Analysis: Design

Date: 2026-08-31
Status: Approved for planning

## Purpose

Replace the seeded fake `buildProfile()` with a real analyzer that produces a
`RepoProfile` from an actual repository. This is stage one of the product: the
fast scan, zero model tokens, running on Vercel Functions.

The scoring layer in `apps/web/lib/score.ts` already reads only from
`RepoProfile`. The analyzer's entire job is to produce that object honestly.

The signal set drops from 41 to 40 in the process, because two overlapping
signals merge and two double-counted signals are each assigned a single home.

## What exists today

- `apps/web/lib/profile.ts` — the `RepoProfile` type, 41 `SignalId` values, and
  `buildProfile()`, which returns deterministic **fake** data seeded from the
  `owner/repo` string. No network call happens.
- `apps/web/lib/score.ts` — six categories, 43 signal slots over 41 unique
  signals, binary earned/not-earned, category score is earned over total, overall
  is the unweighted mean of the six. Two signals appear in two categories each,
  and two further signals measure the same property. This design corrects both,
  leaving **40 signals, each in exactly one category**.
- `apps/web/lib/recommendations.ts` — copy for 13 of the 41 signals.

## Decisions

Each of these was decided during design and is settled.

1. **Host: Vercel Functions.** 300s max duration and 2GB memory on Hobby, full
   Node.js API coverage. No `git` binary, which rules out shallow clone.
2. **Ingestion: GitHub tarball, streamed.** One request to
   `https://api.github.com/repos/{owner}/{repo}/tarball` returns the whole
   repository as a gzipped tar. We parse it as it arrives and discard each file's
   bytes after measuring it. Peak memory is one file, not the repository.
3. **The analyzer is a pure package.** It performs no network and no filesystem
   access. Feeders adapt a source into a stream of file entries. This makes the
   host decision cheap to reverse and gives the planned `npx goodrepo` CLI its
   local scanner for free.
4. **JavaScript and TypeScript only.** Other ecosystems are detected and refused
   with a plain message before any download. Ecosystem adapters are roadmap, not
   v1.
5. **Signals stay binary, thresholds are published.** The report always shows the
   measurement next to the cutoff, for example "median 305 lines, passes under
   300". This serves Product Principle 1: every point is traceable. A visible
   arguable cliff beats a hidden smooth curve.
6. **Every signal belongs to exactly one category.** A signal that appears in
   two categories contributes twice to the overall score, which is not
   defensible on a public number. See "Category reassignment" below.
7. **`namedBoundaries` and `featureFolders` merge into one signal.** They both
   measure whether the codebase is organised by domain or by file type. One
   property gets one signal.
8. **Two signals are not measured in a fast scan.** `consistentRouteShape` and
   `consistentErrors` need to read inside function bodies. They return
   not-measured and are filled in by the deep scan.

## Architecture

```
GitHub tarball  ─┐
local folder    ─┼─→  AsyncIterable<FileEntry>  →  analyze()  →  RepoProfile  →  scoreRepo()
future sources  ─┘         (feeders)               (pure core)      (exists)
```

New package `packages/analyzer`, published in-workspace as
`@workspace/analyzer`. It follows the existing package conventions: ESM, no build
step, `exports` pointing straight at `src`, `bun test` as the test runner,
`@workspace/typescript-config` and `@workspace/eslint-config` as devDependencies.

### The core contract

```ts
export type FileEntry = {
  path: string        // repository-relative, tarball prefix stripped
  size: number        // bytes
  text: string | null // null when skipped: binary, oversized, or ignored path
}

export type FileSource = AsyncIterable<FileEntry>

export function analyze(source: FileSource, meta: RepoMeta): Promise<RepoProfile>
export function shouldReadContents(path: string, size: number): boolean
```

`shouldReadContents` is exported so feeders can skip reading bodies they will
never be asked about. It is the single source of truth for the skip list, shared
by every feeder.

`RepoMeta` carries what the analyzer cannot derive from files alone: `owner`,
`repo`, `defaultBranch`, `stars`, `description`, `commitSha`, `commitMessage`.
The tarball feeder gets `commitSha` free, because GitHub names the archive's top
level directory `{owner}-{repo}-{shortSha}`.

### Module layout

```
packages/analyzer/src/
  index.ts            analyze(), re-exports
  types.ts            FileEntry, FileSource, RawFacts, RepoMeta
  skip.ts             shouldReadContents(), path skip list, binary extensions
  collect.ts          the streaming pass: FileSource -> RawFacts
  thresholds.ts       every numeric cutoff, exported for display
  detect/
    manifest.ts       package manager, scripts, lockfile, node pinning
    docs.ts           README, AGENTS.md, CLAUDE.md, headings, word counts
    tests.ts          test config, test files, coverage, CI runs tests
    tooling.ts        lint, format, build, env example, container, CI
    structure.ts      depth, roots, folder naming, colocated tests, generated
    metrics.ts        line counts, filename casing
    imports.ts        validation library, data layer, fan-out
  source/
    tarball.ts        GitHub tarball -> FileSource  (web)
    local.ts          folder walk -> FileSource     (CLI, later)
```

Each `detect/` module is a pure function from `RawFacts` to a slice of the
profile. Each is independently testable against a fixture with no network.

### The streaming pass

`collect.ts` makes one pass and accumulates only small facts:

- Every path, always. 31,847 paths for `vercel/next.js` costs roughly 2MB of
  strings, which is acceptable.
- For files that pass `shouldReadContents`: line count, extracted import
  specifiers, and filename casing. The bytes are then discarded.
- Full text is retained for a small fixed set of files, because every detector
  reads from them: `package.json` (root and workspaces), `tsconfig.json`,
  `README.md`, `AGENTS.md`, `CLAUDE.md`, `.env.example`, `Dockerfile`,
  `.devcontainer/*`, `.github/workflows/*`, `.nvmrc`, `.node-version`, lint,
  format and test configs. Lockfiles are noted by name only, never read.

Imports are extracted with a scan for `import ... from "x"`, `export ... from
"x"`, `require("x")` and dynamic `import("x")`. This is deliberately not a full
parse. It yields the module graph, which is all three import-dependent signals
need.

## Signal inventory

All 40 signals, how each is measured, and the proposed threshold. `T` marks a
tunable cutoff that lives in `thresholds.ts`.

### File and config checks — exact, no threshold

| Signal | Measurement |
|---|---|
| `readme` | `README.md` (any case) exists at root |
| `agentsMd` | `AGENTS.md` exists at root |
| `claudeMd` | `CLAUDE.md` exists at root |
| `lockfile` | a known lockfile exists and `packageManager` is set in `package.json` |
| `lintConfig` | an ESLint, Biome or oxlint config exists |
| `testConfig` | a Vitest, Jest, Playwright or `node:test` config exists |
| `testScript` | `package.json` has a `test` script |
| `typecheckScript` | `package.json` has a `typecheck` script, or one running `tsc --noEmit` |
| `lintScript` | `package.json` has a `lint` script |
| `formatScript` | `package.json` has a `format` script |
| `buildScript` | `package.json` has a `build` script |
| `envExample` | `.env.example`, `.env.sample` or `.env.template` exists |
| `container` | `Dockerfile`, `compose.yaml` or `.devcontainer/` exists |
| `ciWorkflow` | at least one file under `.github/workflows/` |
| `nodePinned` | `.nvmrc`, `.node-version`, `engines.node`, Volta or mise config |
| `coverage` | a coverage script exists, or coverage is configured in the test config |
| `ciRunsTests` | a CI workflow file references the `test` script or the test framework binary |
| `docPackageManager` | README or AGENTS.md names the detected package manager |
| `docTestCommand` | README or AGENTS.md contains the test command |
| `docBuildCommand` | README or AGENTS.md contains the build and dev commands |
| `docArchitecture` | README or AGENTS.md has a heading matching architecture, structure or overview |
| `docDatabase` | heading matching database, schema, migration or ORM |
| `docApiConventions` | heading matching API, routes, endpoints or handlers |
| `docCodeStyle` | heading matching style, conventions, naming or lint |
| `singleTestDocumented` | docs contain a single-test invocation, for example `vitest run path` or `-t "name"` |
| `generatedExcluded` | no tracked files under `dist/`, `build/`, `.next/`, `out/` or `coverage/` |
| `testsExist` | at least one file matching a test pattern |

### Counting — exact measurement, tunable cutoff

| Signal | Measurement | Threshold |
|---|---|---|
| `readmeDepth` | README word count | `T` >= 300 words |
| `shallowTree` | deepest path depth from root | `T` <= 7 |
| `smallFiles` | median line count of code files | `T` <= 300 lines |
| `noMegaFiles` | largest code file line count | `T` <= 1500 lines |
| `consistentNaming` | share of code files using the dominant filename casing | `T` >= 90% |
| `colocatedTests` | share of test files sitting beside, or in a `__tests__` sibling of, a source file with a matching basename | `T` >= 60% |

### Folder shape — heuristic, no code reading

| Signal | Measurement | Threshold |
|---|---|---|
| `predictableRoot` | share of code files under a single top level directory, or under declared workspace roots | `T` >= 80% |
| `featureFolders` | share of the primary source root's **immediate child directories** whose names are type or catch-all names (`components`, `hooks`, `utils`, `helpers`, `common`, `misc`, `shared`, `lib`, `types`, `services`, `models`, `controllers`) rather than domain names | `T` < 50% |

`featureFolders` replaces the former `namedBoundaries` and `featureFolders`
pair, which measured the same property in two different categories. The
`SignalId` `namedBoundaries` is removed.

The measurement deliberately looks only at the **immediate children** of the
primary source root, not at every path segment. A React repository legitimately
has a `components/` folder; that alone is not disorganisation. What the signal
catches is a source root whose children are *only* type names, so
`src/{auth,billing,dashboard,components,lib}` passes at 40% while
`src/{components,hooks,utils,types,services}` fails at 100%.

### Import graph — needs the module graph, not a parse

| Signal | Measurement | Threshold |
|---|---|---|
| `singleValidationLib` | share of validation library imports (`zod`, `yup`, `joi`, `valibot`, `superstruct`, `ajv`, `arktype`) belonging to the dominant one | `T` >= 90% |
| `singleDataLayer` | share of component or route files importing a database client directly (`drizzle`, `prisma`, `kysely`, `mongoose`, `pg`, `mysql2`) | `T` < 10% |
| `lowFanout` | median count of distinct directories a code file imports from | `T` <= 3 |

### Not measured in a fast scan

| Signal | Why | Filled by |
|---|---|---|
| `consistentRouteShape` | requires reading handler signatures and bodies | deep scan |
| `consistentErrors` | requires reading catch blocks and error construction | deep scan |

## Category reassignment

Three signals move so that every signal has exactly one home.

| Signal | Was in | Now in | Reasoning |
|---|---|---|---|
| `shallowTree` | Discoverability + Context | **Discoverability** | Depth is about navigating to a file, not about how much you read once there. |
| `colocatedTests` | Discoverability + Context | **Discoverability** | Both original framings were about *finding* the test. That is discovery. |
| `featureFolders` (merged) | Context, and `namedBoundaries` in Discoverability | **Context Efficiency** | Organising by feature is what keeps one change inside one folder. It pairs with `lowFanout`. |

The resulting categories:

| Category | Signals | Count |
|---|---|---|
| Discoverability | `readme`, `readmeDepth`, `predictableRoot`, `shallowTree`, `colocatedTests`, `generatedExcluded` | 6 |
| Instructions | unchanged | 9 |
| Testability | unchanged | 7 |
| Consistency | unchanged, 2 of 6 not measured in a fast scan | 6 |
| Tooling | unchanged | 8 |
| Context Efficiency | `smallFiles`, `noMegaFiles`, `featureFolders`, `lowFanout` | 4 |

**Consequence worth stating.** Category score is earned points over total points,
so the totals renormalise on their own and no point values need editing. But the
overall score is the unweighted mean of six categories, so each category is worth
one sixth regardless of how many signals it holds. Context Efficiency now spreads
that sixth across 4 signals instead of 6, making each Context signal worth roughly
4.2% of the overall score where it was 2.8%. Discoverability moves the other way,
from 7 signals to 6.

That is a real weighting shift. It follows from the one-signal-one-category rule
rather than being a separate decision, and whether the six categories should be
weighted equally at all is already an open product question in PRODUCT.md.

## Changes to existing code

### `RepoProfile.has` gains a third state

```ts
has: Record<SignalId, boolean | null>  // null = not measured
```

### `scoreCategory` must exclude not-measured signals from both sides

Today a null would coerce to a failure, silently costing points for work that
never ran. That violates Product Principle 5. The fix is to filter before
summing, so the denominator counts only signals that actually ran:

```ts
const measured = signals.filter((sig) => sig.status !== "not-measured")
const totalPoints = measured.reduce((n, sig) => n + sig.points, 0)
```

A category where every signal is not-measured has no score and is rendered as
unavailable rather than as zero.

### `ScoredSignal` gains status and measurement

```ts
type ScoredSignal = {
  id: SignalId
  points: number
  status: "pass" | "fail" | "not-measured"
  text: string
  measurement?: { value: number; threshold: number; unit: string }
}
```

`measurement` is what lets the report print the cutoff beside the number. The
report UI must render the not-measured state distinctly from a failure, and must
never let it read as a lost point.

### `RepoProfile` gains a truncated flag

```ts
truncated: null | { cap: "download" | "files" | "perFile"; detail: string }
```

Null when the scan completed. Set when a cap tripped, so the report can say
which cap was hit rather than presenting a partial scan as a whole one.

### `SignalId` loses `namedBoundaries`

The union drops from 41 to 40 members. `CATEGORIES` in `score.ts` is edited so
`shallowTree` and `colocatedTests` each appear once, and the merged
`featureFolders` signal carries copy covering both properties it now measures.
`recommendations.ts` keys off `SignalId`, so its `namedBoundaries` entry is
retargeted to `featureFolders`.

### `buildProfile()` is deleted

Its seeded generator, `SIGNAL_ODDS`, and the framework and package manager pick
lists all go. The `RepoProfile` and `SignalId` types move to
`packages/analyzer` and are re-exported from `apps/web/lib/profile.ts` so
existing imports keep working.

## Caps and failure modes

Measured against the four repositories named on the landing page:

| Repository | Tarball | Files | Code files after skip list |
|---|---|---|---|
| `vercel/next.js` | 50.7 MB | 31,847 | ~20,900 |
| `shadcn-ui/ui` | 21.5 MB | not measured | not measured |
| `drizzle-team/drizzle-orm` | 8.6 MB | not measured | not measured |
| `honojs/hono` | 1.7 MB | 609 | not measured |

`vercel/next.js` is the calibration case and it is the largest by a wide margin.
The caps are set to clear it with headroom:

- **Download cap: 100 MB compressed.** Roughly 2x the largest example.
- **Read cap: 50,000 files.** The count of files whose contents we read. Path
  collection is not capped, because paths are cheap. An earlier draft proposed
  20,000, which `vercel/next.js` would have tripped at ~20,900 code files.
- **Per file cap: 2 MB.** Larger files are counted in the tree but not read.

When a cap trips, collection stops, `RepoProfile.truncated` is set, and the
report states plainly which cap was hit and what that means for the score.

Other failure modes, each with a distinct message and no score:

| Condition | Behaviour |
|---|---|
| No `package.json` at root or in any workspace | refuse: not a JavaScript or TypeScript repository |
| Repository not found or private | refuse: cannot reach this repository |
| GitHub rate limit exhausted | refuse and retry later; a server-side token raises the ceiling |
| Empty repository | refuse: nothing to analyze |

The language check runs against the repository's file tree before the tarball
body is consumed, so a Python repository costs one request, not 50 MB.

## Testing

`bun test`, matching `apps/web/lib/parse-repo.test.ts`. No new framework.

- **Per detector.** Each `detect/` module gets a test built from a hand-written
  `RawFacts` fixture. These are the bulk of the tests and they are fast, exact,
  and need no network.
- **Threshold boundaries.** Every tunable cutoff gets a pair of cases, one on
  each side of the line. This is the check that fails if a threshold is edited
  carelessly.
- **The streaming pass.** One small committed tarball fixture, roughly 20 files,
  asserting that `collect()` produces the expected `RawFacts` and that
  `shouldReadContents` skips what it should.
- **Not-measured scoring.** A case asserting that a null signal is absent from
  both the numerator and the denominator, and that an all-null category renders
  unavailable rather than zero.
- **One end-to-end run,** manual and not in CI, against `honojs/hono` at a pinned
  commit. It is 1.7 MB and 609 files, so it is cheap to re-run by hand.

## Out of scope

Explicitly not in this design, and not to be built as part of it:

- The deep scan and its model calls.
- Caching, the database, and the commit SHA cache key.
- The `npx goodrepo` CLI. The `source/local.ts` feeder is designed for it but is
  not built here.
- The agent benchmark. It needs containers and long duration and will not run on
  Vercel Functions. Vercel Sandbox or Fly Machines are the candidates when it
  arrives.
- Ecosystem adapters for Python, Go, Rust and others.

## Open questions

These are known problems in the existing scoring model that this work surfaces.
They are product decisions, not analyzer decisions, and none of them block
implementation.

1. **Category weighting is now uneven per signal.** Context Efficiency holds 4
   signals and Discoverability holds 6, but each category is still worth one
   sixth of the overall score. Whether the six categories should be weighted
   equally is already an open product question in PRODUCT.md; this design makes
   it slightly sharper.
2. **The `featureFolders` heuristic is the weakest of the 40.** A type-name list
   is a crude proxy. It is defensible only because the evidence is shown. If it
   proves noisy against real repositories, moving it to not-measured is the
   honest fallback.
3. **Thresholds are first guesses.** Every `T` value in this document is
   reasoned, not calibrated. Running the analyzer over 50 to 100 well-regarded
   repositories and moving each cutoff to where the real distribution sits is
   worthwhile follow-up work, and it is cheap once the analyzer exists.
4. **`recommendations.ts` covers 13 of 40 signals.** Accepted for now by
   decision; the remaining 27 get copy in follow-up work. Until then a failed
   signal shows its evidence but no suggested fix, a partial gap against Product
   Principle 4.
