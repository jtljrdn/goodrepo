<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Architecture

Turborepo monorepo, Bun workspaces. Two workspace globs: `apps/*` and `packages/*`.

### Entry points

- `apps/web` — the Next.js App Router site. `app/page.tsx` is the landing page and scan form; `app/[owner]/[repo]/page.tsx` renders the free static report and `app/[owner]/[repo]/deep/page.tsx` the same report with the deep scan folded in. There are no API routes; scanning happens in server components.
- `packages/analyzer` — the scan engine. `src/index.ts` exports `analyze()` plus the GitHub fetch helpers; `src/detect/*` holds one deterministic detector per signal family; `src/source/github.ts` is the only code that talks to the GitHub API.
- `packages/ui` — shared React components, Tailwind styles and the design tokens in `src/styles/globals.css`.
- `packages/eslint-config`, `packages/typescript-config` — shared config only, no runtime code.

### Where logic lives

- Repository facts and signal measurement: `packages/analyzer/src`. Anything that inspects a repo belongs here, not in the web app.
- Scoring and presentation: `apps/web/lib`. `score.ts` turns measurements into category scores, `recommendations.ts` turns failed signals into advice, `scan.ts` orchestrates fetch → analyze → score, and `deep.ts` runs the sandboxed model pass on top of a finished static scan and rescores.

The deep scan is a separate route on purpose. The free scan must keep costing nothing and
staying fast, so nothing on `/[owner]/[repo]` may reach the model or the sandbox. Both routes
cache by commit SHA with `"use cache: remote"`; a deep run that cannot finish throws rather
than returning so the failure is not cached, and the page degrades to the static report.
The deep route is not yet gated behind an account, so it is `noindex` and its link is
`prefetch={false}`.
- Point values and pass/fail cutoffs live in `packages/analyzer/src/thresholds.ts`. Change them there, never inline at a call site.

### Dependency direction

`apps/web` → `@workspace/analyzer`, `@workspace/ui` → shared configs.

Packages must not import from `apps/`. `@workspace/analyzer` must stay free of React and Next.js so it can run outside the web app.

### Do not modify

- `node_modules/`, `apps/web/.next/`, `.turbo/`, `.vercel/` — generated.
- `bun.lock` — regenerate with `bun install`, never hand-edit.
- `skills/goodrepo-scan/` — the published agent skill; edit only when changing the skill itself.

## Commands

Run from the repo root unless noted.

```sh
bun install          # install workspace dependencies
bun run dev          # start the web app
bun run test         # run every workspace test suite
bun run lint         # eslint across all workspaces
bun run typecheck    # next typegen, then tsc --noEmit across all workspaces
bun run build        # production build
```

### Running a single test

Tests use `bun:test`. Run one file, or one case within it, from the package that owns it:

```sh
cd packages/analyzer && bun test src/detect/docs.test.ts
cd packages/analyzer && bun test src/detect/docs.test.ts -t "case name"
```

`web`'s typecheck runs `next typegen` first. `PageProps` and the other route type
helpers are generated into `.next/types`, so `tsc` alone fails on a clean checkout
with `Cannot find name 'PageProps'`. Never hand-write those types.

Tests are pure and deterministic: no network, no database. Detector tests build fixture inputs in memory, so a new detector should be testable the same way.

## Environment

Env files live at the **repo root**, not in `apps/web`. The web workspace scripts
use Bun's `--env-file` option to load `../../.env` followed by
`../../.env.local`; the latter takes precedence. `turbo.json` tracks both root
files as global dependencies for cache correctness. Do not create app-local env
files, symlinks, or custom env launchers.

Prefer `.env.local`, generated at the root by `vercel env pull .env.local`.
Developers not using Vercel can copy `.env.example` to `.env.local` and fill it
in. Only `GITHUB_TOKEN` is used, and only to raise the GitHub API rate limit;
scans of public repositories work without it. A root `.env` is supported as a
lower priority fallback but is not required.
