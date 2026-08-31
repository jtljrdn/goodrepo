import { expect, test } from "bun:test"
import { detectImports } from "./imports"
import type { CodeFileFacts, RawFacts } from "../types"

function facts(files: [string, string[]][]): RawFacts {
  const codeFiles: CodeFileFacts[] = files.map(([path, imports]) => ({ path, lines: 10, imports }))
  return { paths: files.map(([p]) => p), codeFiles, keptText: new Map(), filesRead: 0, truncated: null }
}

test("passes when one validation library dominates", () => {
  const result = detectImports(
    facts([["a.ts", ["zod"]], ["b.ts", ["zod"]], ["c.ts", ["zod"]], ["d.ts", ["zod"]], ["e.ts", ["zod"]],
           ["f.ts", ["zod"]], ["g.ts", ["zod"]], ["h.ts", ["zod"]], ["i.ts", ["zod"]], ["j.ts", ["yup"]]])
  )
  expect(result.has.singleValidationLib).toBe(true)
  expect(result.validationPatterns).toContain("zod")
})

test("fails when validation libraries are mixed", () => {
  const result = detectImports(facts([["a.ts", ["zod"]], ["b.ts", ["yup"]], ["c.ts", ["joi"]]]))
  expect(result.has.singleValidationLib).toBe(false)
  expect(result.validationPatterns.sort()).toEqual(["joi", "yup", "zod"])
})

test("no validation library at all is not applicable, not a failure", () => {
  expect(detectImports(facts([["a.ts", ["react"]]])).has.singleValidationLib).toBeNull()
})

test("a repository with no UI layer is not scored on singleDataLayer", () => {
  // honojs/hono has zero UI files, so the data-layer boundary does not apply.
  // It previously scored as a failure, costing real points for nothing.
  expect(detectImports(facts([["src/hono.ts", ["./compose"]]])).has.singleDataLayer).toBeNull()
})

test("fails singleDataLayer when UI files import the database directly", () => {
  const result = detectImports(
    facts([
      ["src/components/a.tsx", ["drizzle-orm"]],
      ["src/components/b.tsx", ["drizzle-orm"]],
      ["src/components/c.tsx", ["react"]],
    ])
  )
  expect(result.has.singleDataLayer).toBe(false)
})

test("passes singleDataLayer when only the data layer touches the database", () => {
  const result = detectImports(
    facts([
      ["src/db/client.ts", ["drizzle-orm"]],
      ["src/components/a.tsx", ["react"]],
      ["src/components/b.tsx", ["react"]],
    ])
  )
  expect(result.has.singleDataLayer).toBe(true)
})

test("measures median fan-out across distinct directories", () => {
  const tight = detectImports(facts([["src/a.ts", ["./b", "./c"]], ["src/d.ts", ["./e"]]]))
  expect(tight.has.lowFanout).toBe(true)

  const wide = detectImports(
    facts([["src/a.ts", ["../w/x", "../y/z", "../p/q", "../r/s", "../t/u"]], ["src/b.ts", ["../w/x", "../y/z", "../p/q", "../r/s"]]])
  )
  expect(wide.has.lowFanout).toBe(false)
})

test("counts API route files", () => {
  const result = detectImports(
    facts([["app/api/users/route.ts", []], ["app/api/posts/route.ts", []], ["app/page.tsx", []]])
  )
  expect(result.apiRoutes).toBe(2)
})
