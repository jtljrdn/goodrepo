import { isCodeFile, isKeptFile, isTestFile } from "./skip"
import { CAPS } from "./thresholds"
import type { CodeFileFacts, RawFacts, TreeEntry } from "./types"

const IMPORT_PATTERNS = [
  /(?:^|\s)import\s+(?:[\w*{}\n\r\t, ]+\s+from\s+)?["']([^"']+)["']/g,
  /(?:^|\s)export\s+(?:[\w*{}\n\r\t, ]+\s+)?from\s+["']([^"']+)["']/g,
  /\brequire\(\s*["']([^"']+)["']\s*\)/g,
  /\bimport\(\s*["']([^"']+)["']\s*\)/g,
]

function stripCommentsAndStrings(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ")
    .replace(/`(?:[^`\\]|\\.)*`/g, "``")
}

export function extractImports(source: string): string[] {
  const cleaned = stripCommentsAndStrings(source)
  const found = new Set<string>()
  for (const pattern of IMPORT_PATTERNS) {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(cleaned)) !== null) {
      if (match[1]) found.add(match[1])
    }
  }
  return [...found]
}

function dirOf(path: string): string {
  const slash = path.lastIndexOf("/")
  return slash === -1 ? "" : path.slice(0, slash)
}

/**
 * Chooses which code files to fetch bodies for.
 *
 * Sampling is round-robin across directories rather than by size or by order,
 * so the imports we measure reflect the whole repository instead of whichever
 * folder happens to sort first. Non-test files come before test files, because
 * a test's imports say little about how the product code is wired.
 */
export function chooseSample(entries: TreeEntry[], limit = CAPS.importSample): string[] {
  const eligible = entries.filter(
    (e) => isCodeFile(e.path) && e.bytes > 0 && e.bytes <= CAPS.perFileBytes
  )
  if (eligible.length <= limit) return eligible.map((e) => e.path)

  const byDir = new Map<string, string[]>()
  for (const entry of [...eligible].sort((a, b) => {
    const test = Number(isTestFile(a.path)) - Number(isTestFile(b.path))
    return test !== 0 ? test : a.path.localeCompare(b.path)
  })) {
    const dir = dirOf(entry.path)
    const bucket = byDir.get(dir)
    if (bucket) bucket.push(entry.path)
    else byDir.set(dir, [entry.path])
  }

  const buckets = [...byDir.values()]
  const chosen: string[] = []
  for (let round = 0; chosen.length < limit; round++) {
    let placed = false
    for (const bucket of buckets) {
      const path = bucket[round]
      if (path === undefined) continue
      chosen.push(path)
      placed = true
      if (chosen.length === limit) break
    }
    if (!placed) break
  }
  return chosen
}

/**
 * Config and doc files worth fetching.
 *
 * Only ROOT files and the two known directories qualify. Every detector reads
 * config by exact root path, so a nested match is dead weight: vercel/next.js
 * has 868 package.json files, and matching them by basename filled the entire
 * budget with files nothing reads while the root README never got fetched.
 */
export function chooseConfigFiles(entries: TreeEntry[]): string[] {
  const usable = entries.filter((e) => e.bytes > 0 && e.bytes <= CAPS.perFileBytes)
  const root = usable.filter((e) => !e.path.includes("/") && isKeptFile(e.path))
  const nested = usable.filter(
    (e) => e.path.startsWith(".github/workflows/") || e.path.startsWith(".devcontainer/")
  )
  return [...root, ...nested].map((e) => e.path).slice(0, CAPS.configFiles)
}

export function collect(
  entries: TreeEntry[],
  texts: Map<string, string>,
  sampled: Set<string>,
  truncated: RawFacts["truncated"] = null
): RawFacts {
  const paths = entries.map((e) => e.path)
  const keptText = new Map<string, string>()
  const codeFiles: CodeFileFacts[] = []

  for (const entry of entries) {
    const text = texts.get(entry.path)
    if (text !== undefined && isKeptFile(entry.path)) keptText.set(entry.path, text)

    if (isCodeFile(entry.path)) {
      codeFiles.push({
        path: entry.path,
        bytes: entry.bytes,
        imports: sampled.has(entry.path) ? extractImports(text ?? "") : null,
      })
    }
  }

  const sampledCount = codeFiles.filter((f) => f.imports !== null).length

  return {
    paths,
    codeFiles,
    keptText,
    sample: sampledCount === 0 ? null : { sampled: sampledCount, total: codeFiles.length },
    truncated,
  }
}
