import { expect, test } from "bun:test"
import { collect, extractImports } from "./collect"
import type { FileEntry } from "./types"

async function* feed(entries: FileEntry[]) {
  for (const entry of entries) yield entry
}

const file = (path: string, text: string | null = ""): FileEntry => ({
  path,
  size: text?.length ?? 0,
  text,
})

test("extracts every import form", () => {
  const source = `
    import React from "react"
    import { z } from 'zod'
    import type { Foo } from "./foo"
    export { bar } from "../bar"
    const db = require("drizzle-orm")
    const lazy = await import("./lazy")
  `
  expect(extractImports(source).sort()).toEqual(
    ["../bar", "./foo", "./lazy", "drizzle-orm", "react", "zod"].sort()
  )
})

test("ignores import-like text inside comments and strings", () => {
  const source = `// import Fake from "fake"\nconst s = 'import x from "also-fake"'\nimport real from "real"`
  expect(extractImports(source)).toEqual(["real"])
})

test("records every path but only measures code files", async () => {
  const facts = await collect(
    feed([
      file("package.json", '{"name":"x"}'),
      file("src/a.ts", "import { z } from 'zod'\nconst a = 1\n"),
      file("public/logo.png", null),
      file("README.md", "# Title"),
    ])
  )
  expect(facts.paths).toHaveLength(4)
  expect(facts.codeFiles.map((f) => f.path)).toEqual(["src/a.ts"])
  expect(facts.codeFiles[0]!.lines).toBe(2)
  expect(facts.codeFiles[0]!.imports).toEqual(["zod"])
})

test("keeps the text of config and doc files only", async () => {
  const facts = await collect(
    feed([file("package.json", '{"a":1}'), file("README.md", "# Hi"), file("src/a.ts", "const a = 1")])
  )
  expect(facts.keptText.get("package.json")).toBe('{"a":1}')
  expect(facts.keptText.get("README.md")).toBe("# Hi")
  expect(facts.keptText.has("src/a.ts")).toBe(false)
})

test("counts a file with no trailing newline as one line", async () => {
  const facts = await collect(feed([file("src/a.ts", "const a = 1")]))
  expect(facts.codeFiles[0]!.lines).toBe(1)
})

test("an unread code file still counts as a path but has no facts", async () => {
  const facts = await collect(feed([file("src/huge.ts", null)]))
  expect(facts.paths).toEqual(["src/huge.ts"])
  expect(facts.codeFiles).toHaveLength(0)
})
