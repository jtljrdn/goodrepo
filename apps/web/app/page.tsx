import Link from "next/link"
import { redirect } from "next/navigation"
import { SiteHeader } from "@/components/site-header"
import { ScanForm } from "@/components/scan-form"
import { currentSession, GITHUB_SIGN_IN_ENABLED } from "@/lib/auth"
import { EXAMPLES, exampleHref } from "@/lib/examples"
import { DEEP_SCAN_ENABLED } from "@/lib/flags"
import { recentRepos, usageFor, type ScanKind } from "@/lib/history"
import { DAILY_RUNS_PER_ACCOUNT, deepRunsToday } from "@/lib/quota"
import { band } from "@/lib/score"
import { relativeDays } from "@/lib/when"

export const metadata = {
  title: "Your scans",
  robots: { index: false, follow: false },
}

const BAND_TEXT = {
  good: "text-success",
  fair: "text-warn",
  poor: "text-destructive",
} as const

const KIND_LABEL: Record<ScanKind, string> = {
  fast: "Quick scan",
  deep: "Deep scan",
  private: "Private",
}

const REPORT_PATH: Record<ScanKind, string> = {
  fast: "",
  deep: "/deep",
  private: "/private",
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="border border-border/60 p-5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-3 text-2xl leading-none font-medium tabular-nums">
        {value}
      </p>
      <p className="mt-3 border-t border-border/40 pt-3 text-[10px] text-muted-foreground/60">
        {hint}
      </p>
    </div>
  )
}

export default async function DashboardPage() {
  if (!GITHUB_SIGN_IN_ENABLED) redirect("/home")

  const session = await currentSession()
  if (!session) redirect("/home")

  const userId = session.user.id
  const [repos, usage, deepUsed] = await Promise.all([
    recentRepos(userId),
    usageFor(userId),
    DEEP_SCAN_ENABLED ? deepRunsToday(userId) : Promise.resolve(null),
  ])

  const name = session.user.name || (session.user.email.split("@")[0] ?? "")

  return (
    <>
      <SiteHeader>
        <Link
          href="/home"
          className="hidden text-xs transition-colors hover:text-foreground sm:inline"
        >
          What GoodRepo checks
        </Link>
      </SiteHeader>

      <main className="mx-auto max-w-5xl px-6 pb-24 sm:border-x sm:border-border/60">
        <section className="py-12">
          <h1 className="text-2xl leading-tight font-medium tracking-tight">
            {name ? `Welcome back, ${name}` : "Your scans"}
          </h1>
          <p className="mt-3 max-w-xl font-sans text-sm leading-relaxed text-muted-foreground">
            Every report you open is kept here, so you can come back to a
            repository without pasting its link again.
          </p>
          <div className="mt-8 max-w-2xl">
            <ScanForm hint={null} />
          </div>
        </section>

        <section className="border-t border-border/60 py-10">
          <h2 className="mb-6 text-sm font-medium tracking-tight">Usage</h2>
          <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Repositories"
              value={String(usage.repos)}
              hint="Distinct repositories you have scanned"
            />
            <Stat
              label="Scans"
              value={String(usage.scans)}
              hint="One per repository, commit and scan kind"
            />
            <Stat
              label="Average score"
              value={usage.averageScore === null ? "–" : String(usage.averageScore)}
              hint="Across every repository you have scanned"
            />
            <Stat
              label="Deep scans"
              value={
                deepUsed === null
                  ? "Off"
                  : `${Math.max(0, DAILY_RUNS_PER_ACCOUNT - deepUsed)}`
              }
              hint={
                deepUsed === null
                  ? "Deep scans are not switched on yet"
                  : `Left today, out of ${DAILY_RUNS_PER_ACCOUNT}. The count is a rolling 24 hours.`
              }
            />
          </div>
        </section>

        <section className="border-t border-border/60 py-10">
          <div className="mb-6 flex items-baseline justify-between gap-4">
            <h2 className="text-sm font-medium tracking-tight">
              Your repositories
            </h2>
            {repos.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                Newest scan first
              </p>
            ) : null}
          </div>

          {repos.length === 0 ? (
            <div className="border border-border/60 p-8">
              <p className="text-sm font-medium">Nothing scanned yet</p>
              <p className="mt-3 max-w-prose font-sans text-sm leading-relaxed text-muted-foreground">
                Scan a repository above and it will show up here. Or open one of
                these to see what a report looks like.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-2 text-xs">
                {EXAMPLES.map((example) => (
                  <Link
                    key={example.slug}
                    href={exampleHref(example)}
                    className="border border-border/60 px-2 py-1 text-muted-foreground transition-colors hover:border-border hover:text-foreground"
                  >
                    {example.slug}
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <ul className="border-t border-border/60">
              {repos.map((entry) => {
                const href = `/${entry.owner}/${entry.repo}${REPORT_PATH[entry.kind]}?sha=${entry.commitSha}`
                return (
                  <li
                    key={`${entry.owner}/${entry.repo}`}
                    className="border-b border-border/60"
                  >
                    <Link
                      href={href}
                      prefetch={false}
                      className="flex items-center gap-4 px-1 py-4 transition-colors hover:bg-muted/40"
                    >
                      <span
                        className={`w-10 shrink-0 text-right text-lg leading-none font-medium tabular-nums ${
                          entry.score === null
                            ? "text-muted-foreground/60"
                            : BAND_TEXT[band(entry.score)]
                        }`}
                      >
                        {entry.score ?? "–"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">
                          {entry.owner}/{entry.repo}
                        </span>
                        <span className="mt-1 block text-[11px] text-muted-foreground/70">
                          {KIND_LABEL[entry.kind]} · @{entry.commitSha} ·{" "}
                          {relativeDays(entry.scannedAt)}
                        </span>
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </main>
    </>
  )
}
