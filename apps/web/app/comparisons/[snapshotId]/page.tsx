import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { Button } from "@workspace/ui/components/button"
import { SiteHeader } from "@/components/site-header"
import { ComparisonDetail } from "@/components/comparison-view"
import { verifiedSession } from "@/lib/auth"
import { baselinesFor, snapshotFor } from "@/lib/fix-plans"
import { improvementWorkflow } from "@/lib/flags"
import { confirmPrivateRepository } from "@/lib/private-access"

export const metadata = {
  title: "Scan comparison",
  robots: { index: false, follow: false },
}

export default async function ComparisonPage(
  props: PageProps<"/comparisons/[snapshotId]">
) {
  if (!(await improvementWorkflow())) notFound()
  const session = await verifiedSession()
  if (!session) redirect("/sign-in")
  const { snapshotId } = await props.params
  const target = await snapshotFor(session.user.id, snapshotId)
  if (!target) notFound()
  if (
    target.mode === "private" &&
    !(await confirmPrivateRepository(
      target.owner,
      target.repo,
      target.repositoryId
    ))
  )
    notFound()

  const candidates = await baselinesFor(session.user.id, target)
  const requested = (await props.searchParams).baseline
  const requestedId = typeof requested === "string" ? requested : null
  const baseline = requestedId
    ? await snapshotFor(session.user.id, requestedId)
    : (candidates[0] ?? null)
  if (
    !baseline ||
    baseline.repositoryId !== target.repositoryId ||
    baseline.mode !== target.mode
  )
    notFound()

  const compareUrl = `https://github.com/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}/compare/${baseline.commitSha}...${target.commitSha}`
  return (
    <>
      <SiteHeader>
        <Link href="/dashboard" className="text-xs hover:underline">
          Dashboard
        </Link>
      </SiteHeader>
      <main className="mx-auto max-w-5xl px-6 pb-24">
        <section className="py-10">
          <p className="text-xs text-muted-foreground">
            Account-only comparison
          </p>
          <h1 className="mt-2 text-2xl font-medium tracking-tight">
            {target.owner}/{target.repo}
          </h1>
          <div className="mt-5 flex flex-wrap gap-2">
            {candidates.map((candidate) => (
              <Link
                key={candidate.id}
                href={`/comparisons/${target.id}?baseline=${candidate.id}`}
                prefetch={false}
                rel="nofollow"
              >
                <Button
                  variant={candidate.id === baseline.id ? "default" : "outline"}
                  size="sm"
                >
                  Baseline {candidate.commitSha.slice(0, 7)}
                </Button>
              </Link>
            ))}
          </div>
        </section>
        <ComparisonDetail baseline={baseline} target={target} />
        <a
          href={compareUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-8 inline-flex text-xs underline-offset-4 hover:underline"
        >
          Open these two commits in GitHub
        </a>
      </main>
    </>
  )
}
