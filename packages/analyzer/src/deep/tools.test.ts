import { expect, test } from "bun:test"
import type { Checkout } from "../sandbox"
import { CAPS } from "../thresholds"
import { checkoutTools, isSafePath, toPrefix } from "./tools"

test("isSafePath rejects anything outside the checkout", () => {
  for (const path of ["/etc/passwd", "../secrets", "a/../../b", "~/.ssh/id_rsa", ""]) {
    expect(isSafePath(path)).toBe(false)
  }
})

test("isSafePath accepts ordinary repository paths", () => {
  for (const path of ["README.md", "src/index.ts", "apps/web/app/page.tsx", "a..b/c.ts"]) {
    expect(isSafePath(path)).toBe(true)
  }
})

function fakeCheckout(files: Record<string, string>, stdout = ""): Checkout {
  return {
    entries: Object.keys(files).map((path) => ({ path, bytes: files[path]!.length })),
    read: async (paths) => new Map(paths.flatMap((p) => (p in files ? [[p, files[p]!] as const] : []))),
    run: async () => ({ stdout, exitCode: stdout === "" ? 1 : 0 }),
  }
}

const files = {
  "README.md": "hello",
  "src/index.ts": "export const a = 1",
  "src/deep/tools.ts": "tools",
}

test("every way the model spells the repository root means the root", () => {
  // The literal two-character string `""` is what actually broke the audit: the model read
  // "empty string lists everything" and sent quote marks.
  for (const root of ["", '""', "''", ".", "./", "/", " . ", null, undefined]) {
    expect(toPrefix(root)).toBe("")
  }
})

test("toPrefix normalises a real directory to a trailing-slash prefix", () => {
  for (const dir of ["src", "src/", "/src", "./src", '"src"', "src//"]) {
    expect(toPrefix(dir)).toBe("src/")
  }
  expect(toPrefix("apps/web")).toBe("apps/web/")
})

test("list_files filters to a directory prefix", async () => {
  const tools = checkoutTools(fakeCheckout(files))
  const all = await tools.list_files.execute!({ directory: null }, {} as never)
  const src = await tools.list_files.execute!({ directory: "src" }, {} as never)
  expect(all).toMatchObject({ count: 3 })
  expect(src).toMatchObject({ count: 2, paths: ["src/index.ts", "src/deep/tools.ts"] })
})

test("list_files treats a trailing slash the same as none", async () => {
  const tools = checkoutTools(fakeCheckout(files))
  expect(await tools.list_files.execute!({ directory: "src/" }, {} as never)).toMatchObject({ count: 2 })
})

test("list_files returns the whole repository for a quoted empty string", async () => {
  const tools = checkoutTools(fakeCheckout(files))
  expect(await tools.list_files.execute!({ directory: '""' }, {} as never)).toMatchObject({ count: 3 })
})

test("read_file refuses an unsafe path before touching the checkout", async () => {
  const tools = checkoutTools(fakeCheckout(files))
  expect(await tools.read_file.execute!({ path: "../../etc/passwd" }, {} as never)).toMatchObject({
    error: expect.stringContaining("inside the repository"),
  })
})

test("read_file reports a missing file rather than returning nothing", async () => {
  const tools = checkoutTools(fakeCheckout(files))
  expect(await tools.read_file.execute!({ path: "AGENTS.md" }, {} as never)).toMatchObject({
    error: expect.stringContaining("AGENTS.md"),
  })
})

test("read_file truncates a file past the cap", async () => {
  const long = "x".repeat(CAPS.deepReadBytes + 500)
  const tools = checkoutTools(fakeCheckout({ "big.md": long }))
  const result = await tools.read_file.execute!({ path: "big.md" }, {} as never)
  expect(result).toMatchObject({ path: "big.md" })
  expect((result as { text: string }).text).toContain("[truncated at")
})

test("search treats git grep's empty-result exit code as no matches", async () => {
  const tools = checkoutTools(fakeCheckout(files))
  expect(await tools.search.execute!({ pattern: "nothing" }, {} as never)).toMatchObject({
    matches: [],
    truncated: false,
  })
})

test("search caps how many matches come back", async () => {
  const stdout = Array.from({ length: CAPS.deepGrepMatches + 10 }, (_, i) => `f.ts:${i}:hit`).join("\n")
  const tools = checkoutTools(fakeCheckout(files, stdout))
  const result = await tools.search.execute!({ pattern: "hit" }, {} as never)
  expect(result).toMatchObject({ truncated: true })
  expect((result as { matches: string[] }).matches).toHaveLength(CAPS.deepGrepMatches)
})
