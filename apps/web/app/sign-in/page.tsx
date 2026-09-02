import { redirect } from "next/navigation"
import { SiteHeader } from "@/components/site-header"
import { AuthForm } from "@/components/auth-form"
import { currentSession, GITHUB_SIGN_IN_ENABLED } from "@/lib/auth"
import { DAILY_RUNS_PER_ACCOUNT } from "@/lib/quota"

export const metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
}

// Only ever a path on this site: an open redirect makes the domain a springboard.
function safeNext(value: string | string[] | undefined): string {
  if (typeof value !== "string") return "/"
  if (!value.startsWith("/") || value.startsWith("//")) return "/"
  return value
}

const FACTS = [
  { label: "Fast scan", value: "free, no account" },
  { label: "Deep scan", value: `${DAILY_RUNS_PER_ACCOUNT} per day` },
  { label: "Re-reading a report you ran", value: "free" },
]

export default async function SignInPage(props: PageProps<"/sign-in">) {
  const { next } = await props.searchParams
  const destination = safeNext(next)

  const session = await currentSession()
  if (session) redirect(destination)

  const forDeepScan = destination.endsWith("/deep")

  return (
    <>
      <SiteHeader account={false} />

      <main className="mx-auto max-w-5xl px-6 pb-24">
        <section className="grid gap-10 py-16 sm:grid-cols-[1fr_1fr] sm:py-24">
          <div>
            <h1 className="text-3xl leading-[1.1] font-medium tracking-tight text-balance sm:text-4xl">
              {forDeepScan
                ? "Deep scans need an account"
                : "Sign in to GoodRepo"}
            </h1>
            <p className="mt-5 max-w-md font-sans text-sm leading-relaxed text-muted-foreground">
              {forDeepScan
                ? "A deep scan clones the commit into a throwaway sandbox and pays a model to read the code behind the signals counting alone cannot settle. An account is how that stays capped instead of open to anyone with the URL."
                : "An account only gates the deep scan. Everything else on GoodRepo works signed out and will keep working that way."}
            </p>

            <dl className="mt-8 max-w-md border border-border/60">
              {FACTS.map((fact, index) => (
                <div
                  key={fact.label}
                  className={
                    index === 0
                      ? "flex items-baseline justify-between gap-4 px-4 py-2.5"
                      : "flex items-baseline justify-between gap-4 border-t border-border/40 px-4 py-2.5"
                  }
                >
                  <dt className="text-xs text-muted-foreground">
                    {fact.label}
                  </dt>
                  <dd className="text-xs tabular-nums">{fact.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="sm:pt-1.5">
            <AuthForm next={destination} github={GITHUB_SIGN_IN_ENABLED} />
          </div>
        </section>
      </main>
    </>
  )
}
