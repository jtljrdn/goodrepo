import type {
  Measurement,
  RepoProfile,
  SignalId,
  SignalVerdict,
} from "@/lib/profile"
import type { ScoredCategory, SignalStatus } from "@/lib/score"
import { band, formatBytes, signalSubject } from "@/lib/score"
import type { Recommendation } from "@/lib/recommendations"
import { cn } from "@workspace/ui/lib/utils"

const BAND_TEXT = {
  good: "text-success",
  fair: "text-warn",
  poor: "text-destructive",
} as const

const BAND_BG = {
  good: "bg-success",
  fair: "bg-warn",
  poor: "bg-destructive",
} as const

const BAND_LABEL = {
  good: "Agent ready",
  fair: "Needs work",
  poor: "Hard for agents",
} as const

const IMPACT_STYLE = {
  High: "border-destructive/40 text-destructive",
  Medium: "border-warn/40 text-warn",
  Low: "border-border text-muted-foreground",
} as const

export function Section({
  title,
  hint,
  action,
  children,
}: {
  title: string
  hint?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="border-t border-border/60 py-10">
      <div className="mb-6 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <h2 className="text-sm font-medium tracking-tight">{title}</h2>
        {action ??
          (hint ? (
            <p className="text-xs text-muted-foreground">{hint}</p>
          ) : null)}
      </div>
      {children}
    </section>
  )
}

function percent(value: number): string {
  return `${Number((value * 100).toFixed(1))}%`
}

function formatMeasurement({
  value,
  threshold,
  unit,
  direction,
}: Measurement): string {
  const show = (n: number) =>
    unit === "share" ? percent(n) : `${n.toLocaleString()} ${unit}`
  const rule =
    direction === "atLeast"
      ? `needs ${show(threshold)} or more`
      : direction === "atMost"
        ? `limit ${show(threshold)}`
        : `must stay under ${show(threshold)}`
  return `${show(value)} · ${rule}`
}

const SIGNAL_MARK = { pass: "✓", fail: "⚠", "not-measured": "–" } as const
const SIGNAL_TONE = {
  pass: "text-success",
  fail: "text-warn",
  "not-measured": "text-muted-foreground/60",
} as const

export function ScoreDial({
  score,
  className,
}: {
  score: number | null
  className?: string
}) {
  const radius = 44

  if (score === null) {
    return (
      <div
        className={cn(
          "flex size-32 shrink-0 items-center justify-center border border-border/60",
          className
        )}
      >
        <span className="text-xs text-muted-foreground">not scored</span>
      </div>
    )
  }

  const tone = band(score)

  return (
    <div className={cn("relative size-32 shrink-0", className)}>
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          strokeWidth="4"
          className="stroke-border"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          pathLength="100"
          fill="none"
          strokeWidth="4"
          strokeDasharray="100"
          strokeDashoffset={100 - score}
          className={cn("score-dial-meter stroke-current", BAND_TEXT[tone])}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl leading-none font-medium tabular-nums">
          {score}
        </span>
        <span className="mt-1 text-[10px] text-muted-foreground">/ 100</span>
      </div>
    </div>
  )
}

export function ReportHeadline({
  profile,
  overall,
  actions,
}: {
  profile: RepoProfile
  overall: number | null
  actions?: React.ReactNode
}) {
  const tone = overall === null ? null : band(overall)
  const meta = [
    profile.framework === "unknown" ? null : profile.framework,
    profile.language,
    `${profile.files.toLocaleString()} files`,
    formatBytes(profile.totalBytes),
    profile.packageManager ?? "no lockfile",
  ].filter((item): item is string => item !== null)

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-6 py-8 sm:gap-x-8 sm:py-10">
      <div className="min-w-0">
        <h1 className="text-xl font-medium tracking-tight sm:text-3xl">
          Agent Readiness
        </h1>
        <p className="mt-2 text-sm break-all text-muted-foreground">
          {profile.owner}/
          <span className="text-foreground">{profile.repo}</span>
        </p>
        <p
          className={cn(
            "mt-3 text-sm",
            tone ? BAND_TEXT[tone] : "text-muted-foreground"
          )}
        >
          {tone ? BAND_LABEL[tone] : "Nothing could be scored"}
        </p>
      </div>
      <ScoreDial score={overall} className="size-24 sm:row-span-3 sm:size-32" />
      <ul className="col-span-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground sm:col-span-1">
        {meta.map((item) => (
          <li key={item} className="break-all">
            {item}
          </li>
        ))}
      </ul>
      {actions ? <div className="col-span-2 min-w-0">{actions}</div> : null}
    </div>
  )
}

export function CategorySummary({
  categories,
}: {
  categories: ScoredCategory[]
}) {
  return (
    <ul className="divide-y divide-border/60 border-y">
      {categories.map((category) => (
        <li key={category.key}>
          <a
            href={`#${category.key}`}
            className="flex items-center gap-4 px-1 py-3 transition-colors hover:bg-muted/50"
          >
            <span className="w-40 shrink-0 text-xs">{category.name}</span>
            <span className="relative h-1 flex-1 bg-border/60">
              {category.score === null ? null : (
                <span
                  className={cn(
                    "absolute inset-y-0 left-0",
                    BAND_BG[band(category.score)]
                  )}
                  style={{ width: `${category.score}%` }}
                />
              )}
            </span>
            <span
              className={cn(
                "w-8 shrink-0 text-right text-xs tabular-nums",
                category.score === null
                  ? "text-muted-foreground/60"
                  : BAND_TEXT[band(category.score)]
              )}
            >
              {category.score ?? "n/a"}
            </span>
          </a>
        </li>
      ))}
    </ul>
  )
}

export function CategoryDetail({ category }: { category: ScoredCategory }) {
  return (
    <details
      id={category.key}
      className="group scroll-mt-16 border-b border-border/60 last:border-b-0"
    >
      <summary className="flex cursor-pointer list-none items-center gap-4 py-3 transition-colors hover:bg-muted/50">
        <span className="w-4 text-xs text-muted-foreground group-open:rotate-90">
          ›
        </span>
        <span className="flex-1 text-xs">{category.name}</span>
        <span className="hidden text-xs text-muted-foreground sm:inline">
          {category.earnedPoints} / {category.totalPoints} points
        </span>
        <span
          className={cn(
            "w-8 text-right text-xs tabular-nums",
            category.score === null
              ? "text-muted-foreground/60"
              : BAND_TEXT[band(category.score)]
          )}
        >
          {category.score ?? "n/a"}
        </span>
      </summary>
      <div className="pb-6 pl-8">
        <ul className="space-y-1.5">
          {category.signals.map((signal) => (
            <li key={signal.id} className="flex items-start gap-2.5 text-xs">
              <span
                className={cn("mt-px w-3 shrink-0", SIGNAL_TONE[signal.status])}
              >
                {SIGNAL_MARK[signal.status]}
              </span>
              <span
                className={cn(
                  "flex-1",
                  signal.status !== "pass" && "text-muted-foreground"
                )}
              >
                {signal.text}
                {signal.measurement && signal.status !== "not-measured" ? (
                  <span className="ml-2 text-muted-foreground/60 tabular-nums">
                    {formatMeasurement(signal.measurement)}
                  </span>
                ) : null}
              </span>
              <span className="shrink-0 text-muted-foreground/60 tabular-nums">
                {signal.status === "pass"
                  ? `+${signal.points}`
                  : signal.status === "fail"
                    ? `0 / ${signal.points}`
                    : "skipped"}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </details>
  )
}

export function RecommendationItem({
  index,
  recommendation,
  profile,
}: {
  index: number
  recommendation: Recommendation
  profile: RepoProfile
}) {
  return (
    <li className="border-b border-border/60 py-6 last:border-b-0">
      <div className="flex items-start gap-4">
        <span className="w-6 shrink-0 text-xs text-muted-foreground/60 tabular-nums">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-medium">{recommendation.title}</h3>
            <span
              className={cn(
                "border px-1.5 py-px text-[10px]",
                IMPACT_STYLE[recommendation.impact]
              )}
            >
              {recommendation.impact} impact
            </span>
            <span className="text-[10px] text-muted-foreground/60">
              {recommendation.category}
            </span>
          </div>
          <p className="mt-3 max-w-2xl font-sans text-sm leading-relaxed text-muted-foreground">
            {recommendation.evidence(profile)}
          </p>
          <div className="mt-4 border border-border/60 bg-muted/40 p-4">
            <p className="text-xs">{recommendation.fix}</p>
            {recommendation.bullets.length > 0 ? (
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {recommendation.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-2">
                    <span className="text-muted-foreground/50">—</span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  )
}

const REACH_LABEL = {
  most: "most of the relevant code",
  some: "some of the relevant code",
  few: "a few places",
} as const

function blobUrl(profile: RepoProfile, path: string): string {
  return `https://github.com/${profile.owner}/${profile.repo}/blob/${profile.commitSha}/${path}`
}

export function DeepVerdicts({
  verdicts,
  profile,
}: {
  verdicts: SignalVerdict[]
  profile: RepoProfile
}) {
  return (
    <ul className="border-t border-border/60">
      {verdicts.map((verdict) => {
        const value = profile.has[verdict.signal as SignalId]
        const status: SignalStatus =
          value === null || value === undefined
            ? "not-measured"
            : value
              ? "pass"
              : "fail"

        return (
          <li
            key={verdict.signal}
            className="flex items-start gap-2.5 border-b border-border/60 py-5 last:border-b-0"
          >
            <span
              className={cn("mt-0.5 w-3 shrink-0 text-xs", SIGNAL_TONE[status])}
            >
              {SIGNAL_MARK[status]}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <h3 className="text-sm font-medium">
                  {signalSubject(verdict.signal as SignalId)}
                </h3>
                <span className="text-[10px] text-muted-foreground/60">
                  {verdict.applicable
                    ? verdict.patterns.length === 1
                      ? "done one way"
                      : `done ${verdict.patterns.length} different ways`
                    : "nothing like this in the repository"}
                </span>
              </div>
              <p className="mt-2 max-w-2xl font-sans text-sm leading-relaxed text-muted-foreground">
                {verdict.reason}
              </p>
              {verdict.patterns.length > 0 ? (
                <ul className="mt-3 divide-y divide-border/60 border border-border/60 bg-muted/40">
                  {verdict.patterns.map((pattern) => (
                    <li
                      key={`${pattern.pattern}:${pattern.path}`}
                      className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2 text-xs"
                    >
                      <span>{pattern.pattern}</span>
                      <span className="text-muted-foreground/60">
                        {REACH_LABEL[pattern.reach]}
                      </span>
                      <a
                        href={blobUrl(profile, pattern.path)}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-auto max-w-full truncate text-[11px] text-muted-foreground underline-offset-2 hover:underline"
                      >
                        {pattern.path}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
