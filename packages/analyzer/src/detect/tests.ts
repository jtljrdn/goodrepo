import { isTestFile } from "../skip"
import type { RawFacts } from "../types"
import { readPackageJson, readScripts } from "./manifest"

const FRAMEWORKS = [
  "vitest",
  "jest",
  "playwright",
  "node --test",
  "bun",
  "mocha",
  "ava",
] as const

const CONFIG_PATTERN = /^(vitest|jest|playwright)\.config\.[cm]?[jt]s$/

// A root script that fans out to workspaces names no runner of its own.
const DELEGATES = /\b(turbo|nx|lerna|moon)\b|--filter|--workspaces|\s-r\b/

const CI_TEST =
  /\b(bun|npm|pnpm|yarn|npx)\s+(run\s+)?test\b|\b(vitest|jest|playwright)\b/

export function detectTests(facts: RawFacts) {
  const pkg = readPackageJson(facts)
  const scripts = readScripts(pkg)
  const testScript = scripts.test ?? ""

  const rootNames = facts.paths.filter((p) => !p.includes("/"))
  const configName = rootNames.find((name) => CONFIG_PATTERN.test(name))

  const fromConfig = configName
    ? (CONFIG_PATTERN.exec(configName)?.[1] ?? null)
    : null
  const fromScript =
    FRAMEWORKS.find((name) => testScript.includes(name)) ?? null
  const delegates = fromScript === null && DELEGATES.test(testScript)

  const workflowText = [...facts.keptText]
    .filter(([path]) => path.startsWith(".github/workflows/"))
    .map(([, text]) => text)
    .join("\n")

  const coverageInConfig = [...facts.keptText].some(
    ([path, text]) => CONFIG_PATTERN.test(path) && /\bcoverage\b/.test(text)
  )

  const testFiles = facts.paths.filter(isTestFile).length

  return {
    testFramework: fromConfig ?? fromScript,
    testFiles,
    has: {
      testScript: testScript.length > 0,
      testConfig: delegates
        ? null
        : configName !== undefined || fromScript !== null,
      testsExist: testFiles > 0,
      coverage:
        testFiles === 0
          ? null
          : Object.entries(scripts).some(
              ([name, cmd]) =>
                name.includes("coverage") || cmd.includes("--coverage")
            ) || coverageInConfig,
      ciRunsTests:
        workflowText.length === 0 ? null : CI_TEST.test(workflowText),
    },
  }
}
