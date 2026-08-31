export const EXAMPLES = [
  { slug: "vercel/next.js", sha: "d434afa837b995d2db6f101e3b705461a250c655" },
  { slug: "shadcn-ui/ui", sha: "63c1308d112b6b1205d86244a156cca1abef5087" },
  {
    slug: "drizzle-team/drizzle-orm",
    sha: "b7862528fd8fc39bc2653a6c18dad7c1f4e68d10",
  },
  { slug: "honojs/hono", sha: "e2740d5a1bd0b4254e517e3af8b60789284bc7bd" },
  { slug: "jtljrdn/goodrepo", sha: "main" },
] as const

const BY_SLUG = new Map(EXAMPLES.map((e) => [e.slug.toLowerCase(), e.sha]))

export function pinnedSha(owner: string, repo: string): string | null {
  return BY_SLUG.get(`${owner}/${repo}`.toLowerCase()) ?? null
}
