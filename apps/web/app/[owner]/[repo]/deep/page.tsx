import { notFound, redirect } from "next/navigation"
import { ReportShell, ReportView, FailureCard } from "@/components/report-view"
import { LogScan } from "@/components/log-scan"
import { verifiedSession } from "@/lib/auth"
import { runDeepScan } from "@/lib/deep"
import { DEEP_SCAN_ENABLED } from "@/lib/flags"
import {
  DAILY_RUNS_PER_ACCOUNT,
  MONTHLY_RUNS_TOTAL,
  type QuotaRefusal,
} from "@/lib/quota"
import { failureMessage, readSha, shaQuery } from "@/lib/scan"

export const maxDuration = 300

const REFUSALS: Record<QuotaRefusal, { title: string; detail: string }> = {
  daily: {
    title: "Out of deep scans for today",
    detail: `Each account gets ${DAILY_RUNS_PER_ACCOUNT} deep scan${DAILY_RUNS_PER_ACCOUNT === 1 ? "" : "s"} a day, counted over the last 24 hours, so the oldest one frees up as it ages out. Reports you already ran stay open and free.`,
  },
  monthly: {
    title: "Deep scans are paused for this month",
    detail: `GoodRepo allows ${MONTHLY_RUNS_TOTAL} deep scans a month across everyone, to keep costs in check. That limit is reached, so deep scans come back next month. Quick scans still work.`,
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
  const ref = readSha((await props.searchParams).sha)
  const query = shaQuery(ref)

  const session = await verifiedSession()
  if (!session) {
    redirect(
      `/sign-in?next=${encodeURIComponent(`/${owner}/${repo}/deep${query}`)}`
    )
  }

  const result = await runDeepScan(owner, repo, session.user.id, ref)

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
      <LogScan
        owner={result.profile.owner}
        repo={result.profile.repo}
        commitSha={result.profile.commitSha}
        kind="deep"
        score={result.overall}
      />
      <ReportView
        profile={result.profile}
        overall={result.overall}
        categories={result.categories}
        deep={{ verdicts: result.verdicts, unfinished: result.unfinished }}
        sha={ref}
      />
    </ReportShell>
  )
}
