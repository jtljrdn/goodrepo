import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { Button } from "@workspace/ui/components/button"
import { SiteHeader } from "@/components/site-header"
import { CopyButton } from "@/components/copy-button"
import { ComparisonSummary } from "@/components/comparison-view"
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

  return (
    <>
      <SiteHeader>
        <Link href="/dashboard" className="text-xs hover:underline">
          Dashboard
        </Link>
      </SiteHeader>
      <main className="mx-auto max-w-5xl px-6 pb-24">
        <section className="py-10">
          <p className="text-xs text-muted-foreground">Saved fix plan</p>
          <h1 className="mt-2 text-2xl font-medium tracking-tight">
            {detail.baseline.owner}/{detail.baseline.repo}
          </h1>
          <p className="mt-3 text-xs text-muted-foreground">
            Immutable baseline {detail.baseline.commitSha} ·{" "}
            {detail.plan.selectedSignalIds.length} selected checks
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {instructions ? (
              <CopyButton
                value={instructions}
                label="Copy plan instructions"
                text="Copy instructions"
                manualFallback
              />
            ) : (
              <p className="text-xs text-destructive">
                The baseline could not be rescanned, so instructions are
                temporarily unavailable.
              </p>
            )}
            <Link
              href={`/${detail.baseline.owner}/${detail.baseline.repo}${detail.plan.mode === "private" ? "/private" : ""}?sha=${detail.baseline.commitSha}`}
              prefetch={false}
            >
              <Button variant="outline" size="sm">
                Open baseline report
              </Button>
            </Link>
          </div>
        </section>

        <section className="border-t border-border/60 py-10">
          <h2 className="mb-5 text-sm font-medium">Selected checks</h2>
          <ul className="divide-y divide-border/60 border-y border-border/60">
            {detail.baseline.payload.categories.flatMap((category) =>
              category.signals.flatMap((signal) =>
                selected.has(signal.id) ? (
                  <li key={signal.id} className="py-4 text-sm">
                    <p className="font-medium">{signal.subject}</p>
                    <p className="mt-1 font-sans text-sm text-muted-foreground">
                      {signal.finding}
                    </p>
                  </li>
                ) : (
                  []
                )
              )
            )}
          </ul>
        </section>

        {detail.plan.archivedAt ? (
          <section className="border-t border-border/60 py-10">
            <p className="text-sm text-muted-foreground">
              This plan is archived.
            </p>
            <form
              action={unarchiveFixPlanAction.bind(null, detail.plan.id)}
              className="mt-4"
            >
              <Button type="submit" variant="outline" size="sm">
                Resume plan
              </Button>
            </form>
          </section>
        ) : (
          <section className="border-t border-border/60 py-10">
            <h2 className="mb-5 text-sm font-medium">Verify at a new commit</h2>
            <VerificationForm planId={detail.plan.id} />
          </section>
        )}

        <section className="border-t border-border/60 py-10">
          <h2 className="mb-5 text-sm font-medium">Verification history</h2>
          {detail.verifications.length ? (
            <ul className="space-y-5">
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
                  <li key={target.id}>
                    <ComparisonSummary
                      baseline={detail.baseline}
                      target={target}
                    />
                    <p className="mt-2 text-xs text-muted-foreground">
                      {passed} of {selected.size} selected checks pass ·{" "}
                      {complete ? "complete at this target" : "work remains"} ·{" "}
                      {verifiedAt.toLocaleString()}
                    </p>
                    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      {selectedOutcomes.map((item) => (
                        <li key={item.id}>
                          {item.baseline?.subject ?? item.id}:{" "}
                          {item.target?.status === "pass"
                            ? "passing"
                            : item.target?.status === "fail"
                              ? "still failing"
                              : "not measured"}
                        </li>
                      ))}
                    </ul>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No verification runs yet.
            </p>
          )}
        </section>

        <section className="border-t border-border/60 py-10">
          <div className="flex flex-wrap gap-3">
            {!detail.plan.archivedAt ? (
              <form action={archiveFixPlanAction.bind(null, detail.plan.id)}>
                <Button type="submit" variant="outline" size="sm">
                  Archive plan
                </Button>
              </form>
            ) : null}
            <details>
              <summary className="cursor-pointer text-xs text-destructive">
                Delete plan
              </summary>
              <form
                action={deleteFixPlanAction.bind(null, detail.plan.id)}
                className="mt-3"
              >
                <Button type="submit" variant="destructive" size="sm">
                  Delete this plan
                </Button>
              </form>
            </details>
          </div>
        </section>
      </main>
    </>
  )
}
