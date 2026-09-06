import { commands, scriptInvocation } from "../commands"
import { readPackageJson, readScripts } from "./manifest"
import { passes } from "../thresholds"
import type { RawFacts } from "../types"

const HEADING = /^#{1,6}\s+(.+)$/

const SECTIONS: { key: string; match: RegExp }[] = [
  {
    key: "architecture",
    match: /\b(architecture|structure|overview|layout)\b/,
  },
  { key: "testing", match: /\b(test|testing|tests)\b/ },
  { key: "database", match: /\b(database|schema|migration|migrations|orm)\b/ },
  { key: "api", match: /\b(api|routes|endpoints|handlers)\b/ },
  {
    key: "conventions",
    match: /\b(style|conventions|naming|lint|formatting)\b/,
  },
]

const SINGLE_TEST = [
  /\b(bun|npm|pnpm|yarn)\s+(run\s+)?test\s+[^\n`]*[\w./-]+\.(test|spec)\.[cm]?[jt]sx?/,
  /\b(vitest|jest|playwright)\s+(run\s+)?[\w./-]+\.(test|spec)\.[cm]?[jt]sx?/,
  /\b(bun|npm|pnpm|yarn|npx)?\s*(run\s+)?test\b[^\n`]*\s-t\s+["']/,
  /\b(vitest|jest)\b[^\n`]*\s(-t|--testNamePattern)\s/,
]

const TOOL_INSTRUCTIONS = [
  /^claude\.md$/,
  /^gemini\.md$/,
  /^\.cursorrules$/,
  /^\.cursor\/rules(\/|$)/,
  /^\.windsurfrules$/,
  /^\.clinerules$/,
  /^\.github\/copilot-instructions\.md$/,
]

export type DocApplies = {
  packageManager: string | null
  tests: boolean
  testScript: boolean
  buildScript: boolean
  devScript: boolean
  database: boolean
  api: boolean
}

function words(text: string): number {
  const stripped = text.replace(/```[\s\S]*?```/g, " ")
  const matched = stripped.match(/[A-Za-z0-9][A-Za-z0-9'-]*/g)
  return matched ? matched.length : 0
}

function headings(text: string): string[] {
  const found: string[] = []
  let title = ""
  let body = ""
  let fence: string | null = null
  const flush = () => {
    if (body.replace(/<!--[^]*?-->/g, "").trim())
      found.push(title.toLowerCase())
  }
  for (const line of text.split(/\r?\n/)) {
    const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1]
    if (marker) {
      if (!fence) fence = marker[0]!
      else if (marker[0] === fence) fence = null
      continue
    }
    const heading = !fence ? HEADING.exec(line) : null
    if (heading) {
      flush()
      title = heading[1] ?? ""
      body = ""
    } else body += `${line}\n`
  }
  flush()
  return found.filter(Boolean)
}

function documentedCommands(text: string): string[][] {
  const fragments = [...text.matchAll(/`([^`\n]+)`/g)].map((match) => match[1]!)
  let fenced = false
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*(`{3,}|~{3,})/.test(line)) {
      fenced = !fenced
      continue
    }
    if (
      fenced ||
      /^\s*(bun|npm|pnpm|yarn|npx|bunx|vitest|jest|playwright|node)\s/.test(
        line
      )
    )
      fragments.push(line.replace(/^\s*\$\s+/, ""))
  }
  return fragments.flatMap(commands)
}

function get(facts: RawFacts, name: string): string {
  for (const [path, text] of facts.keptText) {
    if (path.toLowerCase() === name) return text
  }
  return ""
}

export function detectDocs(facts: RawFacts, applies: DocApplies) {
  const readme = get(facts, "readme.md")
  const agents = get(facts, "agents.md")
  const claude = get(facts, "claude.md")
  const contributing = get(facts, "contributing.md")
  const extra = [...facts.keptText]
    .filter(([p]) =>
      /(^|\/)(gemini\.md|copilot-instructions\.md)$|^\.cursor\/rules\//i.test(p)
    )
    .map(([, text]) => text)
    .join("\n")
  const all = `${readme}\n${agents}\n${claude}\n${contributing}\n${extra}`
  const allHeadings = [
    ...headings(readme),
    ...headings(agents),
    ...headings(claude),
    ...headings(contributing),
    ...headings(extra),
  ]

  const sections = SECTIONS.filter((s) =>
    allHeadings.some((h) => s.match.test(h))
  ).map((s) => s.key)
  const has = (key: string) => sections.includes(key)

  const managerName = /^[a-z]+/.exec(applies.packageManager ?? "")?.[0] ?? ""
  const readmeWords = words(readme)

  const pkg = readPackageJson(facts)
  const scripts = readScripts(pkg)
  const invocations = documentedCommands(all)
  const names = invocations
    .map(scriptInvocation)
    .filter(
      (name): name is string =>
        name !== null &&
        (pkg === null ||
          name in scripts ||
          (name === "test" &&
            invocations.some((t) => t[0] === "bun" && t[1] === "test")))
    )
  const buildMentioned = names.some((name) => /^build($|:|-)/.test(name))
  const devMentioned = names.includes("dev")

  return {
    readmeWords,
    agentsMdWords: words(agents),
    sections,
    has: {
      readme: readme.length > 0,
      readmeDepth:
        readme.length > 0 ? passes("readmeWords", readmeWords) : null,
      agentsMd: agents.length > 0,
      claudeMd: facts.paths.some((p) =>
        TOOL_INSTRUCTIONS.some((re) => re.test(p.toLowerCase()))
      ),
      docPackageManager:
        managerName.length > 0
          ? invocations.some((tokens) => tokens[0] === managerName)
          : null,
      docTestCommand:
        applies.testScript || applies.tests
          ? names.some((name) => /^test($|:|-)/.test(name)) ||
            invocations.some((tokens) =>
              ["vitest", "jest", "playwright"].includes(tokens[0] ?? "")
            )
          : null,
      docBuildCommand:
        !applies.buildScript && !applies.devScript
          ? null
          : (!applies.buildScript || buildMentioned) &&
            (!applies.devScript || devMentioned),
      docArchitecture: has("architecture"),
      docDatabase: applies.database ? has("database") : null,
      docApiConventions: applies.api ? has("api") : null,
      docCodeStyle: has("conventions"),
      singleTestDocumented: applies.tests
        ? invocations.some((tokens) => {
            const invocation = scriptInvocation(tokens)
            if (pkg && invocation && !names.includes(invocation)) return false
            return (
              SINGLE_TEST.some((re) => re.test(tokens.join(" "))) ||
              (tokens.some((t) => ["-t", "--testNamePattern"].includes(t)) &&
                /\b(test|vitest|jest)\b/.test(tokens.join(" ")))
            )
          })
        : null,
    },
  }
}
