import { tool } from "ai"
import { z } from "zod"
import type { Checkout } from "../sandbox"
import { CAPS } from "../thresholds"

// The agent picks these paths, so they are untrusted input. Everything must stay
// inside the checkout: no absolute paths, no traversal out of the working tree.
export function isSafePath(path: string): boolean {
  if (path.length === 0 || path.startsWith("/") || path.startsWith("~")) return false
  return !path.split("/").includes("..")
}

// The model reaches this with whatever it thinks "the root" looks like: an empty string, a
// literal pair of quote characters, ".", "./", or "/". They all mean the same thing, and
// getting it wrong returns an empty repository, which the model reads as "nothing to audit".
export function toPrefix(directory: string | null | undefined): string {
  const cleaned = (directory ?? "")
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/^\.+/, "")
    .replace(/^\/+|\/+$/g, "")
    .trim()
  return cleaned === "" ? "" : `${cleaned}/`
}

function truncate(text: string, limit = CAPS.deepReadBytes): string {
  if (text.length <= limit) return text
  return `${text.slice(0, limit)}\n\n[truncated at ${limit} characters]`
}

export type ToolCall = { tool: string; argument: string }

export function checkoutTools(
  checkout: Checkout,
  onCall: (call: ToolCall) => void = () => {}
) {
  return {
    list_files: tool({
      description:
        "List the repository's tracked files. Optionally filter to a directory prefix. " +
        "Installed dependencies and build output are not in the checkout and never appear here.",
      inputSchema: z.object({
        directory: z
          .string()
          .nullable()
          .describe("Directory to list, such as 'src' or 'apps/web'. Null lists the whole repository."),
      }),
      execute: async ({ directory }) => {
        onCall({ tool: "list_files", argument: directory ?? "(root)" })
        const prefix = toPrefix(directory)
        const paths = checkout.entries
          .map((entry) => entry.path)
          .filter((path) => path.startsWith(prefix))
        return { count: paths.length, paths: paths.slice(0, 400) }
      },
    }),

    read_file: tool({
      description:
        "Read one tracked file from the repository. Use this before making any claim about a file's contents.",
      inputSchema: z.object({
        path: z.string().describe("Repository-relative path, such as 'README.md' or 'src/index.ts'."),
      }),
      execute: async ({ path }) => {
        onCall({ tool: "read_file", argument: path })
        if (!isSafePath(path)) return { error: "Path must be inside the repository." }
        const texts = await checkout.read([path])
        const text = texts.get(path)
        if (text === undefined) return { error: `No tracked file at ${path}.` }
        return { path, text: truncate(text) }
      },
    }),

    search: tool({
      description:
        "Search the tracked files for a pattern and return matching lines with their file and line number.",
      inputSchema: z.object({
        pattern: z.string().describe("A basic regular expression, passed to git grep."),
      }),
      execute: async ({ pattern }) => {
        onCall({ tool: "search", argument: pattern })
        const result = await checkout.run("git", [
          "grep",
          "-n",
          "-I",
          "--no-color",
          "-e",
          pattern,
        ])
        // git grep exits 1 when nothing matched, which is not an error here.
        if (result.exitCode > 1) return { error: `Could not search for ${pattern}.` }
        const lines = result.stdout.split("\n").filter(Boolean)
        return {
          matches: lines.slice(0, CAPS.deepGrepMatches),
          truncated: lines.length > CAPS.deepGrepMatches,
        }
      },
    }),
  }
}
