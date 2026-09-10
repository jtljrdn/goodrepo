import Link from "next/link"
import { Button } from "@workspace/ui/components/button"
import { ReportShell, ReportView, FailureCard } from "@/components/report-view"
import { alt } from "@/app/opengraph-image"
import { failureMessage, readSha, runScan, shaQuery } from "@/lib/scan"
import { readSelectedQuery } from "@/lib/fix-input"

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
  const search = await props.searchParams
  const ref = readSha(search.sha)
  const initialSelected = readSelectedQuery(search.fixes)
  const initiallyOpen = search.choose === "1" || initialSelected.length > 0
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
      <ReportView
        profile={result.profile}
        overall={result.overall}
        categories={result.categories}
        sha={ref}
        initialSelected={initialSelected}
        initiallyOpen={initiallyOpen}
      />
    </ReportShell>
  )
}
