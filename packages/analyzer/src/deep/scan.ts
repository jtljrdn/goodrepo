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
  asked: SignalId[]
  verdicts: SignalVerdict[]
  failure: string | null
}

export function applyVerdicts(
  profile: RepoProfile,
  verdicts: SignalVerdict[]
): RepoProfile {
  const has = { ...profile.has }
  for (const verdict of verdicts) {
    const judged = judgeConsistency(verdict)
    if (judged === null) continue
    has[verdict.signal as SignalId] = judged
  }
  return { ...profile, has }
}

export async function deepScan(
  target: CheckoutTarget,
  profile: RepoProfile,
  onToolCall: (call: ToolCall) => void = () => {}
): Promise<DeepScan> {
  const asked = unresolvedSignals(profile)
  if (asked.length === 0) return { profile, asked, verdicts: [], failure: null }

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
