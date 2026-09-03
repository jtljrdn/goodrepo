<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Architecture

Turborepo monorepo, Bun workspaces. Two workspace globs: `apps/*` and `packages/*`.

### Entry points

- `apps/web` — the Next.js App Router site. `app/page.tsx` is the landing page and scan form; `app/[owner]/[repo]/page.tsx` renders the free static report, `app/[owner]/[repo]/deep/page.tsx` the same report with the deep scan folded in, and `app/[owner]/[repo]/private/page.tsx` the report for a repository only the signed-in user can see. Scanning happens in server components, not API routes; the only route handler is
`app/api/auth/[...all]/route.ts`, which Better Auth owns. `app/sign-in/page.tsx` is the one
account surface, and it is where the deep and private routes send anonymous visitors.

**GitHub is the only way to sign in.** `emailAndPassword` is deliberately absent from
`lib/auth.ts` rather than merely hidden in the UI, because the sign-in and sign-up email
endpoints both gate on that flag: leaving it on while removing the form would keep the API
open. It also means every account carries an email GitHub already verified, so this app sends
no mail and owns no password reset. Re-adding email and password means owning both.
- `packages/analyzer` — the scan engine. `src/index.ts` exports `analyze()` plus the GitHub fetch helpers; `src/detect/*` holds one deterministic detector per signal family; `src/source/github.ts` is the only code that talks to the GitHub API.
- `packages/ui` — shared React components, Tailwind styles and the design tokens in `src/styles/globals.css`.
- `packages/eslint-config`, `packages/typescript-config` — shared config only, no runtime code.

### Where logic lives

- Repository facts and signal measurement: `packages/analyzer/src`. Anything that inspects a repo belongs here, not in the web app.
- Scoring and presentation: `apps/web/lib`. `score.ts` turns measurements into category scores, `recommendations.ts` turns failed signals into advice, `scan.ts` orchestrates fetch → analyze → score, and `deep.ts` runs the sandboxed model pass on top of a finished static scan and rescores.

The deep scan is a separate route on purpose. The free scan must keep costing nothing and
staying fast, so nothing on `/[owner]/[repo]` may reach the model or the sandbox. A deep run
that cannot finish throws rather than returning, so the failure is not cached and the page
degrades to the static report.

**Deep scans are off by default.** `DEEP_SCAN_ENABLED` in `lib/flags.ts` reads
`GOODREPO_DEEP_SCAN`, and while it is false the route 404s and the button does not render. Set
`GOODREPO_DEEP_SCAN=1` in the root `.env.local` to work on it. Keep the flag: it is the master
kill switch, and it is the only thing that stops a deep scan without a database round trip. The
route is also `noindex` and its link is `prefetch={false}`. Note that the disabled route answers
`200` with the 404 page rather than a `404` status, because the partial-prerender shell is
flushed before `notFound()` runs.

**Nothing reaches the sandbox without a signed-in account and a claimed quota slot.** The
deep route redirects anonymous visitors to `/sign-in?next=…`, and `runDeepScan` takes a
`userId` as a *required* argument so no future caller can spend money by forgetting a check
that lives somewhere else. `lib/quota.ts` owns both limits: `DAILY_RUNS_PER_ACCOUNT` per
account per rolling day, and `MONTHLY_RUNS_TOTAL` for the whole site per UTC month, which is
the spend ceiling expressed in runs. The monthly one reads `GOODREPO_MONTHLY_DEEP_SCANS` so it
can be lowered, or set to `0`, without a deploy; anything that is not a whole count falls back
to the default with a warning, because `n >= NaN` is false and a typo would otherwise remove
the ceiling silently. Read both from `lib/quota.ts`, never from the environment at a call
site.

A claim writes one row into `goodrepo.deep_scan_run` (see `supabase/migrations/`) *before* the
scan starts, under a transaction-scoped advisory lock, so parallel requests cannot each read
the same count and each decide they are under the cap. The unique constraint on
`(user_id, owner, repo, commit_sha)` is what makes re-reading a report you already ran free.
`decideClaim` is the pure half and is unit tested; the SQL only feeds it counts. Deleting an
account nulls its rows rather than removing them, so the month's spend cannot be reset by
deleting a user.

**App tables go in the `goodrepo` schema, not `public`.** `public` is what Supabase exposes
through PostgREST, and this project's default privileges there grant `anon` and `authenticated`
full rights on every new table, leaving RLS as the only thing between the publishable key and
the data. Nothing in this app is read through the Data API; it connects directly as `postgres`.
So new tables belong in `goodrepo`, fully qualified at every call site, with RLS enabled as
belt and braces. Do not add them to `better_auth` either: that schema belongs to Better Auth's
CLI.

**A private scan reads as the user and is never cached.** `runPrivateScan` in `lib/scan.ts`
takes the reader's own GitHub token, so it sees exactly what their GitHub App installation
covers and nothing else. It deliberately bypasses `scanAtSha`: that cache is keyed by
`(owner, repo, sha)` with no user in the key, and it is shared with anonymous visitors, the
crawler and the OG image, so a single private report written into it would be readable by
anyone who guessed the URL. **Do not "unify" the two paths through one cached function.**
Not caching also means a report cannot outlive the access that produced it. The route is
`noindex`, its links are `prefetch={false}` and `rel="nofollow"`, and it renders with
`deepAvailable={false}` because the deep scan clones as GoodRepo itself and cannot reach a
private repository.

Both *public* scans cache by commit through `cachedByCommit` in `lib/cache.ts`, which wraps
`unstable_cache`. **Do not replace it with `use cache`.** Next composes its cache key from the
build or deployment ID, so nothing cached that way survives a deploy, and the deep scan pays a
model per miss. `unstable_cache` is what the Next reference itself names for data that must
persist across deploys.

The price of outliving the deployment is that invalidation becomes manual. Each cache carries a
`version` string in `cachedByCommit(name, version, fn)`. **Bump it whenever the code that
produced the cached values changes** — a detector, a threshold, the scoring, the agent's
questions, or the cached shape — or old reports keep being served. Errors are never cached, so
anything transient (a GitHub rate limit, a sandbox that died) must throw rather than return.
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
in. A root `.env` is supported as a lower priority fallback but is not required.

`GITHUB_TOKEN` only raises the GitHub API rate limit; fast scans of public
repositories work without it. `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` and
`DATABASE_URL` are needed for anything behind sign-in, which today means only the
deep scan. `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are a GitHub **App**,
unrelated to `GITHUB_TOKEN`; both must be present or `lib/auth.ts` registers no
social provider, which is how a checkout without them still runs: the sign-in page
says so and fast scans are unaffected. `GITHUB_APP_SLUG` only builds the install link. Every one of
these is declared in `turbo.json`'s task `env` lists as well, or Turbo caches
across values that should have busted it.

**Not an OAuth app, and do not swap it back for one.** The user-to-server flow
runs on the same two endpoints, so the Better Auth `github` provider is identical
either way, but the access it grants is not. An OAuth app's only scope that opens
a private repository is `repo`, which is read *and* write on every private
repository the user can touch, granted in one click with no way to narrow it. A
GitHub App gets repository `Contents` and `Metadata` read-only on the repositories
the user installs it on, and on no others. That is why nothing in this app sets
`scope`: a user token carries none, `disableDefaultScope` is on, and widening
access means editing the app's permissions and re-consent, never editing code.
Access still stops at the intersection of the app's permissions and the user's
own, so the app can never read what the signed-in user could not.
