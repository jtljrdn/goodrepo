import { isTestFile } from "../skip"
import type { RawFacts } from "../types"
import { readPackageJson, readScripts } from "./manifest"

const FRAMEWORKS = ["vitest", "jest", "playwright", "bun", "mocha", "ava"] as const

const CONFIG_PATTERN = /^(vitest|jest|playwright)\.config\.[cm]?[jt]s$/

const CI_TEST = /\b(bun|npm|pnpm|yarn|npx)\s+(run\s+)?test\b|\b(vitest|jest|playwright)\b/

export function detectTests(facts: RawFacts) {
  const pkg = readPackageJson(facts)
  const scripts = readScripts(pkg)
  const testScript = scripts.test ?? ""

  const rootNames = facts.paths.filter((p) => !p.includes("/"))
  const configName = rootNames.find((name) => CONFIG_PATTERN.test(name))

  const fromConfig = configName ? (CONFIG_PATTERN.exec(configName)?.[1] ?? null) : null
  const fromScript = FRAMEWORKS.find((name) => testScript.includes(name)) ?? null

  const workflowText = [...facts.keptText]
    .filter(([path]) => path.startsWith(".github/workflows/"))
    .map(([, text]) => text)
    .join("\n")

  const coverageInConfig = [...facts.keptText].some(
    ([path, text]) => CONFIG_PATTERN.test(path) && /\bcoverage\b/.test(text)
  )

  return {
    testFramework: fromConfig ?? fromScript,
    testFiles: facts.paths.filter(isTestFile).length,
    has: {
      testScript: testScript.length > 0,
      testConfig: configName !== undefined,
      testsExist: facts.paths.some(isTestFile),
      coverage:
        Object.entries(scripts).some(
          ([name, cmd]) => name.includes("coverage") || cmd.includes("--coverage")
        ) || coverageInConfig,
      ciRunsTests: workflowText.length > 0 && CI_TEST.test(workflowText),
    },
  }
}
