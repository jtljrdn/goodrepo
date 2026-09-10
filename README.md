# GoodRepo

GoodRepo measures how ready a repository is for AI coding agents and turns the
result into concrete improvements. Give it a public GitHub repository and the
free static scan inspects the file tree, configuration, documentation, tests,
and source samples without executing repository code. It scores deterministic
signals across discoverability, instructions, testability, consistency,
tooling, and context efficiency, with the evidence for every result included in
the report.

Signed-in users can keep scan history, compare immutable snapshots, and save a
selected fix plan. An optional, quota-controlled deep scan adds model judgement
for signals that static analysis cannot settle. Private scans use the signed-in
user's read-only GitHub App access and never enter the public report cache.

## Try it

Visit [goodrepo.dev](https://goodrepo.dev) and enter an `owner/repo`, or open a
public report directly at `https://goodrepo.dev/<owner>/<repo>`.

## Agent skill

Install the agent-agnostic GoodRepo scan-and-fix workflow with the open Agent Skills CLI:

```sh
npx skills add jtljrdn/goodrepo
```

## Run it locally

```sh
git clone https://github.com/jtljrdn/goodrepo.git
cd goodrepo
bun install
cp .env.example .env.local
bun run dev
```

Fast scans of public repositories work without credentials. Set `GITHUB_TOKEN`
only to raise GitHub's API rate limit; use a fine-grained token with public
repository read access and no write permissions. Sign-in, history, private
scans, and deep scans need the additional settings documented in
[`.env.example`](.env.example). If this checkout is linked to Vercel, you can
populate the same root file with `vercel env pull .env.local`.

The repository pins Bun in `package.json` and Node in `.node-version`. CI runs
the same install, lint, typecheck, and coverage-enabled test commands used
locally:

```sh
bun run lint
bun run typecheck
bun run test
bun run test:coverage
```

## Where the code lives

Turborepo monorepo with Bun workspaces.

| Path | What it holds |
| --- | --- |
| `apps/web` | Next.js App Router site, auth, scoring, scan orchestration, and reports |
| `packages/analyzer` | Framework-neutral GitHub fetching, deterministic detectors, and the deep pass |
| `packages/ui` | Shared React components and Tailwind styles |
| `packages/eslint-config`, `packages/typescript-config` | Shared config |
| `skills/goodrepo-scan` | The published agent skill |

See [AGENTS.md](AGENTS.md) for architecture boundaries, database migrations,
server boundaries, validation, and coding conventions.
