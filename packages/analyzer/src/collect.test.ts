import { expect, test } from "bun:test"
import {
  chooseConfigFiles,
  chooseSample,
  collect,
  extractImports,
  withinBudget,
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

test("syntax extraction distinguishes literals, comments and template expressions", () => {
  expect(extractImports(`const s = " import x from 'fake'";`)).toEqual([])
  expect(
    extractImports(`const s = "/*"; import x from "real"; const t = "*/";`)
  ).toEqual(["real"])
  expect(extractImports('const s = `hello ${import("./real")}`')).toEqual([
    "./real",
  ])
  const result = collect(
    [entry("app/page.tsx")],
    new Map([
      [
        "app/page.tsx",
        `'use client'; // process.env.FAKE\nconst s = 'process.env.FAKE';`,
      ],
    ]),
    new Set(["app/page.tsx"])
  )
  expect(result.codeFiles[0]?.readsEnv).toBe(false)
  expect(result.codeFiles[0]?.client).toBe(true)
})

test("missing text is never counted as sampled", () => {
  expect(
    collect([entry("src/a.ts")], new Map(), new Set(["src/a.ts"])).sample
  ).toBeNull()
})

test("sampling is stable and reaches beyond alphabetical directory prefixes", () => {
  const entries = Array.from({ length: 250 }, (_, i) =>
    entry(`src/d${String(i).padStart(3, "0")}/a.ts`)
  )
  const chosen = chooseSample(entries)
  expect(chosen).toEqual(chooseSample([...entries].reverse()))
  expect(chosen.some((path) => path.startsWith("src/d24"))).toBe(true)
})

test("sampling gives a small workspace representation beside a large one", () => {
  const entries = [
    ...Array.from({ length: 250 }, (_, i) => entry(`apps/big/src/d${i}/a.ts`)),
    entry("packages/small/src/a.ts"),
  ]
  expect(chooseSample(entries, 10, ["apps/big", "packages/small"])).toContain(
    "packages/small/src/a.ts"
  )
})

test("configuration discovery follows declared workspaces, including pnpm exclusions", () => {
  const entries = [
    "package.json",
    "pnpm-workspace.yaml",
    "modules/a/package.json",
    "modules/a/AGENTS.md",
    "modules/a/tsconfig.json",
    "modules/a/vitest.config.ts",
    "modules/excluded/package.json",
    "examples/demo/package.json",
  ].map((path) => entry(path))
  const chosen = chooseConfigFiles(
    entries,
    new Map([
      [
        "pnpm-workspace.yaml",
        "packages:\n  - modules/*\n  - '!modules/excluded'\n",
      ],
    ])
  )
  expect(chosen).toContain("modules/a/package.json")
  expect(chosen).toContain("modules/a/AGENTS.md")
  expect(chosen).not.toContain("modules/excluded/package.json")
  expect(chosen).not.toContain("examples/demo/package.json")
})

test("the byte budget deduplicates requests and still fits later small files", () => {
  const entries = [
    entry("package.json", 4),
    entry("huge.ts", 20),
    entry("small.ts", 2),
  ]
  expect(
    withinBudget(
      entries,
      ["package.json", "package.json", "huge.ts", "small.ts"],
      6
    )
  ).toEqual(["package.json", "small.ts"])
})
