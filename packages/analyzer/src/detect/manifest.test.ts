import { expect, test } from "bun:test"
import { detectManifest } from "./manifest"
import type { RawFacts } from "../types"

function facts(paths: string[], kept: Record<string, string> = {}): RawFacts {
  return {
    paths,
    codeFiles: [],
    keptText: new Map(Object.entries(kept)),
    sample: null,
    truncated: null,
  }
}

const pkg = (body: object) => JSON.stringify(body)

test("detects the package manager from a lockfile plus the packageManager field", () => {
  const result = detectManifest(
    facts(["package.json", "bun.lock"], { "package.json": pkg({ packageManager: "bun@1.3.10" }) })
  )
  expect(result.has.lockfile).toBe(true)
  expect(result.packageManager).toBe("bun@1.3.10")
})

test("a lockfile with no pinned packageManager field still fails the signal", () => {
  const result = detectManifest(facts(["package.json", "yarn.lock"], { "package.json": pkg({}) }))
  expect(result.has.lockfile).toBe(false)
  expect(result.packageManager).toBe("yarn")
})

test("detects scripts", () => {
  const result = detectManifest(
    facts(["package.json"], {
      "package.json": pkg({
        scripts: { build: "next build", lint: "eslint", format: "prettier --write .", typecheck: "tsc --noEmit" },
      }),
    })
  )
  expect(result.has.buildScript).toBe(true)
  expect(result.has.lintScript).toBe(true)
  expect(result.has.formatScript).toBe(true)
  expect(result.has.typecheckScript).toBe(true)
})

test("recognises a typecheck script under another name", () => {
  const result = detectManifest(
    facts(["package.json"], { "package.json": pkg({ scripts: { types: "tsc --noEmit" } }) })
  )
  expect(result.has.typecheckScript).toBe(true)
})

test("detects a pinned runtime from any of the accepted sources", () => {
  expect(detectManifest(facts([".nvmrc"], { "package.json": pkg({}) })).has.nodePinned).toBe(true)
  expect(
    detectManifest(facts(["package.json"], { "package.json": pkg({ engines: { node: ">=20" } }) })).has.nodePinned
  ).toBe(true)
  expect(detectManifest(facts(["package.json"], { "package.json": pkg({}) })).has.nodePinned).toBe(false)
})

test("survives malformed package.json without throwing", () => {
  const result = detectManifest(facts(["package.json"], { "package.json": "{ not json" }))
  expect(result.has.buildScript).toBe(false)
  expect(result.packageManager).toBeNull()
})

test("recognises scripts named with a prefix or separator", () => {
  const result = detectManifest(
    facts(["package.json"], {
      "package.json": pkg({
        scripts: {
          build: "turbo run build",
          "lint:fix": "dprint fmt",
          "test:types": "turbo run test:types",
        },
      }),
    })
  )
  expect(result.has.buildScript).toBe(true)
  expect(result.has.lintScript).toBe(true)
  expect(result.has.formatScript).toBe(true)
  expect(result.has.typecheckScript).toBe(true)
})

test("a script that merely mentions types is not a typecheck script", () => {
  const result = detectManifest(
    facts(["package.json"], { "package.json": pkg({ scripts: { "gen:types": "openapi-typescript" } }) })
  )
  expect(result.has.typecheckScript).toBe(false)
})
