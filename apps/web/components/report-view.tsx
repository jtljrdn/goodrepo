import Link from "next/link"
import { Button } from "@workspace/ui/components/button"
import { SiteHeader } from "@/components/site-header"
import {
  CategoryDetail,
  CategorySummary,
  DeepVerdicts,
  ProfileBlock,
  RecommendationItem,
  ReportHeadline,
  Section,
} from "@/components/report"
import type { RepoProfile, SignalVerdict } from "@/lib/profile"
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
  // A deep scan that could not finish leaves a fast report behind, so it must not be
  // described as one that read the source.
  const ran = deep !== null && deep.unfinished === null ? deep : null
  const signals = categories.flatMap((category) => category.signals)
  const measured = signals.filter(
    (signal) => signal.status !== "not-measured"
  ).length
  // Once a deep scan has run, nothing is pending: every signal it could answer was asked, and
  // the ones still unscored are the ones it looked for and did not find.
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
          {ran
            ? "Deep scan · a model read the source in a sandbox"
            : "Fast scan · 0 model tokens"}
        </span>
        <span className="ml-auto text-muted-foreground">
          {measured} signals checked
          {pending > 0 ? ` · ${pending} need a deep scan` : ""}
          {ran && ran.verdicts.length > 0
            ? ` · ${ran.verdicts.length} answered by the deep scan`
            : ""}
        </span>
      </div>

      {deep?.unfinished ? (
        <p className="mt-4 border border-warn/40 px-3 py-2 text-xs text-warn">
          The deep scan did not finish, so this is the fast scan.{" "}
          {deep.unfinished}
        </p>
      ) : null}

      {profile.truncated ? (
        <p className="mt-4 border border-warn/40 px-3 py-2 text-xs text-warn">
          Partial scan. {profile.truncated.detail} The score reflects what was
          read.
        </p>
      ) : null}

      <Section
        title="Category scores"
        hint="Average of six categories, equally weighted"
      >
        <CategorySummary categories={categories} />
      </Section>

      {ran && ran.verdicts.length > 0 ? (
        <Section
          title="Deep findings"
          hint="Read from the source and folded into the scores above"
        >
          <DeepVerdicts verdicts={ran.verdicts} profile={profile} />
        </Section>
      ) : null}

      <Section
        title="Evidence"
        hint="Every point is traceable to a repository signal"
      >
        <div className="border-t border-border/60">
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
          <p className="text-sm text-muted-foreground">
            No blocking issues found. This repository is already easy for agents
            to work in.
          </p>
        )}
      </Section>

      <Section title="Repository profile">
        <ProfileBlock profile={profile} />
      </Section>

      <Section
        title="Go deeper"
        hint={ran ? "Deep scan ran on this report" : "Not run on this scan"}
      >
        <div className="grid gap-px sm:grid-cols-2">
          <div className="border border-border/60 p-5">
            <h3 className="text-sm font-medium">Deep scan</h3>
            <p className="mt-2 font-sans text-sm leading-relaxed text-muted-foreground">
              {ran
                ? "A throwaway sandbox cloned this commit and a model read the code behind the signals the fast scan could not settle. The answers above are cached against this commit, so reloading costs nothing."
                : `Clones this commit into a throwaway sandbox and lets a model read the code behind the ${pending > 0 ? pending : "few"} signals counting alone cannot settle. Takes about a minute.`}
            </p>
            {ran ? (
              <Link href={`/${profile.owner}/${profile.repo}`}>
                <Button variant="outline" size="sm" className="mt-4">
                  Back to the fast scan
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
          <div className="border border-border/60 p-5">
            <h3 className="text-sm font-medium">Agent benchmark</h3>
            <p className="mt-2 font-sans text-sm leading-relaxed text-muted-foreground">
              Runs coding agents against generated tasks in an isolated copy of
              the repository and measures task success, files inspected, cost,
              and scope violations. Never runs automatically.
            </p>
            <Button variant="outline" size="sm" className="mt-4" disabled>
              Run from the CLI
            </Button>
          </div>
        </div>
      </Section>
    </>
  )
}
