import type { RawFacts } from "../types"

const LINT_CONFIGS = [
  /^eslint\.config\.[cm]?[jt]s$/,
  /^\.eslintrc(\.[a-z]+)?$/,
  /^biome\.jsonc?$/,
  /^\.oxlintrc\.json$/,
]

const ENV_TEMPLATES = [".env.example", ".env.sample", ".env.template"]
const CONTAINER_FILES = [
  "dockerfile",
  "compose.yaml",
  "compose.yml",
  "docker-compose.yml",
]

export function detectTooling(facts: RawFacts, library: boolean) {
  const rootNames = facts.paths.filter((p) => !p.includes("/"))
  const lower = new Set(rootNames.map((n) => n.toLowerCase()))

  const sampled = facts.codeFiles.filter((f) => f.readsEnv !== undefined)
  const readsEnv =
    sampled.length === 0 ? null : sampled.some((f) => f.readsEnv === true)
  const envTemplate = ENV_TEMPLATES.some((name) => lower.has(name))

  return {
    has: {
      lintConfig: rootNames.some((name) =>
        LINT_CONFIGS.some((re) => re.test(name))
      ),
      envExample: envTemplate ? true : readsEnv === false ? null : false,
      container: library
        ? null
        : CONTAINER_FILES.some((name) => lower.has(name)) ||
          facts.paths.some((p) => p.startsWith(".devcontainer/")),
      ciWorkflow: facts.paths.some(
        (p) => p.startsWith(".github/workflows/") && /\.ya?ml$/.test(p)
      ),
    },
  }
}
