import { Suspense } from "react"
import Link from "next/link"
import { evaluate } from "flags/next"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { SiteHeader } from "@/components/site-header"
import {
  CategoryDetail,
  CategorySummary,
  DeepVerdicts,
  RecommendationItem,
  ReportHeadline,
  Section,
} from "@/components/report"
import type { RepoProfile, SignalId, SignalVerdict } from "@/lib/profile"
import { deepScan, improvementWorkflow } from "@/lib/flags"
import { CopyButton } from "@/components/copy-button"
import { buildAgentInstructions, guidanceFor } from "@/lib/agent-instructions"
import { recommend } from "@/lib/recommendations"
import { shaQuery } from "@/lib/scan"
import { DEEP_SCAN_ONLY, type ScoredCategory } from "@/lib/score"
import { FixWorkflow, type FixChoice } from "@/components/fix-workflow"
import { ReportHistory } from "@/components/report-history"

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
        <span className="hidden max-w-48 truncate sm:inline lg:max-w-72">
          {owner}/{repo}
        </span>
        {sha ? (
          <span className="hidden border border-border px-1.5 py-px sm:inline">
            @{sha.slice(0, 7)}
          </span>
        ) : null}
        <Link href="/">
          <Button variant="outline" size="sm">
            New scan
          </Button>
        </Link>
      </SiteHeader>
      <main className="mx-auto w-full max-w-5xl px-6 pb-24">{children}</main>
    </>
  )
}

export function FailureCard({
  title,
  detail,
  children,
}: {
  title: string
  detail: string
  children?: React.ReactNode
}) {
  return (
    <div className="mt-16 border border-border/60 p-8">
      <h1 className="text-lg font-medium">{title}</h1>
      <p className="mt-3 max-w-prose font-sans text-sm leading-relaxed text-muted-foreground">
        {detail}
      </p>
      {children ? <div className="mt-6">{children}</div> : null}
    </div>
  )
}

export async function ReportView({
  profile,
  overall,
  categories,
  deep = null,
  sha = null,
  deepAvailable = true,
  mode = "public",
  initialSelected = [],
  initiallyOpen = false,
}: {
  profile: RepoProfile
  overall: number | null
  categories: ScoredCategory[]
  deep?: DeepDetail | null
  sha?: string | null
  deepAvailable?: boolean
  mode?: "public" | "private"
  initialSelected?: SignalId[]
  initiallyOpen?: boolean
}) {
  const { deepScanEnabled, improvementWorkflowEnabled } = await evaluate({
    deepScanEnabled: deepScan,
    improvementWorkflowEnabled: improvementWorkflow,
  })
  const query = shaQuery(sha)
  const recommendations = recommend(profile, categories)
  const ran = deep !== null && deep.unfinished === null ? deep : null
  const signals = categories.flatMap((category) => category.signals)
  const measured = signals.filter(
    (signal) => signal.status !== "not-measured"
  ).length
  const failed = signals.filter((signal) => signal.status === "fail").length
  const instructions = buildAgentInstructions({
    profile,
    overall,
    categories,
    sha,
    kind: !deepAvailable ? "private" : ran ? "deep" : "static",
    verdicts: ran?.verdicts ?? [],
  })
  const recommendationsById = new Map(
    recommendations.map((recommendation) => [recommendation.id, recommendation])
  )
  const choices: FixChoice[] = categories.flatMap((category) =>
    category.signals.flatMap((signal) => {
      if (signal.status !== "fail") return []
      const recommendation = recommendationsById.get(signal.id)
      return [
        {
          id: signal.id,
          category: category.name,
          finding: signal.text,
          measurement: signal.measurement
            ? JSON.stringify(signal.measurement)
            : null,
          title: recommendation?.title ?? signal.text,
          impact: recommendation?.impact ?? null,
          suggestedFix: recommendation
            ? [recommendation.fix, ...recommendation.bullets]
            : [guidanceFor(signal.id)],
        },
      ]
    })
  )
  const pending = ran
    ? 0
    : signals.filter(
        (signal) =>
          signal.status === "not-measured" && DEEP_SCAN_ONLY.has(signal.id)
      ).length
  const showWorkflow = improvementWorkflowEnabled && !ran && choices.length > 0

  return (
    <>
      <ReportHeadline
        profile={profile}
        overall={overall}
        actions={
          showWorkflow ? (
            <FixWorkflow
              repository={{
                owner: profile.owner,
                repo: profile.repo,
                commitSha: profile.commitSha,
              }}
              mode={mode}
              choices={choices}
              initialSelected={initialSelected}
              initiallyOpen={initiallyOpen}
            />
          ) : (
            <div className="flex flex-wrap items-start gap-x-5 gap-y-3">
              {improvementWorkflowEnabled && ran && choices.length > 0 ? (
                <Link
                  href={`/${profile.owner}/${profile.repo}${query}${query ? "&" : "?"}choose=1`}
                >
                  <Button size="sm" className="min-h-11 px-4">
                    Fix with your agent
                    <span aria-hidden>→</span>
                  </Button>
                </Link>
              ) : null}
              <CopyButton
                value={instructions}
                label="Copy all instructions"
                text={
                  improvementWorkflowEnabled
                    ? "Copy complete scan"
                    : "Copy instructions for agent"
                }
                manualFallback
                className="min-h-11"
              />
              {!ran && pending > 0 && deepAvailable && deepScanEnabled ? (
                <Link
                  href={`/${profile.owner}/${profile.repo}/deep${query}`}
                  prefetch={false}
                  rel="nofollow"
                  className="inline-flex min-h-11 items-center text-xs text-foreground underline-offset-4 hover:underline focus-visible:outline-1 focus-visible:outline-ring"
                >
                  Run deep scan
                </Link>
              ) : null}
            </div>
          )
        }
      />

      <div
        className={cn(
          "flex flex-wrap items-center gap-x-4 gap-y-2 pt-4 text-xs",
          !showWorkflow && "border-t border-border/60"
        )}
      >
        <span className="text-muted-foreground">
          {ran ? "Deep scan" : "Quick scan"}
        </span>
        <span className="text-muted-foreground">
          {measured} checks
          {pending > 0 ? ` · ${pending} need a deep scan` : ""}
        </span>
      </div>

      <details className="mt-1 mb-4 text-xs text-muted-foreground">
        <summary className="w-fit cursor-pointer py-3 underline-offset-4 hover:underline focus-visible:outline-1 focus-visible:outline-ring">
          Scan coverage
        </summary>
        <p className="max-w-prose pb-2 leading-relaxed">
          {profile.sample
            ? `${profile.sample.sampled} of ${profile.sample.total} source files inspected.`
            : "Source contents were not sampled."}
          {profile.configCoverage
            ? ` ${profile.configCoverage.read} of ${profile.configCoverage.total} configs and instructions read.`
            : ""}{" "}
          Unmeasured checks are excluded from scores.
        </p>
      </details>

      {deep?.unfinished ? (
        <p className="mt-4 border border-warn/40 px-3 py-2 text-xs text-warn">
          Deep scan incomplete. Showing the quick scan. {deep.unfinished}
        </p>
      ) : null}

      {profile.truncated ? (
        <p className="mt-4 border border-warn/40 px-3 py-2 text-xs text-warn">
          Partial scan: scores cover only the files GitHub returned.
        </p>
      ) : null}

      <Suspense fallback={null}>
        <ReportHistory
          profile={profile}
          overall={overall}
          categories={categories}
          kind={ran ? "deep" : mode === "private" ? "private" : "fast"}
          mode={mode}
          improvementWorkflowEnabled={improvementWorkflowEnabled}
        />
      </Suspense>

      <Section title="Scores">
        <CategorySummary categories={categories} />
      </Section>

      {ran && ran.verdicts.length > 0 ? (
        <Section title="Deep scan findings">
          <DeepVerdicts verdicts={ran.verdicts} profile={profile} />
        </Section>
      ) : null}

      <Section title="Checks">
        <div className="border-t border-border/60">
          {categories.map((category) => (
            <CategoryDetail key={category.key} category={category} />
          ))}
        </div>
      </Section>

      {improvementWorkflowEnabled && !ran ? null : (
        <Section
          title="What to fix"
          action={
            <CopyButton
              value={instructions}
              label="Copy instructions for agent"
              text="Copy instructions for agent"
              manualFallback
              className="min-h-9"
            />
          }
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
              {failed > 0
                ? `${failed} failed checks. Copy the instructions for a complete fix list.`
                : "No failed checks in this scan."}
            </p>
          )}
        </Section>
      )}
    </>
  )
}
