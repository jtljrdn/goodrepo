import { isStepCount, NoObjectGeneratedError, Output, ToolLoopAgent } from "ai"
import { z } from "zod"
import type { Checkout } from "../sandbox"
import { CAPS } from "../thresholds"
import type { RepoProfile, SignalId } from "../types"
import { checkoutTools, type ToolCall } from "./tools"

const MODEL = process.env.GOODREPO_MODEL ?? "anthropic/claude-sonnet-5"

/**
 * The static pass answers 34 to 37 of the 40 signals on a typical repository. These are the
 * ones it leaves open, and the only reason the model is here. Everything else is already known
 * by the time this runs, so nothing should be spent re-deriving it.
 */
export type AgentSignal = { question: string; lookFor: string }

/**
 * `singleValidationLib` is deliberately absent.
 *
 * It was measured three ways over nine runs of the same commit and never settled: roughly
 * three answers to one against, whichever way the question was worded, including an explicit
 * invitation to answer "undeterminable" on borderline repositories. It is worth 20 of the 100
 * points in its category, so a quarter of runs disagreeing moves the visible score, and a
 * score that will not reproduce is worse than a signal left unmeasured. It stays null and the
 * scorer excludes it. Restore it here if a question is found that a reader answers the same
 * way twice.
 */
export const AGENT_SIGNALS: Partial<Record<SignalId, AgentSignal>> = {
  consistentRouteShape: {
    question: "How are this repository's HTTP handlers written?",
    lookFor:
      "A handler here means an endpoint this repository serves: code a developer of this project wrote to answer one HTTP route. Three things are not handlers. A page or component that renders markup, however it is routed. A library's own request-handling machinery, so if this repository IS a web framework, router or server adapter, its adapters, middleware and dispatch code are its product, not its endpoints. And anything in examples, fixtures or tests. Applicable is false when nothing is left after those exclusions, which is the common case and a perfectly good answer. Where handlers do exist, compare them: two are the same pattern when an agent could copy one to write the other, meaning the same export style, argument handling and way of returning a response.",
  },
  consistentErrors: {
    question: "How does this repository construct and surface failures?",
    lookFor:
      "Compare how failures are represented across modules. Thrown Error subclasses, returned result objects, discriminated unions, bare strings and returned nulls are each a distinct pattern. Report the ones you actually find and how far each reaches.",
  },
  singleDataLayer: {
    question: "How does UI code get at data?",
    lookFor:
      "Look at components and pages. Direct database or ORM calls inside a component is one pattern; going through a shared module, server action or API route is another. Applicable is false if the repository has no UI.",
  },
}

const Observation = z.object({
  pattern: z.string().describe("Short name for this way of doing it, as you would say it to a colleague"),
  path: z.string().describe("One repository file that shows this pattern"),
  reach: z
    .enum(["most", "some", "few"])
    .describe(
      "How much of the relevant code follows this pattern. Use most for the one pattern that dominates, and use it for at most one pattern: if two patterns are each about as common as the other, neither dominates, so both are some."
    ),
})

const Verdict = z.object({
  applicable: z
    .boolean()
    .describe("False when the repository has nothing of this kind at all, such as no HTTP handlers"),
  patterns: z
    .array(Observation)
    .max(CAPS.deepMaxPatterns)
    .describe("Each distinct way you saw it done. One entry means the repository does it one way."),
  reason: z.string().describe("One or two sentences describing what you saw"),
})

type VerdictBody = z.infer<typeof Verdict>

export type SignalVerdict = VerdictBody & { signal: string }

/**
 * Turns what the agent saw into a pass or fail.
 *
 * The model reports the distinct patterns it found and how far each reaches; the cutoff is
 * applied here, in code. Asking the model "is this consistent?" made it draw the line, and it
 * drew it differently on different runs of the same commit. Two runs that see the same
 * patterns now reach the same verdict even when they would have judged differently.
 */
export function judgeConsistency(verdict: VerdictBody): boolean | null {
  if (!verdict.applicable || verdict.patterns.length === 0) return null
  if (verdict.patterns.length === 1) return true
  // Several ways of doing it is still consistent when one of them clearly dominates and the
  // rest are stragglers. Two competing mainstream patterns is not.
  return verdict.patterns.filter((p) => p.reach === "most").length === 1
}

/**
 * One required key per open signal, rather than a free array.
 *
 * With an array the model could return an empty one and the whole run produced nothing,
 * which is what happened on small repositories. A keyed object makes omitting an answer
 * structurally impossible: the schema itself will not validate without every signal present.
 */
function schemaFor(signals: SignalId[]): z.ZodType<Record<string, VerdictBody>> {
  const shape: Record<string, typeof Verdict> = {}
  for (const id of signals) shape[id] = Verdict
  return z.object(shape)
}

export type SignalResolution =
  | {
      ok: true
      verdicts: SignalVerdict[]
      unsupported: SignalVerdict[]
      unmatched: SignalVerdict[]
      steps: number
    }
  | { ok: false; reason: string }

/**
 * The signals the static pass left open.
 *
 * Deliberately not filtered by static counts. `apiRoutes` looked like a way to skip
 * `consistentRouteShape` on repositories with no routes, but honojs/hono reports zero routes
 * under that heuristic while being an HTTP framework whose handlers the agent judged
 * consistent, twice, unanimously. A detector finding nothing is not the same as there being
 * nothing, and only the agent can tell those apart here.
 */
export function unresolvedSignals(profile: RepoProfile): SignalId[] {
  return (Object.keys(AGENT_SIGNALS) as SignalId[]).filter((id) => profile.has[id] === null)
}

/**
 * What the static pass already knows, handed over so the agent does not spend tool calls
 * rediscovering the shape of the repository before it can start answering anything.
 */
export function repoBrief(profile: RepoProfile, checkout: Checkout): string {
  const dirs = new Map<string, number>()
  for (const entry of checkout.entries) {
    const slash = entry.path.indexOf("/")
    if (slash === -1) continue
    const top = entry.path.slice(0, slash)
    dirs.set(top, (dirs.get(top) ?? 0) + 1)
  }
  const layout = [...dirs]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([dir, n]) => `${dir}/ (${n})`)
    .join("  ")

  return [
    "Already known, do not spend calls confirming it:",
    `  ${profile.owner}/${profile.repo}, ${profile.framework}, ${profile.language}`,
    `  ${profile.files} files across ${profile.directories} directories`,
    `  ${profile.apiRoutes} route files, ${profile.testFiles} test files${profile.testFramework ? ` (${profile.testFramework})` : ""}`,
    `  top directories: ${layout}`,
  ].join("\n")
}

function instructions(signals: SignalId[], maxSteps: number): string {
  return [
    "You are finishing a repository scan that is already almost complete.",
    "",
    "A deterministic pass has already measured this repository and settled every question it",
    "could. You are here for the few it could not, because they need code to be read and",
    "judged rather than counted. Do not re-derive anything else, and do not report problems",
    "you notice along the way. Answer only what is asked.",
    "",
    "The open questions:",
    ...signals.flatMap((id) => {
      const spec = AGENT_SIGNALS[id]
      return spec === undefined ? [] : ["", `  ${id}`, `    ${spec.question}`, `    ${spec.lookFor}`]
    }),
    "",
    `You have ${maxSteps} tool calls for all of them together. The evidence overlaps, so a file`,
    "you read for one question often answers another. Read real code, not documentation: what",
    "the repository does is what counts here, not what it says about itself.",
    "",
    "Your tools are taken away for the last few calls so that you always finish, so be ready to",
    "answer from any point onward.",
    "",
    "For each question, report what you saw rather than a verdict. List each distinct way the",
    "repository does the thing, name it plainly, give one file that shows it, and say how far it",
    "reaches. One entry means the repository does it one way. Several entries mean several ways,",
    "which is a fine and useful thing to report.",
    "",
    "Reach has a rule. At most one pattern is `most`: the single one that dominates the relevant",
    "code. If two patterns are each about as common as the other then neither dominates, and",
    "both are `some`. Everything trailing behind them is `few`.",
    "",
    "Do not decide whether that counts as consistent. That line is drawn afterwards, in code,",
    "and drawing it yourself is the one thing this format exists to stop.",
    "",
    "Set applicable to false only when the repository has nothing of the kind at all, such as a",
    "library with no HTTP handlers. A repository that does the thing several different ways is",
    "still applicable: list the ways.",
    "",
    "Every file you name must be one you actually opened.",
  ].join("\n")
}

export type Partitioned = {
  verdicts: SignalVerdict[]
  unsupported: SignalVerdict[]
  unmatched: SignalVerdict[]
}

/**
 * Sorts the model's answers into the ones we can act on and the ones we cannot, without ever
 * discarding one silently. An answer is only actionable if it was asked for, has not already
 * been given, and rests on files that are actually in the checkout.
 */
export function partitionVerdicts(
  raw: SignalVerdict[],
  asked: SignalId[],
  files: Set<string>
): Partitioned {
  const wanted = new Set<string>(asked)
  const seen = new Set<string>()
  const out: Partitioned = { verdicts: [], unsupported: [], unmatched: [] }

  for (const original of raw) {
    const verdict = { ...original, signal: original.signal.trim() }
    if (!wanted.has(verdict.signal) || seen.has(verdict.signal)) {
      out.unmatched.push(verdict)
      continue
    }
    seen.add(verdict.signal)
    // A repository with nothing of the kind needs no files to prove it. Anything else has to
    // point at real ones: every pattern claimed must come with a file that exists here.
    const grounded = !verdict.applicable
      ? true
      : verdict.patterns.length > 0 && verdict.patterns.every((p) => files.has(p.path))
    ;(grounded ? out.verdicts : out.unsupported).push(verdict)
  }
  return out
}

export async function resolveSignals(
  checkout: Checkout,
  signals: SignalId[],
  profile: RepoProfile,
  onToolCall: (call: ToolCall) => void = () => {}
): Promise<SignalResolution> {
  if (signals.length === 0) return { ok: true, verdicts: [], unsupported: [], unmatched: [], steps: 0 }

  const budget = Math.min(CAPS.deepMaxSteps, signals.length * CAPS.deepStepsPerSignal)
  const agent = new ToolLoopAgent({
    model: MODEL,
    instructions: instructions(signals, budget),
    tools: checkoutTools(checkout, onToolCall),
    stopWhen: isStepCount(budget),
    prepareStep: ({ stepNumber }) =>
      stepNumber >= budget - CAPS.deepLandingSteps ? { activeTools: [] } : {},
    output: Output.object({ schema: schemaFor(signals) }),
    providerOptions: { gateway: { caching: "auto" } },
  })

  try {
    const result = await agent.generate({
      prompt: [
        repoBrief(profile, checkout),
        "",
        `Answer the open questions for ${signals.join(", ")}.`,
      ].join("\n"),
    })

    // The agent's output is typed loosely because the schema is built per call, so parse it
    // back through the same schema to get something typed rather than asserting.
    const parsed = schemaFor(signals).safeParse(result.output)
    if (!parsed.success) {
      return { ok: false, reason: "The scan returned answers in an unexpected shape." }
    }
    const answered: SignalVerdict[] = Object.entries(parsed.data).map(([signal, verdict]) => ({
      ...verdict,
      signal,
    }))
    const { verdicts, unsupported, unmatched } = partitionVerdicts(
      answered,
      signals,
      new Set(checkout.entries.map((entry) => entry.path))
    )
    return { ok: true, verdicts, unsupported, unmatched, steps: result.steps.length }
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      return { ok: false, reason: "The scan did not reach an answer for the open signals." }
    }
    return { ok: false, reason: error instanceof Error ? error.message : "Signal resolution failed." }
  }
}
