import Link from "next/link"
import { Button } from "@workspace/ui/components/button"
import { SiteHeader } from "@/components/site-header"
import {
  CategoryDetail,
  CategorySummary,
  DeepVerdicts,
  RecommendationItem,
  ReportHeadline,
  Section,
} from "@/components/report"
import type { RepoProfile, SignalVerdict } from "@/lib/profile"
import { DEEP_SCAN_ENABLED } from "@/lib/flags"
import { recommend } from "@/lib/recommendations"
import { DEEP_SCAN_ONLY, type ScoredCategory } from "@/lib/score"

export type DeepDetail = {
  verdicts: SignalVerdict[]
  unfinished: string | null
}

export function ReportShell({
  owner,
  repo,
  sha,
  children,
}: {
  owner: string
  repo: string
  sha?: string
  children: React.ReactNode
}) {
  return (
    <>
      <SiteHeader>
        <span className="hidden sm:inline">
          {owner}/{repo}
        </span>
        {sha ? (
          <span className="hidden border border-border px-1.5 py-px sm:inline">
            @{sha}
          </span>
        ) : null}
        <Link href="/">
          <Button variant="outline" size="sm">
            New scan
          </Button>
        </Link>
      </SiteHeader>
      <main className="mx-auto max-w-5xl px-6 pb-24">{children}</main>
    </>
  )
}

export function FailureCard({
  title,
  detail,
}: {
  title: string
  detail: string
}) {
  return (
    <div className="mt-16 border border-border/60 p-8">
      <h1 className="text-lg font-medium">{title}</h1>
      <p className="mt-3 max-w-prose font-sans text-sm leading-relaxed text-muted-foreground">
        {detail}
      </p>
    </div>
  )
}

export function ReportView({
  profile,
  overall,
  categories,
  deep = null,
}: {
  profile: RepoProfile
  overall: number | null
  categories: ScoredCategory[]
  deep?: DeepDetail | null
}) {
  const recommendations = recommend(profile, categories)
  const ran = deep !== null && deep.unfinished === null ? deep : null
  const signals = categories.flatMap((category) => category.signals)
  const measured = signals.filter(
    (signal) => signal.status !== "not-measured"
  ).length
  const pending = ran
    ? 0
    : signals.filter(
        (signal) =>
          signal.status === "not-measured" && DEEP_SCAN_ONLY.has(signal.id)
      ).length

  return (
    <>
      <ReportHeadline profile={profile} overall={overall} />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border/60 py-3 text-xs">
        <span className="text-muted-foreground">
          {ran ? "Deep scan · an AI read the code" : "Quick scan · no AI"}
        </span>
        <span className="ml-auto text-muted-foreground">
          {measured} checks run
          {pending > 0 ? ` · ${pending} need a deep scan` : ""}
        </span>
      </div>

      {deep?.unfinished ? (
        <p className="mt-4 border border-warn/40 px-3 py-2 text-xs text-warn">
          The deep scan did not finish, so this is the quick scan.{" "}
          {deep.unfinished}
        </p>
      ) : null}

      {profile.truncated ? (
        <p className="mt-4 border border-warn/40 px-3 py-2 text-xs text-warn">
          Partial scan. GitHub only listed part of this repository, so the score
          covers what could be read.
        </p>
      ) : null}

      <Section
        title="Scores"
        hint="The overall score is the average of these six"
      >
        <CategorySummary categories={categories} />
      </Section>

      {ran && ran.verdicts.length > 0 ? (
        <Section
          title="What the AI found"
          hint="Already counted in the scores above"
        >
          <DeepVerdicts verdicts={ran.verdicts} profile={profile} />
        </Section>
      ) : null}

      <Section
        title="How each score was earned"
        hint="Open a category to see every check"
      >
        <div className="border-t border-border/60">
          {categories.map((category) => (
            <CategoryDetail key={category.key} category={category} />
          ))}
        </div>
      </Section>

      <Section title="What to fix" hint="Biggest wins first">
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
          <p className="text-sm text-muted-foreground">
            Nothing to fix. This repository is already easy for agents to work
            in.
          </p>
        )}
      </Section>

      <Section
        title="Go deeper"
        hint={
          ran
            ? "Deep scan included"
            : DEEP_SCAN_ENABLED
              ? "Not run yet"
              : "Not available yet"
        }
      >
        <div className="grid gap-px sm:max-w-md">
          <div className="border border-border/60 p-5">
            <h3 className="text-sm font-medium">Deep scan</h3>
            <p className="mt-2 font-sans text-sm leading-relaxed text-muted-foreground">
              {ran
                ? "An AI read the code at this commit and answered the checks the quick scan could not. Opening this report again is free."
                : `An AI reads the code to settle the ${pending > 0 ? pending : "few"} checks a quick scan cannot. Takes about a minute.`}
            </p>
            {!DEEP_SCAN_ENABLED ? (
              <Button variant="outline" size="sm" className="mt-4" disabled>
                Not available yet
              </Button>
            ) : ran ? (
              <Link href={`/${profile.owner}/${profile.repo}`}>
                <Button variant="outline" size="sm" className="mt-4">
                  Back to the quick scan
                </Button>
              </Link>
            ) : (
              <Link
                href={`/${profile.owner}/${profile.repo}/deep`}
                prefetch={false}
                rel="nofollow"
              >
                <Button variant="outline" size="sm" className="mt-4">
                  {deep ? "Try the deep scan again" : "Run deep scan"}
                </Button>
              </Link>
            )}
          </div>
        </div>
      </Section>
    </>
  )
}
