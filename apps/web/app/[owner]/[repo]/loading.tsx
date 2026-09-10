import { SiteHeader } from "@/components/site-header"
import { GridLoader } from "@/components/grid-loader"

const STEPS = [
  "Listing the files",
  "Reading the instructions",
  "Checking the build tools",
  "Finding the tests",
  "Reading the folder layout",
  "Adding up the score",
]

export default function Loading() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl px-6">
        <div className="flex flex-col gap-8 py-10 sm:flex-row sm:items-center">
          <div className="flex-1 space-y-3">
            <div className="h-3 w-40 bg-muted motion-safe:animate-pulse" />
            <div className="h-7 w-64 bg-muted motion-safe:animate-pulse" />
            <div className="h-3 w-32 bg-muted motion-safe:animate-pulse" />
          </div>
          <div
            role="status"
            className="flex size-32 shrink-0 items-center justify-center text-success"
          >
            <GridLoader className="text-5xl" />
            <span className="sr-only">Scanning repository</span>
          </div>
        </div>
        <ul className="space-y-2 border-t border-border/60 py-8 text-xs">
          {STEPS.map((step) => (
            <li
              key={step}
              className="flex items-center gap-2 text-muted-foreground"
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
