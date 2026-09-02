import { notFound, redirect } from "next/navigation"
import { ReportShell, ReportView, FailureCard } from "@/components/report-view"
import { currentSession } from "@/lib/auth"
import { runDeepScan } from "@/lib/deep"
import { DEEP_SCAN_ENABLED } from "@/lib/flags"
import {
  DAILY_RUNS_PER_ACCOUNT,
  MONTHLY_RUNS_TOTAL,
  type QuotaRefusal,
} from "@/lib/quota"
import { failureMessage } from "@/lib/scan"

export const maxDuration = 300

const REFUSALS: Record<QuotaRefusal, { title: string; detail: string }> = {
  daily: {
    title: "Out of deep scans for today",
    detail: `An account can start ${DAILY_RUNS_PER_ACCOUNT} deep scan${DAILY_RUNS_PER_ACCOUNT === 1 ? "" : "s"} a day. The count is a rolling 24 hours, so the oldest one frees up as it ages out. Reports you have already run stay readable and cost nothing to open again.`,
  },
  monthly: {
    title: "Deep scans are paused for this month",
    detail: `GoodRepo caps itself at ${MONTHLY_RUNS_TOTAL} deep scans a month so a quiet bill cannot become a loud one. That ceiling is reached, so deep scans resume when the month rolls over. Fast scans are unaffected.`,
  },
}

export async function generateMetadata(
  props: PageProps<"/[owner]/[repo]/deep">
) {
  const { owner, repo } = await props.params
  return {
    title: `${owner}/${repo} · deep scan`,
    robots: { index: false, follow: false },
  }
}

export default async function DeepReportPage(
  props: PageProps<"/[owner]/[repo]/deep">
) {
  if (!DEEP_SCAN_ENABLED) notFound()

  const { owner, repo } = await props.params

  const session = await currentSession()
  if (!session) {
    redirect(`/sign-in?next=${encodeURIComponent(`/${owner}/${repo}/deep`)}`)
  }

  const result = await runDeepScan(owner, repo, session.user.id)

  if (!result.ok) {
    const { title, detail } = result.refused
      ? REFUSALS[result.refused]
      : failureMessage(result.failure)
    return (
      <ReportShell owner={owner} repo={repo}>
        <FailureCard title={title} detail={detail} />
      </ReportShell>
    )
  }

  return (
    <ReportShell
      owner={result.profile.owner}
      repo={result.profile.repo}
      sha={result.profile.commitSha}
    >
      <ReportView
        profile={result.profile}
        overall={result.overall}
        categories={result.categories}
        deep={{ verdicts: result.verdicts, unfinished: result.unfinished }}
      />
    </ReportShell>
  )
}
