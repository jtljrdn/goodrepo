import { SiteHeader } from "@/components/site-header"

const STEPS = [
  "Fetching repository tree",
  "Reading agent instructions",
  "Detecting build tooling",
  "Locating tests",
  "Sampling architecture",
  "Scoring signals",
]

export default function Loading() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6">
        <div className="flex flex-col gap-8 py-10 sm:flex-row sm:items-center">
          <div className="flex-1 space-y-3">
            <div className="h-3 w-40 animate-pulse bg-muted" />
            <div className="h-7 w-64 animate-pulse bg-muted" />
            <div className="h-3 w-32 animate-pulse bg-muted" />
          </div>
          <div className="size-32 shrink-0 animate-pulse rounded-full border-4 border-border" />
        </div>
        <ul className="space-y-2 border-t border-border/60 py-8 text-xs">
          {STEPS.map((step, index) => (
            <li
              key={step}
              className="flex animate-pulse items-center gap-2 text-muted-foreground"
              style={{ animationDelay: `${index * 120}ms` }}
            >
              <span className="text-success">▸</span>
              {step}
            </li>
          ))}
        </ul>
      </main>
    </>
  )
}
