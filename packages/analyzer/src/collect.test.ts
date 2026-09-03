import { expect, test } from "bun:test"
import {
  chooseConfigFiles,
  chooseSample,
  collect,
  extractImports,
} from "./collect"
import type { TreeEntry } from "./types"

const entry = (path: string, bytes = 100): TreeEntry => ({ path, bytes })

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

test("records every path and sizes every code file from the tree", () => {
  const facts = collect(
    [
      entry("package.json", 12),
      entry("src/a.ts", 480),
      entry("public/logo.png", 900),
      entry("README.md", 7),
    ],
    new Map([["package.json", '{"name":"x"}']]),
    new Set()
  )
  expect(facts.paths).toHaveLength(4)
  expect(facts.codeFiles.map((f) => f.path)).toEqual(["src/a.ts"])
  expect(facts.codeFiles[0]!.bytes).toBe(480)
})

test("only sampled files carry imports; the rest are null", () => {
  const facts = collect(
    [entry("src/a.ts"), entry("src/b.ts")],
    new Map([
      ["src/a.ts", "import { z } from 'zod'"],
      ["src/b.ts", "import x from 'y'"],
    ]),
    new Set(["src/a.ts"])
  )
  expect(facts.codeFiles[0]!.imports).toEqual(["zod"])
  expect(facts.codeFiles[1]!.imports).toBeNull()
  expect(facts.sample).toEqual({ sampled: 1, total: 2 })
})

test("keeps the text of config and doc files only", () => {
  const facts = collect(
    [entry("package.json"), entry("README.md"), entry("src/a.ts")],
    new Map([
      ["package.json", '{"a":1}'],
      ["README.md", "# Hi"],
      ["src/a.ts", "const a = 1"],
    ]),
    new Set(["src/a.ts"])
  )
  expect(facts.keptText.get("package.json")).toBe('{"a":1}')
  expect(facts.keptText.get("README.md")).toBe("# Hi")
  expect(facts.keptText.has("src/a.ts")).toBe(false)
})

test("a repository with no sample reports no sample", () => {
  const facts = collect([entry("src/a.ts")], new Map(), new Set())
  expect(facts.sample).toBeNull()
})

test("chooseSample takes everything when the repository is small", () => {
  const entries = [entry("src/a.ts"), entry("src/b.ts"), entry("README.md")]
  expect(chooseSample(entries, 200).sort()).toEqual(["src/a.ts", "src/b.ts"])
})

test("chooseSample spreads across directories instead of taking one folder", () => {
  const entries = [
    ...Array.from({ length: 50 }, (_, i) => entry(`src/aaa/f${i}.ts`)),
    ...Array.from({ length: 50 }, (_, i) => entry(`src/zzz/f${i}.ts`)),
  ]
  const chosen = chooseSample(entries, 10)
  expect(chosen).toHaveLength(10)
  const fromAaa = chosen.filter((p) => p.startsWith("src/aaa/")).length
  const fromZzz = chosen.filter((p) => p.startsWith("src/zzz/")).length
  expect(fromAaa).toBe(5)
  expect(fromZzz).toBe(5)
})

test("chooseSample prefers source files over test files", () => {
  const entries = [
    ...Array.from({ length: 10 }, (_, i) => entry(`src/f${i}.test.ts`)),
    ...Array.from({ length: 10 }, (_, i) => entry(`src/f${i}.ts`)),
  ]
  const chosen = chooseSample(entries, 10)
  expect(chosen.every((p) => !p.includes(".test."))).toBe(true)
})

test("chooseSample skips files too large to fetch", () => {
  const entries = [
    entry("src/huge.ts", 5 * 1024 * 1024),
    entry("src/small.ts", 10),
  ]
  expect(chooseSample(entries, 200)).toEqual(["src/small.ts"])
})

test("chooseConfigFiles picks the known config and doc files", () => {
  const chosen = chooseConfigFiles([
    entry("package.json"),
    entry("README.md"),
    entry(".github/workflows/ci.yml"),
    entry("src/a.ts"),
    entry("public/logo.png"),
  ])
  expect(chosen.sort()).toEqual([
    ".github/workflows/ci.yml",
    "README.md",
    "package.json",
  ])
})

test("chooseConfigFiles ignores nested config files that no detector reads", () => {
  const entries = [
    ...Array.from({ length: 300 }, (_, i) =>
      entry(`packages/p${i}/package.json`)
    ),
    entry("README.md"),
    entry("package.json"),
  ]
  const chosen = chooseConfigFiles(entries)
  expect(chosen).toContain("README.md")
  expect(chosen).toContain("package.json")
  expect(chosen.some((p) => p.startsWith("packages/"))).toBe(false)
})
