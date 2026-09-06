import { CAPS } from "../thresholds"
import { afterAll, afterEach, expect, spyOn, test } from "bun:test"
import {
  classifyRepo,
  fetchBlobs,
  fetchBlobsRest,
  fetchRepoMeta,
  fetchTree,
  ScanFetchError,
} from "./github"
import type { TreeEntry } from "../types"

const tree = (...paths: string[]): TreeEntry[] =>
  paths.map((path) => ({ path, bytes: 10 }))

test("accepts a repository with package.json at the root", () => {
  expect(classifyRepo(tree("package.json", "README.md", "src/a.ts"))).toBeNull()
})

test("a nested package.json alone is not enough", () => {
  expect(classifyRepo(tree("apps/web/package.json", "README.md"))?.kind).toBe(
    "not-js"
  )
})

test("refuses a repository with no root package.json", () => {
  const result = classifyRepo(
    tree("pyproject.toml", "README.md", "src/main.py")
  )
  expect(result?.kind).toBe("not-js")
  expect(result?.message).toContain("JavaScript")
})

test("refuses an empty repository", () => {
  expect(classifyRepo([])?.kind).toBe("empty")
})

const fetchMock = spyOn(globalThis, "fetch")
afterEach(() => fetchMock.mockReset())
afterAll(() => fetchMock.mockRestore())

test("transport failures abort blob scans instead of returning missing files", async () => {
  fetchMock.mockImplementation(
    async () => new Response("Unavailable", { status: 503 })
  )
  await expect(
    fetchBlobs("o", "r", "sha", ["package.json"], "token")
  ).rejects.toBeInstanceOf(ScanFetchError)
  await expect(
    fetchBlobsRest("o", "r", "sha", ["package.json"])
  ).rejects.toBeInstanceOf(ScanFetchError)
  await expect(fetchRepoMeta("o", "r")).rejects.toBeInstanceOf(ScanFetchError)
  await expect(fetchTree("o", "r", "sha")).rejects.toBeInstanceOf(
    ScanFetchError
  )
})

test("secondary rate limits need no remaining-quota header", async () => {
  fetchMock.mockImplementation(
    async () => new Response("Slow down", { status: 429 })
  )
  await expect(
    fetchBlobsRest("o", "r", "sha", ["package.json"])
  ).rejects.toMatchObject({ kind: "rate-limited" })
})

test("GraphQL partial errors, missing blobs and malformed JSON abort", async () => {
  for (const body of [
    JSON.stringify({
      data: { repository: { f0: { text: "{}", isBinary: false } } },
      errors: [{ message: "timeout" }],
    }),
    JSON.stringify({ data: { repository: { f0: null } } }),
    "{",
  ]) {
    fetchMock.mockImplementation(async () => new Response(body))
    await expect(
      fetchBlobs("o", "r", "sha", ["package.json"], "token")
    ).rejects.toBeInstanceOf(ScanFetchError)
  }
})

test("both transports deduplicate paths and REST encodes reserved characters", async () => {
  fetchMock.mockImplementation(async () =>
    Response.json({
      data: { repository: { f0: { text: "{}", isBinary: false } } },
    })
  )
  expect(
    (
      await fetchBlobs(
        "o",
        "r",
        "sha",
        ["package.json", "package.json"],
        "token"
      )
    ).size
  ).toBe(1)
  const query = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)).query
  expect(query).not.toContain("f1:")
  fetchMock.mockReset()
  fetchMock.mockImplementation(async () => new Response("{}"))
  const path = "src/a#b?.ts"
  await fetchBlobsRest("o", "r", "sha", [path, path])
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
    "src/a%23b%3F.ts?ref=sha"
  )
})

test("REST reads have bounded concurrency", async () => {
  let active = 0
  let peak = 0
  fetchMock.mockImplementation(async () => {
    peak = Math.max(peak, ++active)
    await new Promise((resolve) => setTimeout(resolve, 1))
    active--
    return new Response("ok")
  })
  const paths = Array.from({ length: 20 }, (_, i) => `${i}.ts`)
  expect((await fetchBlobsRest("o", "r", "sha", paths)).size).toBe(20)
  expect(peak).toBeLessThanOrEqual(CAPS.fetchConcurrency)
})
