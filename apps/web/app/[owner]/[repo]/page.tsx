import Link from "next/link"
import { Button } from "@workspace/ui/components/button"
import { SiteHeader } from "@/components/site-header"
import {
  CategoryDetail,
  CategorySummary,
  ProfileBlock,
  RecommendationItem,
  ReportHeadline,
  Section,
} from "@/components/report"
import { failureMessage, runScan } from "@/lib/scan"
import { recommend } from "@/lib/recommendations"

export const maxDuration = 300

export async function generateMetadata(props: PageProps<"/[owner]/[repo]">) {
  const { owner, repo } = await props.params
  return {
    title: `${owner}/${repo} · GoodRepo`,
    description: `GoodRepo scores ${owner}/${repo} for AI agent readiness from measurable repository signals.`,
  }
}

export default async function ReportPage(props: PageProps<"/[owner]/[repo]">) {
  const { owner, repo } = await props.params
  const result = await runScan(owner, repo)

  if (!result.ok) {
    const { title, detail } = failureMessage(result.failure)
    return (
      <>
        <SiteHeader>
          <span className="hidden sm:inline">
            {owner}/{repo}
          </span>
          <Link href="/">
            <Button variant="outline" size="sm">
              New scan
            </Button>
          </Link>
        </SiteHeader>
        <main className="mx-auto max-w-5xl px-6 pb-24">
          <div className="border-border/60 mt-16 border p-8">
            <h1 className="text-lg font-medium">{title}</h1>
            <p className="text-muted-foreground mt-3 max-w-prose font-sans text-sm leading-relaxed">
              {detail}
            </p>
          </div>
        </main>
      </>
    )
  }

  const { profile, overall, categories } = result
  const recommendations = recommend(profile, categories)
  const measured = categories.reduce(
    (n, c) => n + c.signals.filter((sig) => sig.status !== "not-measured").length,
    0
  )
  const deferred = categories.reduce(
    (n, c) => n + c.signals.filter((sig) => sig.status === "not-measured").length,
    0
  )

  return (
    <>
      <SiteHeader>
        <span className="hidden sm:inline">
          {profile.owner}/{profile.repo}
        </span>
        <span className="border-border hidden border px-1.5 py-px sm:inline">
          @{profile.commitSha}
        </span>
        <Link href="/">
          <Button variant="outline" size="sm">
            New scan
          </Button>
        </Link>
      </SiteHeader>

      <main className="mx-auto max-w-5xl px-6 pb-24">
        <ReportHeadline profile={profile} overall={overall} />

        <div className="border-border/60 flex flex-wrap items-center gap-x-6 gap-y-2 border-t py-3 text-xs">
          <span className="text-muted-foreground">Fast scan · 0 model tokens</span>
          <span className="text-muted-foreground ml-auto">
            {measured} signals checked
            {deferred > 0 ? ` · ${deferred} need a deep scan` : ""}
          </span>
        </div>

        {profile.truncated ? (
          <p className="border-warn/40 text-warn mt-4 border px-3 py-2 text-xs">
            Partial scan. {profile.truncated.detail} The score reflects what was read.
          </p>
        ) : null}

        <Section
          title="Category scores"
          hint="Average of six categories, equally weighted"
        >
          <CategorySummary categories={categories} />
        </Section>

        <Section title="Evidence" hint="Every point is traceable to a repository signal">
          <div className="border-border/60 border-t">
            {categories.map((category) => (
              <CategoryDetail key={category.key} category={category} />
            ))}
          </div>
        </Section>

        <Section
          title="Recommendations"
          hint={`${recommendations.length} ranked by impact`}
        >
          {recommendations.length > 0 ? (
            <ul>
              {recommendations.map((recommendation, index) => (
                <RecommendationItem
                  key={recommendation.id}
                  index={index}
                  recommendation={recommendation}
                  profile={profile}
                />
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">
              No blocking issues found. This repository is already easy for agents to
              work in.
            </p>
          )}
        </Section>

        <Section title="Repository profile">
          <ProfileBlock profile={profile} />
        </Section>

        <Section title="Go deeper" hint="Not run on this scan">
          <div className="grid gap-px sm:grid-cols-2">
            <div className="border-border/60 border p-5">
              <h3 className="text-sm font-medium">Deep scan</h3>
              <p className="text-muted-foreground mt-2 font-sans text-sm leading-relaxed">
                Samples a handful of representative files and asks a model to compare
                them. Adds architecture observations, consistency analysis, and a
                drafted AGENTS.md. Budgeted at 10k input tokens.
              </p>
              <Button variant="outline" size="sm" className="mt-4" disabled>
                Bring your own key
              </Button>
            </div>
            <div className="border-border/60 border p-5">
              <h3 className="text-sm font-medium">Agent benchmark</h3>
              <p className="text-muted-foreground mt-2 font-sans text-sm leading-relaxed">
                Runs coding agents against generated tasks in an isolated copy of the
                repository and measures task success, files inspected, cost, and scope
                violations. Never runs automatically.
              </p>
              <Button variant="outline" size="sm" className="mt-4" disabled>
                Run from the CLI
              </Button>
            </div>
          </div>
        </Section>
      </main>
    </>
  )
}
