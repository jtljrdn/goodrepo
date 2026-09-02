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
    facts(["package.json", "bun.lock"], {
      "package.json": pkg({ packageManager: "bun@1.3.10" }),
    })
  )
  expect(result.has.lockfile).toBe(true)
  expect(result.packageManager).toBe("bun@1.3.10")
})

test("a lockfile with no pinned packageManager field still fails the signal", () => {
  const result = detectManifest(
    facts(["package.json", "yarn.lock"], { "package.json": pkg({}) })
  )
  expect(result.has.lockfile).toBe(false)
  expect(result.packageManager).toBe("yarn")
})

test("detects scripts", () => {
  const result = detectManifest(
    facts(["package.json", "tsconfig.json"], {
      "package.json": pkg({
        scripts: {
          build: "next build",
          lint: "eslint",
          format: "prettier --write .",
          typecheck: "tsc --noEmit",
        },
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
    facts(["package.json", "tsconfig.json"], {
      "package.json": pkg({ scripts: { types: "tsc --noEmit" } }),
    })
  )
  expect(result.has.typecheckScript).toBe(true)
})

test("detects a pinned runtime from any of the accepted sources", () => {
  expect(
    detectManifest(facts([".nvmrc"], { "package.json": pkg({}) })).has
      .nodePinned
  ).toBe(true)
  expect(
    detectManifest(
      facts(["package.json"], {
        "package.json": pkg({ engines: { node: ">=20" } }),
      })
    ).has.nodePinned
  ).toBe(true)
  expect(
    detectManifest(facts(["package.json"], { "package.json": pkg({}) })).has
      .nodePinned
  ).toBe(false)
})

test("survives malformed package.json without throwing", () => {
  const result = detectManifest(
    facts(["package.json"], { "package.json": "{ not json" })
  )
  expect(result.has.buildScript).toBe(false)
  expect(result.packageManager).toBeNull()
})

test("recognises scripts named with a prefix or separator", () => {
  const result = detectManifest(
    facts(["package.json", "tsconfig.json"], {
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
    facts(["package.json", "tsconfig.json"], {
      "package.json": pkg({ scripts: { "gen:types": "openapi-typescript" } }),
    })
  )
  expect(result.has.typecheckScript).toBe(false)
})

test("a typecheck script does not apply to a JavaScript repository", () => {
  const result = detectManifest(
    facts(["package.json"], { "package.json": pkg({ scripts: {} }) })
  )
  expect(result.language).toBe("JavaScript")
  expect(result.has.typecheckScript).toBeNull()
})

test("language comes from tsconfig, the typescript dependency, or the file mix", () => {
  expect(
    detectManifest(
      facts(["package.json", "tsconfig.json"], { "package.json": pkg({}) })
    ).language
  ).toBe("TypeScript")
  expect(
    detectManifest(
      facts(["package.json"], {
        "package.json": pkg({ devDependencies: { typescript: "5" } }),
      })
    ).language
  ).toBe("TypeScript")
  const mixed = facts(["package.json"], { "package.json": pkg({}) })
  mixed.codeFiles = [
    { path: "a.ts", bytes: 1, imports: null },
    { path: "b.js", bytes: 1, imports: null },
    { path: "c.ts", bytes: 1, imports: null },
  ]
  expect(detectManifest(mixed).language).toBe("TypeScript")
})

test("a public package with an entry point is a library, an app is not", () => {
  expect(
    detectManifest(
      facts(["package.json"], {
        "package.json": pkg({ name: "lib", main: "dist/index.js" }),
      })
    ).library
  ).toBe(true)
  expect(
    detectManifest(
      facts(["package.json"], {
        "package.json": pkg({ private: true, exports: "./index.js" }),
      })
    ).library
  ).toBe(false)
  expect(
    detectManifest(facts(["package.json"], { "package.json": pkg({}) })).library
  ).toBe(false)
})

test("workspace roots come from package.json globs or a pnpm workspace file", () => {
  expect(
    detectManifest(
      facts(["package.json"], {
        "package.json": pkg({ workspaces: ["apps/*", "packages/*", "tools"] }),
      })
    ).workspaceRoots
  ).toEqual(["apps", "packages", "tools"])
  expect(
    detectManifest(
      facts(["package.json", "pnpm-workspace.yaml", "packages/a/index.ts"], {
        "package.json": pkg({}),
      })
    ).workspaceRoots
  ).toEqual(["packages"])
  expect(
    detectManifest(facts(["package.json"], { "package.json": pkg({}) }))
      .workspaceRoots
  ).toEqual([])
})
