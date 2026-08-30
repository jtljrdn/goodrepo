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
            <div className="bg-muted h-3 w-40 animate-pulse" />
            <div className="bg-muted h-7 w-64 animate-pulse" />
            <div className="bg-muted h-3 w-32 animate-pulse" />
          </div>
          <div className="border-border size-32 shrink-0 animate-pulse rounded-full border-4" />
        </div>
        <ul className="border-border/60 space-y-2 border-t py-8 text-xs">
          {STEPS.map((step, index) => (
            <li
              key={step}
              className="text-muted-foreground flex animate-pulse items-center gap-2"
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
