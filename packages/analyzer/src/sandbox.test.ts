import { expect, test } from "bun:test"
import { parseLsTree } from "./sandbox"

const sample = [
  "100644 blob a1b2c3d4e5f60718293a4b5c6d7e8f9012345678     1234\tREADME.md",
  "100644 blob b1b2c3d4e5f60718293a4b5c6d7e8f9012345678       42\tsrc/index.ts",
  "160000 commit c1b2c3d4e5f60718293a4b5c6d7e8f9012345678        -\tvendor/dep",
  "100755 blob d1b2c3d4e5f60718293a4b5c6d7e8f9012345678        0\tscripts/run.sh",
].join("\n")

test("parseLsTree reads paths and sizes", () => {
  expect(parseLsTree(sample)).toEqual([
    { path: "README.md", bytes: 1234 },
    { path: "src/index.ts", bytes: 42 },
    { path: "scripts/run.sh", bytes: 0 },
  ])
})

test("parseLsTree drops submodules", () => {
  expect(parseLsTree(sample).some((e) => e.path === "vendor/dep")).toBe(false)
})

test("parseLsTree keeps paths containing spaces", () => {
  const line = "100644 blob a1b2c3d4e5f60718293a4b5c6d7e8f9012345678      7\tdocs/get started.md"
  expect(parseLsTree(line)).toEqual([{ path: "docs/get started.md", bytes: 7 }])
})

test("parseLsTree ignores blank and malformed lines", () => {
  expect(parseLsTree("")).toEqual([])
  expect(parseLsTree("garbage without a tab")).toEqual([])
  expect(parseLsTree("100644 blob abc\tmissing-size.md")).toEqual([])
})
