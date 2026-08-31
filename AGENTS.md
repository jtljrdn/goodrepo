<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Architecture

Turborepo monorepo, Bun workspaces. Two workspace globs: `apps/*` and `packages/*`.

### Entry points

- `apps/web` — the Next.js App Router site. `app/page.tsx` is the landing page and scan form; `app/[owner]/[repo]/page.tsx` renders a report. There are no API routes; scanning happens in server components.
- `packages/analyzer` — the scan engine. `src/index.ts` exports `analyze()` plus the GitHub fetch helpers; `src/detect/*` holds one deterministic detector per signal family; `src/source/github.ts` is the only code that talks to the GitHub API.
- `packages/ui` — shared React components, Tailwind styles and the design tokens in `src/styles/globals.css`.
- `packages/eslint-config`, `packages/typescript-config` — shared config only, no runtime code.

### Where logic lives

- Repository facts and signal measurement: `packages/analyzer/src`. Anything that inspects a repo belongs here, not in the web app.
- Scoring and presentation: `apps/web/lib`. `score.ts` turns measurements into category scores, `recommendations.ts` turns failed signals into advice, `scan.ts` orchestrates fetch → analyze → score.
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
bun run typecheck    # tsc --noEmit across all workspaces
bun run build        # production build
```

### Running a single test

Tests use `bun:test`. Run one file, or one case within it, from the package that owns it:

```sh
cd packages/analyzer && bun test src/detect/docs.test.ts
cd packages/analyzer && bun test src/detect/docs.test.ts -t "case name"
```

Tests are pure and deterministic: no network, no database. Detector tests build fixture inputs in memory, so a new detector should be testable the same way.

## Environment

Env files live at the **repo root**, not in `apps/web`. Next.js only reads `.env*`
from its own project directory, so `apps/web/.env` and `apps/web/.env.local` are
symlinks pointing at the root files.

Both symlinks are gitignored, so recreate them once after a fresh clone:

```sh
ln -s ../../.env apps/web/.env
ln -s ../../.env.local apps/web/.env.local
```

Then copy `apps/web/.env.example` to `.env` at the root and fill it in. Only
`GITHUB_TOKEN` is used, and only to raise the GitHub API rate limit; scans of
public repositories work without it.

`.env.local` at the root is written by `vercel env pull`. Never edit it by hand.
