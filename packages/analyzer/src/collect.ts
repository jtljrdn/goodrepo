import { isCodeFile, isKeptFile } from "./skip"
import type { CodeFileFacts, FileSource, RawFacts } from "./types"

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

function countLines(text: string): number {
  if (text.length === 0) return 0
  let lines = 1
  for (const char of text) if (char === "\n") lines += 1
  return text.endsWith("\n") ? lines - 1 : lines
}

export async function collect(source: FileSource): Promise<RawFacts> {
  const paths: string[] = []
  const codeFiles: CodeFileFacts[] = []
  const keptText = new Map<string, string>()
  let filesRead = 0

  for await (const entry of source) {
    paths.push(entry.path)
    if (entry.text === null) continue
    filesRead += 1

    if (isKeptFile(entry.path)) keptText.set(entry.path, entry.text)

    if (isCodeFile(entry.path)) {
      codeFiles.push({
        path: entry.path,
        lines: countLines(entry.text),
        imports: extractImports(entry.text),
      })
    }
  }

  return { paths, codeFiles, keptText, filesRead, truncated: null }
}
