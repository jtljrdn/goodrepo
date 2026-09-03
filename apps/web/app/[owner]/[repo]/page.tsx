import Link from "next/link"
import { Button } from "@workspace/ui/components/button"
import { ReportShell, ReportView, FailureCard } from "@/components/report-view"
import { LogScan } from "@/components/log-scan"
import { alt } from "@/app/opengraph-image"
import { failureMessage, readSha, runScan, shaQuery } from "@/lib/scan"

export const maxDuration = 300

const OG_IMAGE = { url: "/opengraph-image", width: 1200, height: 630, alt }

export async function generateMetadata(props: PageProps<"/[owner]/[repo]">) {
  const { owner, repo } = await props.params
  const title = `${owner}/${repo}`
  const description = `GoodRepo scores ${owner}/${repo} on how easy it is for AI agents to work in.`
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
  const ref = readSha((await props.searchParams).sha)
  const result = await runScan(owner, repo, ref)

  if (!result.ok) {
    const { title, detail } = failureMessage(result.failure)
    const query = shaQuery(ref)
    return (
      <ReportShell owner={owner} repo={repo}>
        <FailureCard title={title} detail={detail}>
          {result.failure.kind === "not-found" ? (
            <Link
              href={`/${owner}/${repo}/private${query}`}
              prefetch={false}
              rel="nofollow"
            >
              <Button variant="outline" size="sm">
                Scan it as a private repository
              </Button>
            </Link>
          ) : null}
        </FailureCard>
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
        kind="fast"
        score={result.overall}
      />
      <ReportView
        profile={result.profile}
        overall={result.overall}
        categories={result.categories}
        sha={ref}
      />
    </ReportShell>
  )
}
