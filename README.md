# GoodRepo

GoodRepo scores how ready a repository is for AI coding agents, then tells you what to fix.

Point it at a public GitHub repository and it reads the file tree and a sample of files, measures 37 deterministic signals, and returns a score out of 100 across six categories: discoverability, instructions, testability, consistency, tooling and context efficiency. Every point is traceable to a signal, so nothing in the report is a guess. An optional deep scan adds model judgement on top of the static pass.

## Try it

Visit [goodrepo-web.vercel.app](https://goodrepo-web.vercel.app) and enter an `owner/repo`, or go straight to a report at `/<owner>/<repo>`.

## Agent skill

Install the agent-agnostic GoodRepo scan-and-fix workflow with the open Agent Skills CLI:

```sh
npx skills add jtljrdn/goodrepo
```

## Run it locally

Requires [Bun](https://bun.sh) 1.3.10 or later.

```sh
bun install
cp apps/web/.env.example .env
ln -s ../../.env apps/web/.env
bun run dev
```

Env files live at the repo root. Next.js only reads `.env*` from its own project directory, so `apps/web/.env` is a symlink to the root file. It is gitignored, so create it once per clone.

The app runs at `http://localhost:3000`. `GITHUB_TOKEN` is optional; without it you share the anonymous GitHub rate limit of 60 requests per hour.

```sh
bun run test        # every workspace test suite
bun run lint        # eslint
bun run typecheck   # tsc --noEmit
```

## Where the code lives

Turborepo monorepo with Bun workspaces.

| Path | What it holds |
| --- | --- |
| `apps/web` | Next.js App Router site: the scan form and the report page |
| `packages/analyzer` | The scan engine: GitHub fetching, signal detectors, thresholds |
| `packages/ui` | Shared React components and Tailwind styles |
| `packages/eslint-config`, `packages/typescript-config` | Shared config |
| `skills/goodrepo-scan` | The published agent skill |

See [AGENTS.md](AGENTS.md) for architecture boundaries, dependency rules and conventions.
