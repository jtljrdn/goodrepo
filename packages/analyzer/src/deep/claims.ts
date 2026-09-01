import { generateText, NoObjectGeneratedError, Output } from "ai"
import { z } from "zod"
import type { Checkout } from "../sandbox"
import { isDocFile } from "../skip"
import { CAPS } from "../thresholds"

const MODEL = process.env.GOODREPO_MODEL ?? "anthropic/claude-sonnet-5"

const INSTRUCTIONS = [
  "You read a repository's documentation and list every concrete claim it makes about the",
  "repository, so that each one can be checked against the code afterwards.",
  "",
  "You are not judging anything. Do not decide whether a claim is true, and do not leave one",
  "out because you suspect it is fine. Something else checks them. Your only job is to make",
  "sure nothing checkable is missed.",
  "",
  "A concrete claim is one the repository itself could settle. Name a command to run, a file",
  "or folder that exists, a count, a rule about where code lives, a tool or version in use.",
  "Prose that cannot be settled by looking at the repository is not a claim: skip mission",
  "statements, opinions, and descriptions of what the product does for its users.",
  "",
  "Sort each claim by what would settle it:",
  "  script  - names a package.json script, or a command run through one",
  "  path    - names a file or directory that should exist",
  "  count   - states a number of things",
  "  content - anything else the repository settles, needing a file to be read and understood",
  "",
  "Quote the claim verbatim, exactly as written, so it can be found in the file again. Give",
  "the subject as the bare thing named: the script name, the path, the number, or the topic.",
].join("\n")

const Claim = z.object({
  path: z.string().describe("The documentation file the claim appears in, repository-relative"),
  quote: z.string().describe("The claim copied verbatim from that file, long enough to locate again"),
  kind: z.enum(["script", "path", "count", "content"]).describe("What would settle this claim"),
  subject: z
    .string()
    .describe("The bare thing named: a script name, a repository path, a number, or a short topic"),
  claim: z.string().describe("One plain sentence restating what the documentation asserts"),
})

const schema = z.object({ claims: z.array(Claim).max(CAPS.deepMaxClaims) })

export type Claim = z.infer<typeof Claim>

export type ClaimSet =
  | { ok: true; claims: Claim[] }
  | { ok: false; reason: string }

export function docPaths(checkout: Checkout): string[] {
  return checkout.entries
    .map((entry) => entry.path)
    .filter(isDocFile)
    .sort((a, b) => a.localeCompare(b))
}

export function buildDocPrompt(docs: [string, string][]): string {
  return docs
    .flatMap(([path, text]) => [`--- ${path} ---`, text.slice(0, CAPS.deepDocBytes), ""])
    .join("\n")
}

export async function extractClaims(checkout: Checkout): Promise<ClaimSet> {
  const paths = docPaths(checkout)
  if (paths.length === 0) return { ok: false, reason: "This repository has no documentation to check." }

  const texts = await checkout.read(paths)
  const docs = paths.flatMap((path): [string, string][] => {
    const text = texts.get(path)
    return text === undefined ? [] : [[path, text]]
  })
  if (docs.length === 0) return { ok: false, reason: "The documentation could not be read." }

  try {
    // No tools here on purpose. This is a bounded reading task over a few kilobytes of prose,
    // and giving it a repository to explore is what made coverage a matter of luck.
    const { output } = await generateText({
      model: MODEL,
      instructions: INSTRUCTIONS,
      prompt: buildDocPrompt(docs),
      output: Output.object({ schema }),
      providerOptions: { gateway: { caching: "auto" } },
    })
    return { ok: true, claims: output.claims }
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      return { ok: false, reason: "The model did not return a usable list of claims." }
    }
    return { ok: false, reason: error instanceof Error ? error.message : "Claim extraction failed." }
  }
}
