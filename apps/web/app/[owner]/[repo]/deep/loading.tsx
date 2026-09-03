import { SiteHeader } from "@/components/site-header"
import { Elapsed } from "@/components/elapsed"

const STEPS = [
  "Cloning this commit into a throwaway sandbox",
  "Listing the tracked files",
  "Reading the code behind the open signals",
  "Folding the answers back into the score",
]

export default function Loading() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6">
        <div className="flex flex-col gap-8 py-10 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Deep scan</p>
            <h1 className="mt-3 text-2xl font-medium tracking-tight">
              Reading the source
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Usually about a minute. Leaving this page cancels nothing, but you
              will have to come back to see the result.
            </p>
          </div>
          <div className="flex size-32 shrink-0 animate-pulse items-center justify-center rounded-full border-4 border-border text-xs text-muted-foreground">
            <Elapsed />
          </div>
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
        <p className="border-t border-border/60 py-4 text-xs text-muted-foreground">
          The fast scan is already done. Only the handful of signals that need
          code to be read are being answered here, and the answer is cached
          against this commit.
        </p>
      </main>
    </>
  )
}
