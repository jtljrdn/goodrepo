import { posix } from "node:path"
import { jsonObject } from "../workspaces"
import { parse as parseYaml } from "yaml"
import { commands, runsTests, usableScript } from "../commands"
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

function ciTests(
  text: string,
  scripts: Record<string, string>,
  facts: RawFacts
): boolean | null {
  try {
    const workflow = parseYaml(text, { maxAliasCount: 0 })
    if (!workflow || typeof workflow !== "object") return null
    const jobs: unknown[] =
      workflow.jobs && typeof workflow.jobs === "object"
        ? Object.values(workflow.jobs)
        : [workflow]
    let unknown = false
    for (const value of jobs) {
      if (!value || typeof value !== "object") continue
      const job = value as Record<string, unknown>
      if (job.if === false || job.if === "false" || job.if === "${{ false }}")
        continue
      if (job.uses) unknown = true
      if (!Array.isArray(job.steps)) continue
      for (const step of job.steps) {
        if (
          !step ||
          typeof step !== "object" ||
          step.if === false ||
          step.if === "false" ||
          step.if === "${{ false }}"
        )
          continue
        if (typeof step.run === "string") {
          const defaults = job.defaults as
            { run?: { "working-directory"?: unknown } } | undefined
          const directory =
            step["working-directory"] ??
            defaults?.run?.["working-directory"] ??
            workflow.defaults?.run?.["working-directory"] ??
            "."
          if (typeof directory !== "string" || directory.includes("${{")) {
            unknown = true
            continue
          }
          let cwd = posix.normalize(directory)
          for (const tokens of commands(step.run)) {
            if (tokens[0] === "cd") {
              cwd = posix.join(cwd, tokens[1] ?? ".")
              continue
            }
            let localScripts = scripts
            if (cwd !== ".") {
              const manifest = jsonObject(
                facts.keptText.get(`${cwd}/package.json`)
              )
              if (!manifest) {
                unknown = true
                continue
              }
              localScripts = readScripts(manifest)
            }
            // Preserve quoting while passing a single parsed command to the script resolver.
            const command = tokens
              .map((token) => JSON.stringify(token))
              .join(" ")
            if (runsTests(command, localScripts)) return true
          }
        }
        if (typeof step.uses === "string" && step.uses.startsWith("./"))
          unknown = true
      }
    }
    return unknown ? null : false
  } catch {
    return null
  }
}

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
    FRAMEWORKS.find((name) =>
      commands(testScript).some((tokens) =>
        name === "bun"
          ? tokens[0] === "bun" && tokens[1] === "test"
          : name === "node --test"
            ? tokens[0] === "node" && tokens.includes("--test")
            : tokens[0] === name
      )
    ) ?? null
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
      testScript: usableScript(testScript),
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
        workflowText.length === 0
          ? null
          : (() => {
              const values = [...facts.keptText]
                .filter(
                  ([p]) =>
                    p.startsWith(".github/workflows/") && /\.ya?ml$/.test(p)
                )
                .map(([, text]) => ciTests(text, scripts, facts))
              return values.includes(true)
                ? true
                : values.includes(null)
                  ? null
                  : false
            })(),
    },
  }
}
