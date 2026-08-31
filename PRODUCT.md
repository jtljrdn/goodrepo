# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Confirmed and installed: Turborepo monorepo on Bun (Node 20+), Next.js 16 App
Router, React 19, TypeScript strict, Tailwind v4, shadcn/ui, `next-themes`,
Hugeicons.

Intended and not yet installed: Postgres with Drizzle ORM for cached results,
the GitHub API for ingestion, and the Vercel AI SDK fronting Anthropic or OpenAI
for targeted analysis. Background jobs are deferred until repository analysis
actually needs them.

No authentication in the first versions. A user pastes a public repository and
gets value immediately.

## Users

Primary: solo developers and small teams who work in their own repositories and
use coding agents (Claude Code, Codex, Cursor) daily. They arrive with one
repository in mind and want to know whether the agent's failures are the agent's
fault or the repository's.

Larger teams and platform engineers can use the same scan, and the benchmark
tier is aimed at teams with real engineering history to mine. But solo and
small-team use is the situation the product is designed around: one person, one
repository, no sign-up, no procurement.

## Product Purpose

GoodRepo analyzes a repository and answers one question: **how easy is this
codebase for AI coding agents to understand and work in?**

It returns an Agent Readiness Score out of 100, six category scores, the
evidence behind every point, and prioritized recommendations for raising it.

Success for the first version is narrow and testable: developers find the score
and recommendations interesting enough to scan their repositories and share the
results. Not revenue, not retention — interest and sharing.

## Positioning

The score is computed from measurable repository signals, not produced by asking
a model to rate the repository.

> Avoid: "Claude thinks this repo is a 74/100."
> Prefer: "This repo scored 74 because of these measurable signals."

The governing architectural principle for the whole project: **use traditional
software analysis wherever possible and spend AI tokens only where intelligence
actually adds value.** Parse everything, sample intelligently, infer
selectively.

Models are used for interpreting signals, spotting patterns that resist
deterministic capture, analyzing a small number of representative code samples,
generating recommendations, and summarizing findings. They are not used to
produce the number.

A neighboring "LLM rates your repo" product cannot truthfully make this claim.

## Operating Context

### Core user flow

1. User lands on GoodRepo.
2. User pastes a GitHub repository URL or `owner/repo`.
3. GoodRepo fetches repository metadata and files.
4. Deterministic analysis runs.
5. A compact repository profile is generated.
6. Targeted AI analysis runs only where useful.
7. User receives an Agent Readiness Score.
8. User explores category scores and evidence.
9. User receives prioritized recommendations.
10. User shares the report URL.

Report URLs are structural and shareable: `/github/vercel/next.js`.

### Analysis levels

**Fast scan** — the default web experience. Deterministic; zero model tokens
where possible. Produces the readiness score, repository metadata, documentation
analysis, tooling analysis, testability, obvious issues, and simple
recommendations.

**Deep scan** — optional, opt-in. Targeted model calls against the repository
profile, the instruction files, and selected representative files. Produces
architecture observations, consistency analysis, context recommendations, and a
richer AGENTS.md recommendation.

**Agent benchmark** — expensive, explicitly initiated, never automatic. Runs
real coding agents against tasks in isolated copies of the repository.

### The deterministic scan

Stage one requires zero model tokens and collects: file tree, file counts,
directory depth, language distribution, framework, `package.json`, package
manager, scripts, test config, lint config, TypeScript config, README,
`AGENTS.md`, `CLAUDE.md`, `.cursor/rules`, Copilot instructions,
Docker/devcontainer config, environment templates, repeated folder structures,
major architectural boundaries, and obvious duplicate patterns.

### The repository profile

The scan compresses the repository into a compact structured representation.
This profile, not raw repository contents, is the main input to any model call.

```json
{
  "framework": "nextjs",
  "files": 842,
  "maxDirectoryDepth": 7,
  "hasAgentsMd": true,
  "hasClaudeMd": false,
  "scripts": { "test": "vitest", "lint": "eslint", "typecheck": "tsc --noEmit" },
  "testFramework": "vitest",
  "apiRoutes": 18,
  "validationPatterns": ["zod", "manual", "zod"],
  "docs": { "readmeWords": 1820, "agentsMdWords": 640 }
}
```

### Targeted sampling

When deeper analysis is needed, only representative files or snippets are sent.
To judge API consistency: detect all routes programmatically, cluster them,
select three to five representatives, and ask the model to compare those. Not
all eighty routes. The same strategy applies to services, database queries,
React components, tests, server actions, middleware, validation patterns, and
error handling. Structural analysis comes before spending tokens.

### Token budgets

Every analysis carries an explicit, enforced budget. Working targets: fast scan
0 tokens; deep scan 5k–10k input tokens maximum; final synthesis 1k–3k. Within
a deep scan: documentation analysis max 4k, pattern samples max 4k, final
synthesis max 2k. When a scan reaches its budget it stops gathering source
material and produces the report from the evidence it has. Prompts are never
built dynamically in proportion to repository size.

### Caching

Public repository analysis is cached aggressively by repository and commit SHA
(`github:owner/repo@commit_sha`). A cache hit reuses the parsed profile, static
scores, detected patterns, AI analysis, recommendations, and final report. Ten
people scanning the same version of `vercel/next.js` must not cause ten
identical model calls. A new scan is generally required only when the commit SHA
changes.

### Planned CLI and benchmark surface

- `npx goodrepo` — deeper analysis of local and private repositories. Builds the
  compact profile locally and optionally uploads only that profile, so source
  code never has to leave the machine. Ends by printing a score and a hosted
  report URL.
- `npx goodrepo benchmark` — generates or accepts representative coding tasks and
  runs coding agents against isolated repository copies. Measures task success,
  tests passing, files inspected, files modified, token usage, cost, runtime,
  and scope violations. Shows an estimated model cost and asks for confirmation
  before running. For the personal-project version, users supply their own model
  API credentials locally rather than GoodRepo paying for agent execution.
- **Generated benchmark tasks** — GoodRepo proposes candidate tasks grouped by area
  so users do not hand-write an evaluation suite; the user selects which are
  representative before running.
- **Git history as eval data** — merged pull requests already contain a starting
  commit, a task description, and a final implementation. GoodRepo identifies
  suitable historical PRs, restores the repository to the commit before each,
  gives the agent the original description, runs deterministic checks, and
  compares against the historical implementation. This turns a team's own
  engineering history into a repository-specific agent benchmark.
- `npx goodrepo optimize` — proposes repository changes (better AGENTS.md,
  architecture docs, clearer test commands, more consistent patterns), and in
  its strongest form runs a control-versus-variant experiment to test whether a
  recommendation actually improves agent performance.

The full loop the product is aiming at: scan → score → recommend → apply →
benchmark → measure improvement.

## Capabilities and Constraints

### Real today

- A Next.js 16 / React 19 web prototype (`apps/web`): landing page, scan input,
  loading state, and a full report route at `/github/[owner]/[repo]`.
- The scoring model in `apps/web/lib/score.ts` — six categories, each built from
  weighted binary signals with `label` and `missing` copy per signal. Category
  score is earned points over total points; overall is the unweighted mean of
  the six. Bands: 80+ good, 60+ fair, below 60 poor.
- Recommendation copy keyed by signal id in `apps/web/lib/recommendations.ts`,
  each carrying evidence, a fix, and bullets, tagged `static` or `deep`.
- A shared UI package (`packages/ui`) on Tailwind v4 and shadcn.

### Not real today — never describe as shipped

- Repository fetching or analysis of any kind. `buildProfile()` in
  `apps/web/lib/profile.ts` returns deterministic **fake** data seeded from the
  `owner/repo` string. No GitHub API call happens. The report route also sleeps
  1.1 seconds so the loading state is visible.
- The `npx goodrepo` CLI, `benchmark`, and `optimize`.
- Deep scan and its bring-your-own-key flow.
- Result caching, the database, accounts, and payment.

Mocked analysis data is the deliberate, correct state for the earliest UI
prototype. The build order after it: GitHub ingestion → deterministic profiling
→ explainable category scoring → targeted LLM analysis → recommendation
generation → caching by commit SHA. Coding-agent benchmarks come last, not
first.

### The six categories

| Category | Question it answers |
|---|---|
| Discoverability | Can an agent quickly find the code that matters? |
| Instructions | Are agent-facing instructions present and complete? |
| Testability | Can an agent verify its own changes? |
| Consistency | Does the codebase repeat the same patterns? |
| Tooling | Is setup, build, lint and test behaviour obvious? |
| Context Efficiency | How much must an agent read to make one change? |

### Technical constraints

- Turborepo monorepo on Bun, Node 20+, `apps/*` and `packages/*` workspaces.
- Next.js 16 in this repository has breaking changes from earlier versions. The
  guides in `node_modules/next/dist/docs/` are the authority, not prior habit.
- TypeScript strict. `as any` is not acceptable.

### Terminology

**signal** (one binary check), **category** (a group of signals), **profile**
(the compact repository representation a scan produces), **fast / deep /
benchmark** (the three analysis levels), **Agent Readiness Score** (the headline
number out of 100).

## Brand Commitments

- The product name is **GoodRepo**, one word, capital G and capital R, in every
  position including mid-sentence. The CLI binary and the npm package name are
  lowercase `goodrepo`. Two earlier working names are superseded and must not
  reappear in code, copy, or documentation: "Trace" (with `trace.dev`), used
  throughout the written spec, and "rigor", used in the prototype and still the
  name of the repository directory.
- Voice is plain, technical, and unhyped. It states what is measured and what it
  costs, and does not promise intelligence it has not spent tokens on.
- Incumbent identity in `apps/web`: monospace-forward (JetBrains Mono primary,
  Geist as the sans companion), hairline borders, unrounded chrome, light and
  dark via `next-themes`. Icons from Hugeicons.
- Stated by the user in the spec, recorded without expansion: the report is the
  primary product surface, not a dashboard around it; the reference set is
  Vercel, Linear, and Mintlify. Every other visual decision belongs to DESIGN.md
  and the surface briefs, not here.

## Evidence on Hand

- The scoring model and its full signal list are real, considered work and are
  the strongest asset to show.
- Example repositories named on the landing page (vercel/next.js, shadcn-ui/ui,
  drizzle-team/drizzle-orm, honojs/hono) are illustrative targets, **not** scans
  that have been run. Every number visible in the current UI is seeded fake
  data.
- There are no users, no testimonials, no benchmark results, no accuracy or
  agent-performance claims, no press, no customers, and no pricing. Future work
  must not invent any of these.
- Token figures ("0 tokens", "~10k tokens") and the before/after benchmark
  table in the spec are design intent and illustrative examples, not
  measurements. They must never be presented as results.

## Product Principles

1. **Every point is traceable.** A score with no visible evidence behind it is
   worse than no score.
2. **Parse everything, sample intelligently, infer selectively.** Determinism
   first; model calls only where judgement beats parsing.
3. **State the cost before spending it.** The user always knows which level they
   are on and what it costs in tokens, money, or compute. Expensive work is
   opt-in and never automatic.
4. **A result must end in an action.** The report's job is not the number, it is
   the next change the developer makes.
5. **Do not claim what has not run.** Unavailable levels are shown as
   unavailable, never implied to have contributed to the result.
6. **The report is the product.** It must be worth sharing on its own.

## Open Decisions

- **Business model:** fast scan free, deep scan paid or bring-your-own-key.
  Pricing, limits, and whether payment or BYOK ships first are undecided.
- Category weighting is currently equal by deliberate default; whether the six
  categories should be weighted differently is an open product question.
- Whether private repositories are served by the CLI path only, or eventually by
  a GitHub App, is undecided.
- Whether deep-scan results are cached and shared across users the way fast-scan
  results are, given they may be paid for by an individual, is undecided.
