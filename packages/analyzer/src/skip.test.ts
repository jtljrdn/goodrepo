import { expect, test } from "bun:test"
import { isCodeFile, isKeptFile, isTestFile, shouldReadContents } from "./skip"

test("reads ordinary source files", () => {
  expect(shouldReadContents("src/app/page.tsx", 4_000)).toBe(true)
  expect(shouldReadContents("lib/util.ts", 200)).toBe(true)
})

test("skips generated, vendored and binary paths", () => {
  for (const p of [
    "node_modules/react/index.js",
    "dist/bundle.js",
    ".next/server/app.js",
    "coverage/lcov-report/index.html",
    "public/logo.png",
    "assets/font.woff2",
    "src/vendor.min.js",
  ]) {
    expect(shouldReadContents(p, 100), p).toBe(false)
  }
})

test("skips files over the per-file cap but keeps small ones", () => {
  expect(shouldReadContents("src/big.ts", 3 * 1024 * 1024)).toBe(false)
  expect(shouldReadContents("src/big.ts", 1024)).toBe(true)
})

test("always reads the small fixed set of config and doc files", () => {
  for (const p of [
    "package.json",
    "tsconfig.json",
    "README.md",
    "AGENTS.md",
    "CLAUDE.md",
    ".env.example",
    "Dockerfile",
    ".github/workflows/ci.yml",
    ".nvmrc",
  ]) {
    expect(isKeptFile(p), p).toBe(true)
  }
  expect(isKeptFile("src/app/page.tsx")).toBe(false)
})

test("lockfiles are never read, only noted by name", () => {
  expect(shouldReadContents("bun.lock", 500_000)).toBe(false)
  expect(shouldReadContents("pnpm-lock.yaml", 500_000)).toBe(false)
})

test("classifies code and test files", () => {
  expect(isCodeFile("src/app/page.tsx")).toBe(true)
  expect(isCodeFile("README.md")).toBe(false)
  expect(isTestFile("src/lib/score.test.ts")).toBe(true)
  expect(isTestFile("src/__tests__/score.ts")).toBe(true)
  expect(isTestFile("src/lib/score.ts")).toBe(false)
})
