import { ReportShell, ReportView, FailureCard } from "@/components/report-view"
import { runDeepScan } from "@/lib/deep"
import { failureMessage } from "@/lib/scan"

export const maxDuration = 300

export async function generateMetadata(
  props: PageProps<"/[owner]/[repo]/deep">
) {
  const { owner, repo } = await props.params
  return {
    title: `${owner}/${repo} · deep scan`,
    // A deep scan costs real money to produce, so it is not something crawlers should walk into.
    robots: { index: false, follow: false },
  }
}

export default async function DeepReportPage(
  props: PageProps<"/[owner]/[repo]/deep">
) {
  const { owner, repo } = await props.params
  const result = await runDeepScan(owner, repo)

  if (!result.ok) {
    const { title, detail } = failureMessage(result.failure)
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
