import { Suspense } from "react"
import Link from "next/link"
import { SiteHeader } from "@/components/site-header"
import { ScanForm } from "@/components/scan-form"
import { HeroBackdrop } from "@/components/hero-backdrop"
import { CopyButton } from "@/components/copy-button"
import { CATEGORIES, type CategoryKey } from "@/lib/score"
import { EXAMPLES, exampleHref } from "@/lib/examples"
import { DEEP_SCAN_ENABLED } from "@/lib/flags"
import { currentSession, GITHUB_SIGN_IN_ENABLED } from "@/lib/auth"

const INSTALL_COMMAND = "npx skills add jtljrdn/goodrepo"

const SIGNAL_COUNT = CATEGORIES.reduce((n, c) => n + c.signals.length, 0)

const CATEGORY_SAMPLES: Record<CategoryKey, string> = {
  discoverability: "Source lives under a single predictable root",
  instructions: "AGENTS.md exists",
  testability: "typecheck script defined",
  consistency: "One validation approach across routes",
  tooling: ".env.example lists required variables",
  context: "Common changes stay inside one module",
}

const TICKER: { points: string; text: string }[] = [
  { points: "+15", text: "README.md at repository root" },
  { points: "+20", text: "AGENTS.md exists" },
  { points: "+20", text: "test script defined" },
  { points: "+15", text: "typecheck script defined" },
  { points: "+15", text: "Lockfile and pinned package manager" },
  { points: "+20", text: "One validation approach across routes" },
  { points: "+15", text: "Tests sit next to the code they cover" },
  { points: "+15", text: ".env.example lists required variables" },
  { points: "+20", text: "Common changes stay inside one module" },
  { points: "+15", text: "Generated output is ignored and excluded" },
  { points: "+10", text: "Running a single test is documented" },
  { points: "+15", text: "Folders are named after domains, not types" },
]

async function SignInNudge() {
  if (!GITHUB_SIGN_IN_ENABLED || (await currentSession())) return null
  return (
    <p className="mt-6 max-w-xl font-sans text-sm leading-relaxed text-muted-foreground">
      <Link
        href="/sign-in"
        className="text-foreground underline-offset-4 hover:underline"
      >
        Sign in with GitHub
      </Link>{" "}
      to scan private repositories
      {DEEP_SCAN_ENABLED
        ? " or run a deep scan, where an AI reads the code itself"
        : ""}
      .
    </p>
  )
}

export default function Page() {
  return (
    <>
      <SiteHeader>
        <span className="hidden sm:inline">Quick scan is free</span>
      </SiteHeader>

      <main className="mx-auto max-w-5xl sm:border-x sm:border-border/60">
        <section className="relative isolate px-6 py-16 sm:py-24">
          <HeroBackdrop />
          <h1 className="max-w-3xl text-4xl leading-[1.1] font-medium tracking-tight text-balance sm:text-5xl">
            How easy is your codebase for AI agents to work in?
          </h1>
          <p className="mt-5 max-w-xl font-sans text-sm leading-relaxed text-muted-foreground">
            Paste a GitHub link. GoodRepo checks how the code is organized, what
            instructions it leaves for AI tools, and how easy it is to test,
            then gives it a score out of 100. {SIGNAL_COUNT} checks, each with
            the reason behind it.
          </p>
          <div className="mt-8 max-w-2xl">
            <ScanForm />
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs">
            <span className="mr-1 text-muted-foreground/60">or try</span>
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
          <Suspense>
            <SignInNudge />
          </Suspense>

          <div className="mt-12 max-w-2xl border border-border/60">
            <div className="flex items-baseline justify-between gap-3 border-b border-border/60 px-4 py-2.5">
              <h2 className="text-xs font-medium">
                Scan from inside your coding agent
              </h2>
            </div>
            <div className="flex items-center gap-3 bg-muted/30 px-4 py-3">
              <span
                aria-hidden
                className="text-xs text-muted-foreground/50 select-none"
              >
                $
              </span>
              <code className="min-w-0 flex-1 text-xs leading-relaxed">
                {INSTALL_COMMAND}
              </code>
              <CopyButton
                value={INSTALL_COMMAND}
                label="Copy install command"
              />
            </div>
          </div>
        </section>

        <section
          aria-hidden
          className="overflow-hidden border-t border-border/60 py-3 [&>div]:[mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]"
        >
          <div className="flex w-max animate-ticker gap-8 whitespace-nowrap motion-reduce:animate-none">
            {[0, 1].map((half) => (
              <div key={half} className="flex gap-8">
                {TICKER.map((signal) => (
                  <span
                    key={signal.text}
                    className="flex items-baseline gap-2 text-[11px] text-muted-foreground/70"
                  >
                    <span className="text-success tabular-nums">
                      {signal.points}
                    </span>
                    {signal.text}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-border/60 px-6 py-12">
          <h2 className="text-sm font-medium">What gets scored</h2>
          <ul className="mt-6 grid gap-px sm:grid-cols-2 lg:grid-cols-3">
            {CATEGORIES.map((category) => (
              <li
                key={category.key}
                className="border border-border/60 p-5 transition-colors hover:border-border"
              >
                <h3 className="text-xs font-medium">{category.name}</h3>
                <p className="mt-2 font-sans text-sm leading-relaxed text-muted-foreground">
                  {category.question}
                </p>
                <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-border/40 pt-3 text-[10px] text-muted-foreground/60">
                  <span className="text-pretty">
                    &ldquo;{CATEGORY_SAMPLES[category.key]}&rdquo;
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {category.signals.length} checks
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  )
}
