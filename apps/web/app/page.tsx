import Link from "next/link"
import { SiteHeader } from "@/components/site-header"
import { ScanForm } from "@/components/scan-form"
import { CATEGORIES } from "@/lib/score"

const EXAMPLES = [
  "vercel/next.js",
  "shadcn-ui/ui",
  "drizzle-team/drizzle-orm",
  "honojs/hono",
]

const LEVELS = [
  {
    name: "Fast scan",
    cost: "0 tokens",
    body: "Deterministic. Reads the file tree, package manifest, configs, and instruction files. This is what you get from pasting a URL.",
  },
  {
    name: "Deep scan",
    cost: "~10k tokens",
    body: "Adds targeted model calls against the repository profile and a few representative files. Opt in with your own API key.",
  },
  {
    name: "Benchmark",
    cost: "your compute",
    body: "Runs real coding agents against tasks generated from the repository, then measures success, cost, and scope violations.",
  },
]

export default function Page() {
  return (
    <>
      <SiteHeader>
        <span className="hidden sm:inline">Fast scan is free</span>
      </SiteHeader>

      <main className="mx-auto max-w-5xl px-6 pb-24">
        <section className="py-20 sm:py-28">
          <h1 className="max-w-2xl text-3xl leading-tight font-medium tracking-tight text-balance sm:text-4xl">
            How easy is your codebase for AI agents to work in?
          </h1>
          <p className="text-muted-foreground mt-5 max-w-xl font-sans text-base leading-relaxed">
            Paste a public repository. rigor reads its structure, instructions, and
            tooling, then returns an agent readiness score with the evidence behind
            every point.
          </p>
          <div className="mt-8 max-w-xl">
            <ScanForm />
          </div>
          <div className="text-muted-foreground mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
            <span>Try</span>
            {EXAMPLES.map((example) => (
              <Link
                key={example}
                href={`/github/${example}`}
                className="hover:text-foreground underline-offset-4 hover:underline"
              >
                {example}
              </Link>
            ))}
          </div>
        </section>

        <section className="border-border/60 border-t py-12">
          <h2 className="text-sm font-medium">What gets scored</h2>
          <ul className="mt-6 grid gap-px sm:grid-cols-2 lg:grid-cols-3">
            {CATEGORIES.map((category) => (
              <li key={category.key} className="border-border/60 border p-5">
                <h3 className="text-xs font-medium">{category.name}</h3>
                <p className="text-muted-foreground mt-2 font-sans text-sm leading-relaxed">
                  {category.question}
                </p>
                <p className="text-muted-foreground/60 mt-3 text-[10px]">
                  {category.signals.length} signals
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-border/60 border-t py-12">
          <h2 className="text-sm font-medium">Parse everything, sample selectively</h2>
          <p className="text-muted-foreground mt-3 max-w-2xl font-sans text-sm leading-relaxed">
            The score comes from measurable signals, not from asking a model for a
            number. Models are used where judgement actually helps: comparing sampled
            files, spotting patterns, and writing the recommendations.
          </p>
          <ul className="mt-6 grid gap-px sm:grid-cols-3">
            {LEVELS.map((level) => (
              <li key={level.name} className="border-border/60 border p-5">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-xs font-medium">{level.name}</h3>
                  <span className="text-muted-foreground/60 text-[10px]">
                    {level.cost}
                  </span>
                </div>
                <p className="text-muted-foreground mt-2 font-sans text-sm leading-relaxed">
                  {level.body}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-border/60 border-t py-12">
          <h2 className="text-sm font-medium">Or run it locally</h2>
          <pre className="border-border/60 bg-muted/40 mt-4 border p-4 text-xs">
            <span className="text-muted-foreground">$ </span>npx rigor
          </pre>
          <p className="text-muted-foreground mt-3 max-w-2xl font-sans text-sm leading-relaxed">
            Builds the profile on your machine and uploads only that. Private
            repositories never leave your laptop.
          </p>
        </section>
      </main>
    </>
  )
}
