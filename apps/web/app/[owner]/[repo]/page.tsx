import { ReportShell, ReportView, FailureCard } from "@/components/report-view"
import { alt } from "@/app/opengraph-image"
import { failureMessage, runScan } from "@/lib/scan"

export const maxDuration = 300

const OG_IMAGE = { url: "/opengraph-image", width: 1200, height: 630, alt }

export async function generateMetadata(props: PageProps<"/[owner]/[repo]">) {
  const { owner, repo } = await props.params
  const title = `${owner}/${repo}`
  const description = `GoodRepo scores ${owner}/${repo} for AI agent readiness from measurable repository signals.`
  return {
    title,
    description,
    openGraph: {
      title: `${title} · GoodRepo`,
      description,
      url: `/${title}`,
      images: OG_IMAGE,
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} · GoodRepo`,
      description,
      images: OG_IMAGE,
    },
  }
}

export default async function ReportPage(props: PageProps<"/[owner]/[repo]">) {
  const { owner, repo } = await props.params
  const result = await runScan(owner, repo)

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
      />
    </ReportShell>
  )
}
