import { withCheckout, type CheckoutTarget } from "../sandbox"
import type { RepoProfile, SignalId } from "../types"
import {
  judgeConsistency,
  resolveSignals,
  unresolvedSignals,
  type SignalVerdict,
} from "./signals"
import type { ToolCall } from "./tools"

export type DeepScan = {
  profile: RepoProfile
  /** Signals the static pass left open, in the order they were asked about. */
  asked: SignalId[]
  /** Answers grounded in files actually present in the checkout. */
  verdicts: SignalVerdict[]
  /** Set when the agent ran but could not finish. The static profile is still returned. */
  failure: string | null
}

export function applyVerdicts(
  profile: RepoProfile,
  verdicts: SignalVerdict[]
): RepoProfile {
  const has = { ...profile.has }
  for (const verdict of verdicts) {
    // A null stays null: the repository has nothing of this kind to judge, which is not the
    // same as failing the signal, and the scorer already excludes nulls from the fraction.
    const judged = judgeConsistency(verdict)
    if (judged === null) continue
    has[verdict.signal as SignalId] = judged
  }
  return { ...profile, has }
}

/**
 * Finishes a scan the static pass has already done most of.
 *
 * The profile comes in already measured, so nothing here re-derives it: no sampling, no
 * config reads, no detectors. The sandbox exists only so the agent can read real code while
 * answering the handful of signals the static pass could not settle, and the answers are
 * folded back into the same profile.
 */
export async function deepScan(
  target: CheckoutTarget,
  profile: RepoProfile,
  onToolCall: (call: ToolCall) => void = () => {}
): Promise<DeepScan> {
  const asked = unresolvedSignals(profile)
  if (asked.length === 0) return { profile, asked, verdicts: [], failure: null }

  // Deliberately one pass.
  //
  // Repeated passes and unanimity were tried and removed. They cost three times as much and
  // bought nothing: repos that were already stable stayed stable, and on vercel/swr three
  // passes agreed with each other inside a run and then contradicted the previous run. They
  // share a sandbox, an identical prompt and the gateway's cache, so they are not independent
  // samples and unanimity measures correlation rather than confidence.
  return withCheckout(target, async (checkout) => {
    const resolution = await resolveSignals(
      checkout,
      asked,
      profile,
      onToolCall
    )
    if (!resolution.ok)
      return { profile, asked, verdicts: [], failure: resolution.reason }
    return {
      profile: applyVerdicts(profile, resolution.verdicts),
      asked,
      verdicts: resolution.verdicts,
      failure: null,
    }
  })
}
