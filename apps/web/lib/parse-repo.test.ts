import { expect, test } from "bun:test"
import { parseRepoInput } from "@/lib/parse-repo"

test("accepts the shapes people paste", () => {
  for (const input of [
    "https://github.com/vercel/next.js",
    "http://www.github.com/vercel/next.js/",
    "github.com/vercel/next.js.git",
    "  vercel/next.js  ",
  ]) {
    expect(parseRepoInput(input)).toEqual({ owner: "vercel", repo: "next.js" })
  }
})

test("rejects anything that is not owner/repo", () => {
  for (const input of [
    "",
    "vercel",
    "github.com/vercel",
    "a/b/c",
    "https://gitlab.com",
  ]) {
    expect(parseRepoInput(input)).toBeNull()
  }
})
