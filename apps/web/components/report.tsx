import type { Measurement, RepoProfile } from "@/lib/profile"
import type { ScoredCategory } from "@/lib/score"
import { band, formatBytes } from "@/lib/score"
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
  poor: "High friction",
} as const

const IMPACT_STYLE = {
  High: "border-destructive/40 text-destructive",
  Medium: "border-warn/40 text-warn",
  Low: "border-border text-muted-foreground",
} as const

export function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section className="border-border/60 border-t py-10">
      <div className="mb-6 flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-medium tracking-tight">{title}</h2>
        {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
      </div>
      {children}
    </section>
  )
}

// A share is a ratio; everything else is a plain count. Both print alongside the
// cutoff so a reader can argue with the threshold instead of guessing at it.
//
// Shares keep one decimal when they need it: rounding 0.7996 to "80%" next to a
// failed signal that "passes at 80%" reads as a bug rather than a near miss.
function percent(value: number): string {
  return `${Number((value * 100).toFixed(1))}%`
}

function formatMeasurement({ value, threshold, unit }: Measurement): string {
  if (unit === "share") return `${percent(value)} · passes at ${percent(threshold)}`
  return `${value.toLocaleString()} ${unit} · threshold ${threshold.toLocaleString()}`
}

const SIGNAL_MARK = { pass: "✓", fail: "⚠", "not-measured": "–" } as const
const SIGNAL_TONE = {
  pass: "text-success",
  fail: "text-warn",
  "not-measured": "text-muted-foreground/60",
} as const

export function ScoreDial({ score }: { score: number | null }) {
  const radius = 44
  const circumference = 2 * Math.PI * radius

  if (score === null) {
    return (
      <div className="border-border/60 flex size-32 shrink-0 items-center justify-center border">
        <span className="text-muted-foreground text-xs">not scored</span>
      </div>
    )
  }

  const tone = band(score)

  return (
    <div className="relative size-32 shrink-0">
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
          fill="none"
          strokeWidth="4"
          strokeDasharray={`${(score / 100) * circumference} ${circumference}`}
          className={cn("stroke-current", BAND_TEXT[tone])}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl leading-none font-medium tabular-nums">{score}</span>
        <span className="text-muted-foreground mt-1 text-[10px]">/ 100</span>
      </div>
    </div>
  )
}

export function ReportHeadline({
  profile,
  overall,
}: {
  profile: RepoProfile
  overall: number | null
}) {
  const tone = overall === null ? null : band(overall)
  const meta = [
    profile.framework === "unknown" ? null : profile.framework,
    profile.language,
    `${profile.files.toLocaleString()} files`,
    formatBytes(profile.totalBytes),
    profile.packageManager ?? "no package manager",
  ].filter((item): item is string => item !== null)

  return (
    <div className="flex flex-col gap-8 py-10 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground text-xs">
          {profile.owner}/<span className="text-foreground">{profile.repo}</span>
        </p>
        <h1 className="mt-3 text-2xl font-medium tracking-tight">Agent Readiness</h1>
        <p className={cn("mt-1 text-sm", tone ? BAND_TEXT[tone] : "text-muted-foreground")}>
          {tone ? BAND_LABEL[tone] : "No categories could be scored"}
        </p>
        <ul className="text-muted-foreground mt-5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {meta.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <ScoreDial score={overall} />
    </div>
  )
}

export function CategorySummary({ categories }: { categories: ScoredCategory[] }) {
  return (
    <ul className="divide-border/60 divide-y border-y">
      {categories.map((category) => (
        <li key={category.key}>
          <a
            href={`#${category.key}`}
            className="hover:bg-muted/50 flex items-center gap-4 px-1 py-3 transition-colors"
          >
            <span className="w-40 shrink-0 text-xs">{category.name}</span>
            <span className="bg-border/60 relative h-1 flex-1">
              {category.score === null ? null : (
                <span
                  className={cn("absolute inset-y-0 left-0", BAND_BG[band(category.score)])}
                  style={{ width: `${category.score}%` }}
                />
              )}
            </span>
            <span
              className={cn(
                "w-8 shrink-0 text-right text-xs tabular-nums",
                category.score === null ? "text-muted-foreground/60" : BAND_TEXT[band(category.score)]
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
      className="border-border/60 group scroll-mt-16 border-b last:border-b-0"
    >
      <summary className="hover:bg-muted/50 flex cursor-pointer list-none items-center gap-4 py-3 transition-colors">
        <span className="text-muted-foreground w-4 text-xs group-open:rotate-90">›</span>
        <span className="flex-1 text-xs">{category.name}</span>
        <span className="text-muted-foreground hidden text-xs sm:inline">
          {category.earnedPoints} / {category.totalPoints} pts
        </span>
        <span
          className={cn(
            "w-8 text-right text-xs tabular-nums",
            category.score === null ? "text-muted-foreground/60" : BAND_TEXT[band(category.score)]
          )}
        >
          {category.score ?? "n/a"}
        </span>
      </summary>
      <div className="pb-6 pl-8">
        <p className="text-muted-foreground mb-4 font-sans text-xs">{category.question}</p>
        <ul className="space-y-1.5">
          {category.signals.map((signal) => (
            <li key={signal.id} className="flex items-start gap-2.5 text-xs">
              <span className={cn("mt-px w-3 shrink-0", SIGNAL_TONE[signal.status])}>
                {SIGNAL_MARK[signal.status]}
              </span>
              <span className={cn("flex-1", signal.status !== "pass" && "text-muted-foreground")}>
                {signal.text}
                {signal.measurement && signal.status !== "not-measured" ? (
                  <span className="text-muted-foreground/60 ml-2 tabular-nums">
                    {formatMeasurement(signal.measurement)}
                  </span>
                ) : null}
              </span>
              <span className="text-muted-foreground/60 shrink-0 tabular-nums">
                {signal.status === "pass"
                  ? `+${signal.points}`
                  : signal.status === "fail"
                    ? `0 / ${signal.points}`
                    : "not scored"}
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
    <li className="border-border/60 border-b py-6 last:border-b-0">
      <div className="flex items-start gap-4">
        <span className="text-muted-foreground/60 w-6 shrink-0 text-xs tabular-nums">
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
            <span className="text-muted-foreground/60 text-[10px]">
              {recommendation.category}
            </span>
            {recommendation.source === "deep" ? (
              <span className="text-muted-foreground/60 border-border border px-1.5 py-px text-[10px]">
                deep scan
              </span>
            ) : null}
          </div>
          <p className="text-muted-foreground mt-3 max-w-2xl font-sans text-sm leading-relaxed">
            {recommendation.evidence(profile)}
          </p>
          <div className="bg-muted/40 border-border/60 mt-4 border p-4">
            <p className="text-xs">{recommendation.fix}</p>
            {recommendation.bullets.length > 0 ? (
              <ul className="text-muted-foreground mt-2 space-y-1 text-xs">
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

export function ProfileBlock({ profile }: { profile: RepoProfile }) {
  const compact = {
    framework: profile.framework,
    files: profile.files,
    maxDirectoryDepth: profile.maxDirectoryDepth,
    medianFileBytes: profile.medianFileBytes,
    packageManager: profile.packageManager,
    scripts: profile.scripts,
    testFramework: profile.testFramework,
    testFiles: profile.testFiles,
    apiRoutes: profile.apiRoutes,
    validationPatterns: profile.validationPatterns,
    docs: profile.docs,
  }

  return (
    <details className="border-border/60 group border-t">
      <summary className="hover:bg-muted/50 flex cursor-pointer list-none items-center gap-4 py-3 transition-colors">
        <span className="text-muted-foreground w-4 text-xs group-open:rotate-90">›</span>
        <span className="text-muted-foreground flex-1 font-sans text-xs">
          The compact structure a deep scan would send to the model
        </span>
      </summary>
      <pre className="border-border/60 bg-muted/40 mb-2 overflow-x-auto border p-4 text-[11px] leading-relaxed">
        {JSON.stringify(compact, null, 2)}
      </pre>
    </details>
  )
}
