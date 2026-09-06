// Tokenize simple command chains without executing repository-controlled text.
export function commands(text: string): string[][] {
  const result: string[][] = []
  for (const line of text.split(/\r?\n/)) {
    const tokens =
      line.match(/"(?:\\.|[^"\\])*"|'[^']*'|&&|\|\||[;|]|[^\s;|]+/g) ?? []
    let current: string[] = []
    for (const token of tokens) {
      if (token.startsWith("#")) break
      if (["&&", "||", ";", "|"].includes(token)) {
        if (current.length) result.push(current)
        current = []
      } else current.push(token.replace(/^(['"])(.*)\1$/, "$2"))
    }
    if (current.length) result.push(current)
  }
  return result
}

export function scriptInvocation(tokens: string[]): string | null {
  const [bin, ...args] = tokens
  if (!bin || !["npm", "pnpm", "yarn", "bun"].includes(bin)) return null
  // Skip flags that select a workspace/directory before the command.
  let i = 0
  while (args[i]?.startsWith("-")) {
    if (
      ["--filter", "--workspace", "-w", "-C", "--dir", "--cwd"].includes(
        args[i]!
      )
    )
      i += 2
    else i++
  }
  if (args[i] === "run" || args[i] === "run-script") return args[i + 1] ?? null
  return args[i] ?? null
}

export function runsTests(
  text: string,
  scripts: Record<string, string>,
  seen = new Set<string>()
): boolean {
  return commands(text).some((tokens) => {
    const bin = tokens[0]
    if (!bin) return false
    if (["vitest", "jest", "mocha", "ava"].includes(bin)) return true
    if (
      (bin === "playwright" && tokens[1] === "test") ||
      (bin === "node" && tokens.includes("--test"))
    )
      return true
    if (["npx", "bunx"].includes(bin))
      return runsTests(tokens.slice(1).join(" "), scripts, seen)
    if (["turbo", "nx", "lerna", "moon"].includes(bin))
      return tokens.some((t) => /^test($|:)/.test(t))
    const name = scriptInvocation(tokens)
    if (!name) return false
    if (scripts[name] !== undefined) {
      if (seen.has(name)) return false
      return runsTests(scripts[name]!, scripts, new Set([...seen, name]))
    }
    return (
      (bin === "bun" && name === "test") ||
      (bin === "pnpm" && ["vitest", "jest"].includes(name))
    )
  })
}

export function usableScript(text: string): boolean {
  return commands(text).some(
    ([bin]) =>
      bin !== undefined &&
      !["echo", "printf", "exit", "true", "false", ":"].includes(bin)
  )
}
