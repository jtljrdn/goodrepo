import { isStepCount, NoOutputGeneratedError, Output, ToolLoopAgent } from "ai"
import { z } from "zod"
import type { Checkout } from "../sandbox"
import { CAPS } from "../thresholds"
import { checkoutTools, type ToolCall } from "./tools"
import { verifyFindings, type RejectedFinding } from "./verify"

const MODEL = process.env.GOODREPO_MODEL ?? "anthropic/claude-sonnet-5"

function instructions(maxSteps: number): string {
  return [
    "You audit whether a repository's documentation tells the truth about the repository.",
    "",
    "An AI coding agent reads these documents and then acts on them. Documentation that is",
    "merely thin is not your concern, because a static scan already measures presence and",
    "length. Report contradictions, and instructions an agent would predictably get wrong by",
    "following them.",
    "",
    "How to work:",
    "  1. List the repository's files so you know what is actually there.",
    "  2. Read the documentation. README, AGENTS.md, CLAUDE.md, CONTRIBUTING.",
    "  3. Work through the claims. Go document by document and take every concrete claim in",
    "     turn: a named script, read package.json; a named directory, list it; a named file,",
    "     read it; a stated count or rule, check it holds. Finding one problem is not a reason",
    "     to stop looking at the rest of the document.",
    "  4. Report every claim your own reads contradicted.",
    "",
    "You have tools. Use them. Never assert anything about a file you have not read, and never",
    "rely on your own memory of what a package or framework contains.",
    "",
    `You have ${maxSteps} tool calls. That is enough to cover the documentation properly, so`,
    "use what you need rather than finishing early. A short audit that found one problem and",
    "left four unchecked claims behind has failed, even though everything it reported was right.",
    "",
    "Your tools are taken away for the last few calls so that you always finish. Do not save the",
    "write-up for the end; be ready to report what you have from any point onward.",
    "",
    "Read economically so the budget goes further: everything you read stays in front of you for",
    "the rest of the audit, and long files come back truncated. Prefer a search over reading a",
    "whole file when you only need to confirm one line. Spend what you save on covering more",
    "claims, not on finishing sooner.",
    "",
    "What you cannot see: this is a shallow clone with nothing installed. There is no",
    "node_modules, no build output, no generated file. A claim about an installed dependency's",
    "contents is not checkable here, so skip it rather than guessing.",
    "",
    "Report every contradiction your reads turned up. Do not decide whether it will survive",
    "checking; that is done for you afterwards, in code. Your job is to find them and show",
    "your work.",
    "",
    "For each one give the document it appears in, the exact quote, and the repository path you",
    "checked that settles it. That path is usually a different file: the docs name a script, so",
    "cite package.json; the docs name a folder, so cite the folder you listed. When the problem",
    "is visible in the document itself, such as a command that could not run as written, cite",
    "that same document. If nothing in this checkout settles the claim, say so with null rather",
    "than leaving the finding out.",
    "",
    "Once your own reads have shown that a claim is wrong, report it, however small it looks.",
    "Missing a real contradiction is exactly as much a failure as inventing one. Before you",
    "finish, look back over the documents and ask which concrete claims you never checked, and",
    "check them. Report nothing only when you went through the documentation and it genuinely",
    "matched the repository.",
  ].join("\n")
}

const Finding = z.object({
  severity: z
    .enum(["high", "medium", "low"])
    .describe("How badly an agent following this claim would go wrong"),
  title: z.string().describe("One line under 80 characters naming the problem"),
  path: z
    .string()
    .describe(
      "The documentation file the claim appears in, repository-relative"
    ),
  quote: z
    .string()
    .describe(
      "The exact text of the claim, copied verbatim from that file so it can be located again"
    ),
  checkedPath: z
    .string()
    .nullable()
    .describe(
      "The repository path you checked that settles the claim: the file you read, the directory you listed, or the document itself when the problem is visible in it. Null if nothing in the repository settles it."
    ),
  evidence: z
    .string()
    .describe(
      "What you read that contradicts the quote, naming the file or listing you checked"
    ),
  fix: z.string().describe("One concrete action a maintainer can take"),
})

const schema = z.object({
  findings: z.array(Finding).max(CAPS.deepMaxFindings),
})

export type DeepFinding = z.infer<typeof Finding>

/**
 * Running out of tool calls used to lose the whole run: the agent explored into the cap and
 * returned nothing at all. Past this point its tools are taken away, so the only thing left
 * to do is write up what it already found.
 */
export function shouldLand(
  stepNumber: number,
  maxSteps: number,
  landing: number
): boolean {
  return stepNumber >= maxSteps - landing
}

export type DeepReview =
  | {
      ok: true
      findings: DeepFinding[]
      dropped: RejectedFinding[]
      steps: number
    }
  | { ok: false; reason: string }

export async function deepReview(
  checkout: Checkout,
  repo: { owner: string; repo: string },
  onToolCall: (call: ToolCall) => void = () => {}
): Promise<DeepReview> {
  const agent = new ToolLoopAgent({
    model: MODEL,
    // The instructions and the tool definitions are identical on every step, so caching
    // them keeps the stable head of the prefix off the per-step bill.
    instructions: {
      role: "system",
      content: instructions(CAPS.deepMaxSteps),
      providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
    },
    tools: checkoutTools(checkout, onToolCall),
    stopWhen: isStepCount(CAPS.deepMaxSteps),
    prepareStep: ({ stepNumber }) =>
      shouldLand(stepNumber, CAPS.deepMaxSteps, CAPS.deepLandingSteps)
        ? { activeTools: [] }
        : {},
    // Anthropic needs explicit cache_control markers. The Gateway places them for us:
    // one on the last message so each request extends the previous one's cache, and one
    // further back so a request whose tail changed still reads a stable prefix.
    providerOptions: { gateway: { caching: "auto" } },
    output: Output.object({ schema }),
  })

  try {
    const result = await agent.generate({
      prompt: `Audit the documentation of ${repo.owner}/${repo.repo}.`,
    })
    const { kept, dropped } = await verifyFindings(
      result.output.findings,
      checkout
    )
    return { ok: true, findings: kept, dropped, steps: result.steps.length }
  } catch (error) {
    if (NoOutputGeneratedError.isInstance(error)) {
      return {
        ok: false,
        reason: `The review used all ${CAPS.deepMaxSteps} of its tool calls without reaching a conclusion.`,
      }
    }
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "Deep review failed.",
    }
  }
}
