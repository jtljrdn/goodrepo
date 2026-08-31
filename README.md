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

```sh
git clone https://github.com/jtljrdn/goodrepo.git
cd goodrepo
bun install
cp .env.example .env.local // or vercel env pull .env.local
bun run dev
```

The only environment variable that needs to be set is `GITHUB_TOKEN`, which can be obtained from [GitHub](https://github.com/settings/tokens). I recommend
a fine-grained token with only the public repository read access and no other permissions.

## Where the code lives

Turborepo monorepo with Bun workspaces.

| Path | What it holds |
| --- | --- |
| `apps/web` | Next.js App Router site: the scan form and the report page |
| `packages/analyzer` | The scan engine: GitHub fetching, signal detectors, thresholds |
| `packages/ui` | Shared React components and Tailwind styles |
| `packages/eslint-config`, `packages/typescript-config` | Shared config |
| `skills/goodrepo-scan` | The published agent skill |

See [AGENTS.md](AGENTS.md) for architecture boundaries, dependency rules, and conventions.
