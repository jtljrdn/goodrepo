import { expect, test } from "bun:test"
import { readTar } from "./tar"

const BLOCK = 512
const enc = new TextEncoder()

function header(name: string, size: number, type: string, prefix = ""): Uint8Array {
  const h = new Uint8Array(BLOCK)
  h.set(enc.encode(name), 0)
  h.set(enc.encode(size.toString(8).padStart(11, "0") + "\0"), 124)
  h.set(enc.encode(type), 156)
  h.set(enc.encode("ustar\0"), 257)
  h.set(enc.encode("00"), 263)
  h.set(enc.encode(prefix), 345)
  h.fill(32, 148, 156)
  let sum = 0
  for (const b of h) sum += b
  h.set(enc.encode(sum.toString(8).padStart(6, "0") + "\0 "), 148)
  return h
}

function entry(name: string, body: string, type = "0", prefix = ""): Uint8Array[] {
  const bytes = enc.encode(body)
  const padded = Math.ceil(bytes.length / BLOCK) * BLOCK
  const data = new Uint8Array(padded)
  data.set(bytes)
  return [header(name, bytes.length, type, prefix), data]
}

function tarOf(...parts: Uint8Array[][]): Uint8Array {
  const blocks = [...parts.flat(), new Uint8Array(BLOCK), new Uint8Array(BLOCK)]
  const total = blocks.reduce((n, b) => n + b.length, 0)
  const out = new Uint8Array(total)
  let off = 0
  for (const b of blocks) { out.set(b, off); off += b.length }
  return out
}

async function* chunked(data: Uint8Array, size: number) {
  for (let i = 0; i < data.length; i += size) yield data.subarray(i, i + size)
}

async function collect(data: Uint8Array, want: (p: string, s: number) => boolean, chunk = 7) {
  const out = []
  for await (const e of readTar(chunked(data, chunk), want)) out.push(e)
  return out
}

test("reads regular files and their bodies", async () => {
  const tar = tarOf(entry("a.txt", "hello"), entry("b.txt", "world"))
  const got = await collect(tar, () => true)
  expect(got.map((e) => e.path)).toEqual(["a.txt", "b.txt"])
  expect(new TextDecoder().decode(got[0]!.body!)).toBe("hello")
  expect(got[1]!.size).toBe(5)
})

test("joins the ustar prefix field for long paths", async () => {
  const tar = tarOf(entry("page.tsx", "x", "0", "repo/apps/web/app/dashboard"))
  const got = await collect(tar, () => true)
  expect(got[0]!.path).toBe("repo/apps/web/app/dashboard/page.tsx")
})

test("skips directories and symlinks, surfaces the pax global header", async () => {
  const tar = tarOf(
    entry("pax_global_header", "52 comment=abc123\n", "g"),
    entry("dir/", "", "5"),
    entry("link", "", "2"),
    entry("real.ts", "code")
  )
  const got = await collect(tar, () => true)
  expect(got.map((e) => e.kind)).toEqual(["paxGlobal", "file"])
  expect(new TextDecoder().decode(got[0]!.body!)).toContain("comment=abc123")
  expect(got[1]!.path).toBe("real.ts")
})

test("skipped bodies come back null but the stream stays aligned", async () => {
  const tar = tarOf(entry("skip.bin", "x".repeat(1200)), entry("keep.ts", "kept"))
  const got = await collect(tar, (p) => p === "keep.ts")
  expect(got[0]!.body).toBeNull()
  expect(got[0]!.size).toBe(1200)
  expect(new TextDecoder().decode(got[1]!.body!)).toBe("kept")
})

test("survives arbitrary chunk boundaries", async () => {
  const tar = tarOf(entry("a.ts", "a".repeat(1000)), entry("b.ts", "b"))
  for (const chunk of [1, 3, 512, 513, 100_000]) {
    const got = await collect(tar, () => true, chunk)
    expect(got.map((e) => e.path), `chunk ${chunk}`).toEqual(["a.ts", "b.ts"])
  }
})

test("stops at the end-of-archive marker", async () => {
  const tar = tarOf(entry("a.ts", "a"))
  const got = await collect(tar, () => true)
  expect(got).toHaveLength(1)
})
