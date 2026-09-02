import { redirect } from "next/navigation"
import { SiteHeader } from "@/components/site-header"
import { AuthForm } from "@/components/auth-form"
import { AuthBackdrop } from "@/components/auth-backdrop"
import { currentSession, GITHUB_SIGN_IN_ENABLED } from "@/lib/auth"
import { DAILY_RUNS_PER_ACCOUNT } from "@/lib/quota"

export const metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
}

function safeNext(value: string | string[] | undefined): string {
  if (typeof value !== "string") return "/"
  if (!value.startsWith("/") || value.startsWith("//")) return "/"
  return value
}

const FACTS = [
  { label: "Fast scan", value: "free, no account" },
  { label: "Deep scan", value: `${DAILY_RUNS_PER_ACCOUNT} per day` },
  { label: "Re-reading a report", value: "free" },
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

      <main className="relative mx-auto flex min-h-[calc(100dvh-3rem)] max-w-5xl items-center justify-center overflow-hidden px-6 py-16 sm:border-x sm:border-border/60">
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [mask-image:linear-gradient(to_bottom,black,transparent_75%)] bg-[size:32px_32px] opacity-40"
        />
        <AuthBackdrop />

        <div className="relative w-full max-w-sm">
          <h1 className="text-2xl leading-tight font-medium tracking-tight text-balance">
            {forDeepScan ? "Deep scans need an account" : "Sign in to GoodRepo"}
          </h1>

          <div className="mt-8 bg-background">
            <AuthForm next={destination} github={GITHUB_SIGN_IN_ENABLED} />
          </div>

          <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-muted-foreground">
            {FACTS.map((fact) => (
              <div key={fact.label} className="flex gap-1.5">
                <dt>{fact.label}</dt>
                <dd className="text-foreground tabular-nums">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </main>
    </>
  )
}
