import { expect, test } from "bun:test"
import { detectImports } from "./imports"
import type { CodeFileFacts, RawFacts } from "../types"

function facts(files: [string, string[]][]): RawFacts {
  const codeFiles: CodeFileFacts[] = files.map(([path, imports]) => ({
    path,
    bytes: 100,
    imports,
  }))
  return {
    paths: files.map(([p]) => p),
    codeFiles,
    keptText: new Map(),
    sample: { sampled: files.length, total: files.length },
    truncated: null,
  }
}

function withDeps(files: [string, string[]][], deps: string[]): RawFacts {
  const base = facts(files)
  base.keptText.set(
    "package.json",
    JSON.stringify({
      dependencies: Object.fromEntries(deps.map((d) => [d, "1"])),
    })
  )
  return base
}

test("passes when exactly one validation library is declared", () => {
  const result = detectImports(withDeps([["a.ts", ["zod"]]], ["zod", "react"]))
  expect(result.has.singleValidationLib).toBe(true)
  expect(result.validationPatterns).toEqual(["zod"])
})

test("fails when two validation libraries are declared", () => {
  const result = detectImports(withDeps([["a.ts", ["zod"]]], ["zod", "yup"]))
  expect(result.has.singleValidationLib).toBe(false)
  expect(result.validationPatterns.sort()).toEqual(["yup", "zod"])
})

test("declared dependencies beat the sample, which can miss a rare import", () => {
  const result = detectImports(withDeps([["a.ts", ["react"]]], ["zod"]))
  expect(result.has.singleValidationLib).toBe(true)
})

test("no validation library at all is not applicable, not a failure", () => {
  expect(
    detectImports(withDeps([["a.ts", ["react"]]], ["react"])).has
      .singleValidationLib
  ).toBeNull()
})

test("fails singleDataLayer when UI files import the database directly", () => {
  const result = detectImports(
    withDeps(
      [
        ["src/components/a.tsx", ["drizzle-orm"]],
        ["src/components/b.tsx", ["drizzle-orm"]],
        ["src/components/c.tsx", ["react"]],
      ],
      ["drizzle-orm"]
    )
  )
  expect(result.has.singleDataLayer).toBe(false)
})

test("passes singleDataLayer when only the data layer touches the database", () => {
  const result = detectImports(
    withDeps(
      [
        ["src/db/client.ts", ["drizzle-orm"]],
        ["src/components/a.tsx", ["react"]],
        ["src/components/b.tsx", ["react"]],
      ],
      ["drizzle-orm"]
    )
  )
  expect(result.has.singleDataLayer).toBe(true)
})

test("singleDataLayer does not apply without a database library", () => {
  const result = detectImports(
    withDeps([["src/components/a.tsx", ["react"]]], ["react"])
  )
  expect(result.has.singleDataLayer).toBeNull()
  expect(result.usesDatabase).toBe(false)
})

test("a database is recognised from dependencies or from migration paths", () => {
  expect(detectImports(withDeps([["a.ts", []]], ["kysely"])).usesDatabase).toBe(
    true
  )
  expect(
    detectImports(facts([["supabase/migrations/001.ts", []]])).usesDatabase
  ).toBe(true)
  expect(
    detectImports(facts([["prisma/schema.prisma", []]])).usesDatabase
  ).toBe(true)
})

test("fan-out counts only imports that point back into the repository", () => {
  const result = detectImports(
    facts([
      [
        "src/a.ts",
        ["react", "next/link", "next/image", "zod", "./b", "@/lib/x"],
      ],
      ["src/c.ts", ["react", "lodash", "date-fns", "../d/e"]],
    ])
  )
  expect(result.measurements.lowFanout?.value).toBe(1.5)
  expect(result.has.lowFanout).toBe(true)
})

test("measures median fan-out across distinct directories", () => {
  const tight = detectImports(
    facts([
      ["src/a.ts", ["./b", "./c"]],
      ["src/d.ts", ["./e"]],
    ])
  )
  expect(tight.has.lowFanout).toBe(true)

  const wide = detectImports(
    facts([
      ["src/a.ts", ["../w/x", "../y/z", "../p/q", "../r/s", "../t/u"]],
      ["src/b.ts", ["../w/x", "../y/z", "../p/q", "../r/s"]],
    ])
  )
  expect(wide.has.lowFanout).toBe(false)
})

test("counts API route files across framework conventions", () => {
  const result = detectImports(
    facts([
      ["app/api/users/route.ts", []],
      ["app/api/posts/route.ts", []],
      ["app/page.tsx", []],
      ["src/routes/users.ts", []],
      ["src/users.controller.ts", []],
      ["src/routes/users.test.ts", []],
    ])
  )
  expect(result.apiRoutes).toBe(4)
})
