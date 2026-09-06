import { expect, test } from "bun:test"
import { analyze } from "./index"
import { chooseConfigFiles, chooseSample } from "./collect"
import { workspacePaths } from "./workspaces"
import type { RepoMeta } from "./types"

const meta: RepoMeta = {
  repositoryId: "1",
  owner: "test",
  repo: "repo",
  description: "",
  stars: 0,
  defaultBranch: "main",
  commitSha: "abc1234",
  commitMessage: "",
}
function scan(input: Record<string, string>, omit: string[] = []) {
  const entries = Object.entries(input).map(([path, text]) => ({
    path,
    bytes: Buffer.byteLength(text),
  }))
  const initial = new Map(
    Object.entries(input).filter(([path]) => !omit.includes(path))
  )
  const roots = workspacePaths(entries, initial)
  const sample = chooseSample(entries, 200, roots)
  const paths = new Set([...chooseConfigFiles(entries, initial), ...sample])
  const texts = new Map([...initial].filter(([path]) => paths.has(path)))
  return analyze(
    entries,
    texts,
    new Set(sample.filter((p) => texts.has(p))),
    meta
  )
}

test("workspace manifests, docs, frameworks and type-oriented structure are analyzed", () => {
  const result = scan({
    "package.json": JSON.stringify({ private: true, workspaces: ["apps/*"] }),
    "apps/web/package.json": JSON.stringify({
      dependencies: { next: "1", postgres: "1" },
      scripts: { test: "bun test" },
    }),
    "apps/web/AGENTS.md":
      "## Database\nRun the migrations before changing the schema.\n## Testing\n`bun test src/components/Button.test.tsx`",
    "apps/web/src/components/Button.tsx": "export const Button = () => null",
    "apps/web/src/components/Button.test.tsx": "import {test} from 'bun:test'",
    "apps/web/src/hooks/useData.ts": "export const useData = () => null",
    "apps/web/src/utils/helpers.ts": "export const helper = 1",
  })
  expect(result.framework).toBe("nextjs")
  expect(result.testFramework).toBe("bun")
  expect(result.has.testScript).toBe(true)
  expect(result.has.docDatabase).toBe(true)
  expect(result.has.singleTestDocumented).toBe(true)
  expect(result.has.featureFolders).toBe(false)
  expect(result.configCoverage?.read).toBe(result.configCoverage?.total)
})

test("independent packages may each use a different consistent validation library", () => {
  const result = scan({
    "package.json": JSON.stringify({ workspaces: ["packages/*"] }),
    "packages/a/package.json": JSON.stringify({ dependencies: { zod: "1" } }),
    "packages/a/src/index.ts": "import {z} from 'zod'",
    "packages/b/package.json": JSON.stringify({ dependencies: { yup: "1" } }),
    "packages/b/src/index.ts": "import * as yup from 'yup'",
  })
  expect(result.has.singleValidationLib).toBe(true)
  expect(result.measurements.singleValidationLib?.value).toBe(1)
})

test("an unread manifest or README is unknown, not a missing feature", () => {
  const result = scan(
    {
      "package.json": "{}",
      "README.md": "hello",
      "src/a.ts": "export const a = 1",
    },
    ["package.json", "README.md"]
  )
  expect(result.has.readme).toBeNull()
  expect(result.has.buildScript).toBeNull()
  expect(result.unmeasured?.readme).toBe("not-inspected")
  expect(result.configCoverage).toEqual({ read: 0, total: 2 })
})

test("a completely unsampled workspace cannot inherit another workspace's passing consistency", () => {
  const result = scan(
    {
      "package.json": JSON.stringify({ workspaces: ["packages/*"] }),
      "packages/a/package.json": "{}",
      "packages/a/src/index.ts": "import {z} from 'zod'",
      "packages/b/package.json": "{}",
      "packages/b/src/index.ts": "import * as yup from 'yup'",
    },
    ["packages/b/src/index.ts"]
  )
  expect(result.has.singleValidationLib).toBeNull()
  expect(result.unmeasured?.singleValidationLib).toBe("not-inspected")
})

test("oversized instructions stay visible in configuration coverage", () => {
  const result = scan({
    "package.json": "{}",
    "AGENTS.md": "a".repeat(2 * 1024 * 1024 + 1),
  })
  expect(result.has.agentsMd).toBeNull()
  expect(result.configCoverage).toEqual({ read: 1, total: 2 })
})

test("workspace caps are disclosed rather than silently ignoring packages", () => {
  const input: Record<string, string> = {
    "package.json": JSON.stringify({ workspaces: ["packages/*"] }),
  }
  for (let i = 0; i < 45; i++) {
    input[`packages/p${i}/package.json`] = "{}"
    input[`packages/p${i}/src/index.ts`] = "export const x = 1"
  }
  const result = scan(input)
  expect(result.has.featureFolders).toBeNull()
  expect(result.unmeasured?.featureFolders).toBe("not-inspected")
  expect(result.configCoverage!.read).toBeLessThan(result.configCoverage!.total)
})
