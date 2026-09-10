import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { Button } from "@workspace/ui/components/button"
import { SiteHeader } from "@/components/site-header"
import { CopyButton } from "@/components/copy-button"
import { VerificationForm } from "@/components/verification-form"
import {
  archiveFixPlanAction,
  deleteFixPlanAction,
  unarchiveFixPlanAction,
} from "@/lib/fix-actions"
import { buildAgentInstructions } from "@/lib/agent-instructions"
import { verifiedSession } from "@/lib/auth"
import { fixPlanFor } from "@/lib/fix-plans"
import { improvementWorkflow } from "@/lib/flags"
import { confirmPrivateRepository } from "@/lib/private-access"
import { runPrivateScan, scanAtSha } from "@/lib/scan"
import { compareSnapshots } from "@/lib/scan-comparison"

export const metadata = {
  title: "Fix plan",
  robots: { index: false, follow: false },
}

export default async function FixPlanPage(props: PageProps<"/fixes/[planId]">) {
  if (!(await improvementWorkflow())) notFound()
  const { planId } = await props.params
  const session = await verifiedSession()
  if (!session)
    redirect(`/sign-in?next=${encodeURIComponent(`/fixes/${planId}`)}`)
  const detail = await fixPlanFor(session.user.id, planId)
  if (!detail) notFound()

  const privateToken =
    detail.plan.mode === "private"
      ? await confirmPrivateRepository(
          detail.baseline.owner,
          detail.baseline.repo,
          detail.baseline.repositoryId
        )
      : undefined
  if (detail.plan.mode === "private" && !privateToken) notFound()
  const baselineResult = privateToken
    ? await runPrivateScan(
        detail.baseline.owner,
        detail.baseline.repo,
        privateToken,
        detail.baseline.commitSha
      )
    : await scanAtSha(
        detail.baseline.owner,
        detail.baseline.repo,
        detail.baseline.commitSha
      )
  const instructions = baselineResult.ok
    ? buildAgentInstructions({
        profile: baselineResult.profile,
        overall: baselineResult.overall,
        categories: baselineResult.categories,
        kind: detail.plan.mode === "private" ? "private" : "static",
        selectedIds: detail.plan.selectedSignalIds,
        returnUrl: `/fixes/${detail.plan.id}`,
      })
    : null
  const selected = new Set(detail.plan.selectedSignalIds)
  const selectedSignals = detail.baseline.payload.categories.flatMap(
    (category) =>
      category.signals.flatMap((signal) =>
        selected.has(signal.id) ? [{ category: category.name, signal }] : []
      )
  )
  const baselineHref = `/${detail.baseline.owner}/${detail.baseline.repo}${detail.plan.mode === "private" ? "/private" : ""}?sha=${detail.baseline.commitSha}`

  return (
    <>
      <SiteHeader>
        <Link href="/dashboard" className="text-xs hover:underline">
          Dashboard
        </Link>
      </SiteHeader>
      <main className="mx-auto w-full max-w-5xl px-6 pb-24 sm:border-x sm:border-border/60">
        <section className="grid gap-8 py-12 md:grid-cols-[minmax(0,1fr)_15rem] md:items-end md:py-16">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span
                className={`size-2 ${detail.plan.archivedAt ? "bg-muted-foreground" : "bg-success"}`}
                aria-hidden
              />
              <span>
                {detail.plan.archivedAt ? "Archived plan" : "Active plan"}
              </span>
              <span aria-hidden>·</span>
              <span>
                {detail.plan.mode === "private" ? "Private" : "Public"}{" "}
                repository
              </span>
            </div>
            <h1 className="mt-4 text-3xl leading-tight font-medium tracking-[-0.03em] break-words sm:text-4xl">
              {detail.baseline.owner}/<wbr />
              {detail.baseline.repo}
            </h1>
            <p className="mt-4 max-w-2xl font-sans text-sm leading-6 text-muted-foreground">
              A focused checklist saved against an immutable baseline. Copy the
              instructions into your coding agent, then verify the result at a
              new commit.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              {instructions ? (
                <CopyButton
                  value={instructions}
                  label="Copy plan instructions"
                  text="Copy instructions"
                  manualFallback
                  variant="default"
                  className="min-h-9 px-3"
                />
              ) : (
                <p className="max-w-lg border border-destructive/40 px-3 py-2 text-xs text-destructive">
                  The baseline could not be rescanned, so instructions are
                  temporarily unavailable.
                </p>
              )}
              <Link href={baselineHref} prefetch={false}>
                <Button variant="outline" className="min-h-9 px-3">
                  Open baseline report
                </Button>
              </Link>
            </div>
          </div>

          <dl className="grid grid-cols-2 border border-border/60 md:grid-cols-1">
            <div className="border-r border-border/60 p-4 md:border-r-0 md:border-b">
              <dt className="text-[11px] text-muted-foreground">Baseline</dt>
              <dd className="mt-1 text-sm font-medium tabular-nums">
                {detail.baseline.commitSha.slice(0, 7)}
              </dd>
            </div>
            <div className="p-4">
              <dt className="text-[11px] text-muted-foreground">Plan scope</dt>
              <dd className="mt-1 text-sm font-medium tabular-nums">
                {selectedSignals.length}{" "}
                {selectedSignals.length === 1 ? "check" : "checks"}
              </dd>
            </div>
          </dl>
        </section>

        <section className="border-t border-border/60 py-12">
          <div className="mb-6 flex items-end justify-between gap-6">
            <div>
              <h2 className="text-lg font-medium tracking-tight">Plan scope</h2>
              <p className="mt-2 font-sans text-sm text-muted-foreground">
                Only these findings are included in the agent instructions.
              </p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {selectedSignals.length} total
            </span>
          </div>
          <ol className="divide-y divide-border/60 border-y border-border/60">
            {selectedSignals.map(({ category, signal }, index) => (
              <li
                key={signal.id}
                className="grid gap-3 py-5 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:gap-4"
              >
                <span className="text-xs text-muted-foreground tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{signal.subject}</p>
                  <p className="mt-1.5 max-w-3xl font-sans text-sm leading-6 text-muted-foreground">
                    {signal.finding}
                  </p>
                </div>
                <span className="w-fit self-start border border-border/60 px-2 py-1 text-[11px] whitespace-nowrap text-muted-foreground">
                  {category}
                </span>
              </li>
            ))}
          </ol>
        </section>

        {detail.plan.archivedAt ? (
          <section className="border-t border-border/60 py-12">
            <div className="flex flex-col justify-between gap-5 border border-border/60 bg-muted/20 p-5 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-sm font-medium">This plan is archived</h2>
                <p className="mt-1 font-sans text-sm text-muted-foreground">
                  Resume it to run another verification.
                </p>
              </div>
              <form action={unarchiveFixPlanAction.bind(null, detail.plan.id)}>
                <Button
                  type="submit"
                  variant="outline"
                  className="min-h-9 px-3"
                >
                  Resume plan
                </Button>
              </form>
            </div>
          </section>
        ) : (
          <section className="grid gap-6 border-t border-border/60 py-12 md:grid-cols-[minmax(0,0.65fr)_minmax(20rem,1.35fr)] md:gap-12">
            <div>
              <h2 className="text-lg font-medium tracking-tight">
                Verify your work
              </h2>
              <p className="mt-2 max-w-sm font-sans text-sm leading-6 text-muted-foreground">
                Scan a new commit against this plan to see which selected checks
                now pass and what still needs attention.
              </p>
            </div>
            <VerificationForm planId={detail.plan.id} />
          </section>
        )}

        <section className="border-t border-border/60 py-12">
          <div className="mb-6 flex items-end justify-between gap-6">
            <div>
              <h2 className="text-lg font-medium tracking-tight">
                Verification history
              </h2>
              <p className="mt-2 font-sans text-sm text-muted-foreground">
                Results stay attached to this immutable baseline.
              </p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {detail.verifications.length}{" "}
              {detail.verifications.length === 1 ? "run" : "runs"}
            </span>
          </div>
          {detail.verifications.length ? (
            <ol className="space-y-4">
              {detail.verifications.map(({ target, verifiedAt }) => {
                const comparison = compareSnapshots(detail.baseline, target)
                const selectedOutcomes = comparison.signals.filter((item) =>
                  selected.has(item.id)
                )
                const passed = selectedOutcomes.filter(
                  (item) => item.target?.status === "pass"
                ).length
                const complete =
                  passed === selected.size &&
                  selectedOutcomes.every(
                    (item) => item.transition !== "not-comparable"
                  )
                return (
                  <li key={target.id} className="border border-border/60">
                    <div className="flex flex-col justify-between gap-4 border-b border-border/60 bg-muted/20 px-5 py-4 sm:flex-row sm:items-center">
                      <div>
                        <p className="text-sm font-medium">
                          Target {target.commitSha.slice(0, 7)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Verified {verifiedAt.toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {passed}/{selected.size} passing
                        </span>
                        <span
                          className={`border px-2 py-1 text-[11px] ${
                            complete
                              ? "border-success/40 text-success"
                              : "border-border text-muted-foreground"
                          }`}
                        >
                          {complete ? "Complete" : "Work remains"}
                        </span>
                      </div>
                    </div>
                    <div className="p-5">
                      <p className="text-sm font-medium">
                        Compared with {detail.baseline.commitSha.slice(0, 7)}:{" "}
                        {comparison.counts.nowPassing} checks now pass ·{" "}
                        {comparison.counts.nowFailing} now fail ·{" "}
                        {comparison.counts.coverageChanged} changed coverage
                      </p>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        Baseline {detail.baseline.commitSha.slice(0, 7)} ·
                        target {target.commitSha.slice(0, 7)}. This comparison
                        does not imply ancestry or causality.
                      </p>
                      <ul className="mt-4 grid gap-x-8 gap-y-2 text-xs sm:grid-cols-2">
                        {selectedOutcomes.map((item) => (
                          <li
                            key={item.id}
                            className="flex items-start justify-between gap-4 border-t border-border/40 pt-2"
                          >
                            <span>{item.baseline?.subject ?? item.id}</span>
                            <span
                              className={
                                item.target?.status === "pass"
                                  ? "shrink-0 text-success"
                                  : "shrink-0 text-muted-foreground"
                              }
                            >
                              {item.target?.status === "pass"
                                ? "Passing"
                                : item.target?.status === "fail"
                                  ? "Still failing"
                                  : "Not measured"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </li>
                )
              })}
            </ol>
          ) : (
            <div className="border border-dashed border-border px-5 py-10 text-center">
              <p className="text-sm font-medium">No verification runs yet</p>
              <p className="mt-2 font-sans text-sm text-muted-foreground">
                Your first result will appear here after you verify a commit.
              </p>
            </div>
          )}
        </section>

        <section className="border-t border-border/60 py-8">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
            <div>
              <h2 className="text-sm font-medium">Plan settings</h2>
              <p className="mt-1 font-sans text-xs text-muted-foreground">
                Archive this plan for later, or permanently delete it.
              </p>
            </div>
            <div className="flex flex-wrap items-start gap-3">
              {!detail.plan.archivedAt ? (
                <form action={archiveFixPlanAction.bind(null, detail.plan.id)}>
                  <Button
                    type="submit"
                    variant="outline"
                    className="min-h-9 px-3"
                  >
                    Archive plan
                  </Button>
                </form>
              ) : null}
              <details className="group border border-transparent open:border-destructive/30 open:p-3">
                <summary className="flex min-h-9 cursor-pointer list-none items-center px-3 text-xs text-destructive group-open:min-h-0 group-open:px-0 hover:bg-destructive/10 group-open:hover:bg-transparent focus-visible:outline-1 focus-visible:outline-ring">
                  Delete plan
                </summary>
                <form
                  action={deleteFixPlanAction.bind(null, detail.plan.id)}
                  className="mt-3"
                >
                  <p className="mb-3 max-w-xs font-sans text-xs leading-5 text-muted-foreground">
                    This removes the saved plan and its verification history.
                    This action cannot be undone.
                  </p>
                  <Button
                    type="submit"
                    variant="destructive"
                    className="min-h-9 px-3"
                  >
                    Delete this plan
                  </Button>
                </form>
              </details>
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
