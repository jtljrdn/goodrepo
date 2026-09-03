import { SiteHeader } from "@/components/site-header"
import { Elapsed } from "@/components/elapsed"

const STEPS = [
  "Copying this commit into a temporary workspace",
  "Listing the files",
  "Reading the code behind the unanswered checks",
  "Adding the answers into the score",
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
              Reading the code
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
          The quick scan is already done. Only the few checks that need the
          code to be read are answered here, and the result is saved for this
          commit.
        </p>
      </main>
    </>
  )
}
