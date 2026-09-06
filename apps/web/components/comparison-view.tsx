import { compareSnapshots } from "@/lib/scan-comparison"
import type { ScanSnapshot } from "@/lib/scan-snapshot"

const LABEL = {
  "now-passing": "Now passing",
  "now-failing": "Now failing",
  "still-failing": "Still failing",
  "still-passing": "Still passing",
  "newly-measured": "Newly measured",
  "no-longer-measured": "No longer measured",
  "not-comparable": "Not comparable",
} as const

export function ComparisonSummary({
  baseline,
  target,
}: {
  baseline: ScanSnapshot
  target: ScanSnapshot
}) {
  const comparison = compareSnapshots(baseline, target)
  return (
    <div className="border border-border/60 p-4">
      <p className="text-sm font-medium">
        Compared with {baseline.commitSha.slice(0, 7)}:{" "}
        {comparison.counts.nowPassing} checks now pass ·{" "}
        {comparison.counts.nowFailing} now fail ·{" "}
        {comparison.counts.coverageChanged} changed coverage
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Baseline {baseline.commitSha.slice(0, 7)} · target{" "}
        {target.commitSha.slice(0, 7)}. This comparison does not imply ancestry
        or causality.
      </p>
    </div>
  )
}

export function ComparisonDetail({
  baseline,
  target,
}: {
  baseline: ScanSnapshot
  target: ScanSnapshot
}) {
  const comparison = compareSnapshots(baseline, target)
  return (
    <>
      <ComparisonSummary baseline={baseline} target={target} />
      <div className="mt-6 grid gap-px bg-border/60 sm:grid-cols-2">
        <div className="bg-background p-4">
          <p className="text-xs text-muted-foreground">Baseline score</p>
          <p className="mt-2 text-2xl tabular-nums">
            {baseline.payload.overall ?? "–"}
          </p>
        </div>
        <div className="bg-background p-4">
          <p className="text-xs text-muted-foreground">Target score</p>
          <p className="mt-2 text-2xl tabular-nums">
            {target.payload.overall ?? "–"}
            {comparison.pointsDelta == null
              ? ""
              : ` (${comparison.pointsDelta >= 0 ? "+" : ""}${comparison.pointsDelta})`}
          </p>
        </div>
      </div>
      {!comparison.pointsCompatible ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Scores are shown separately because the measured checks, coverage,
          scan mode, or analysis version changed.
        </p>
      ) : null}
      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-2xl border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-border/60 text-muted-foreground">
              <th className="py-2 pr-4 font-normal">Check</th>
              <th className="py-2 pr-4 font-normal">Before</th>
              <th className="py-2 pr-4 font-normal">After</th>
              <th className="py-2 font-normal">Outcome</th>
            </tr>
          </thead>
          <tbody>
            {comparison.signals.map((item) => (
              <tr key={item.id} className="border-b border-border/40 align-top">
                <td className="py-3 pr-4">
                  {item.baseline?.subject ?? item.target?.subject ?? item.id}
                </td>
                <td className="py-3 pr-4 text-muted-foreground">
                  {item.baseline?.finding ?? "Missing"}
                </td>
                <td className="py-3 pr-4 text-muted-foreground">
                  {item.target?.finding ?? "Missing"}
                </td>
                <td className="py-3">
                  {LABEL[item.transition]}
                  {item.measurementChanged ? " · measurement changed" : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-8">
        <h2 className="text-sm font-medium">Category scores</h2>
        <ul className="mt-3 divide-y divide-border/60 border-y border-border/60">
          {comparison.categories.map((category) => (
            <li
              key={category.key}
              className="flex items-center justify-between gap-4 py-3 text-xs"
            >
              <span>{category.name}</span>
              <span className="text-muted-foreground tabular-nums">
                {category.baselineScore ?? "–"} → {category.targetScore ?? "–"}
                {category.pointsDelta == null
                  ? ""
                  : ` (${category.pointsDelta >= 0 ? "+" : ""}${category.pointsDelta})`}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-6 grid gap-3 text-xs text-muted-foreground sm:grid-cols-2">
        <p>Baseline coverage: {JSON.stringify(baseline.payload.coverage)}</p>
        <p>Target coverage: {JSON.stringify(target.payload.coverage)}</p>
      </div>
    </>
  )
}
