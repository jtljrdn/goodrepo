import { passes } from "../thresholds"
import type { RawFacts } from "../types"

const HEADING = /^#{1,6}\s+(.+)$/gm

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
  HEADING.lastIndex = 0
  const found: string[] = []
  let match: RegExpExecArray | null
  while ((match = HEADING.exec(text)) !== null) {
    if (match[1]) found.push(match[1].toLowerCase())
  }
  return found
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
  const all = `${readme}\n${agents}\n${claude}\n${contributing}`
  const allHeadings = [
    ...headings(readme),
    ...headings(agents),
    ...headings(claude),
    ...headings(contributing),
  ]

  const sections = SECTIONS.filter((s) =>
    allHeadings.some((h) => s.match.test(h))
  ).map((s) => s.key)
  const has = (key: string) => sections.includes(key)

  const managerName = /^[a-z]+/.exec(applies.packageManager ?? "")?.[0] ?? ""
  const readmeWords = words(readme)

  const buildMentioned = /\brun\s+build\b|\bbuild\b/.test(all)
  const devMentioned = /\brun\s+dev\b|\bdev\b/.test(all)

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
          ? new RegExp(`\\b${managerName}\\b`).test(all)
          : null,
      docTestCommand:
        applies.testScript || applies.tests
          ? /\b(run\s+)?test\b/.test(all) || has("testing")
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
        ? SINGLE_TEST.some((re) => re.test(all))
        : null,
    },
  }
}
