import Link from "next/link"
import {
  currentSession,
  GITHUB_SIGN_IN_ENABLED,
  verifiedSession,
} from "@/lib/auth"
import { observeSnapshot } from "@/lib/fix-plans"
import { recordScan, type ScanKind } from "@/lib/history"
import type { RepoProfile } from "@/lib/profile"
import type { QuickScanMode } from "@/lib/scan-snapshot"
import type { ScoredCategory } from "@/lib/score"
import { ComparisonSummary } from "@/components/comparison-view"

export async function ReportHistory({
  profile,
  overall,
  categories,
  kind,
  mode,
  improvementWorkflowEnabled,
}: {
  profile: RepoProfile
  overall: number | null
  categories: ScoredCategory[]
  kind: ScanKind
  mode: QuickScanMode
  improvementWorkflowEnabled: boolean
}) {
  if (!GITHUB_SIGN_IN_ENABLED) return null
  const session =
    mode === "private" ? await verifiedSession() : await currentSession()
  if (!session) return null

  await recordScan(session.user.id, {
    owner: profile.owner,
    repo: profile.repo,
    commitSha: profile.commitSha,
    kind,
    score: overall,
  })
  if (!improvementWorkflowEnabled || kind === "deep") return null
  let observation: Awaited<ReturnType<typeof observeSnapshot>>
  try {
    observation = await observeSnapshot(
      session.user.id,
      profile,
      overall,
      categories,
      mode
    )
  } catch (error) {
    console.warn("Could not record or compare scan snapshot.", error)
    return null
  }
  if (!observation.baseline) return null
  return (
    <div className="mb-8">
      <ComparisonSummary
        baseline={observation.baseline}
        target={observation.snapshot}
      />
      <Link
        href={`/comparisons/${observation.snapshot.id}?baseline=${observation.baseline.id}`}
        prefetch={false}
        rel="nofollow"
        className="mt-3 inline-flex text-xs underline-offset-4 hover:underline"
      >
        View detailed comparison or choose another baseline
      </Link>
    </div>
  )
}
