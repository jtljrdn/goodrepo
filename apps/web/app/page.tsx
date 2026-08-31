import Link from "next/link"
import { SiteHeader } from "@/components/site-header"
import { ScanForm } from "@/components/scan-form"
import { CATEGORIES, type CategoryKey } from "@/lib/score"
import { EXAMPLES } from "@/lib/examples"

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

const PROFILE_EXAMPLE = `{
  "framework": "nextjs",
  "files": 842,
  "maxDirectoryDepth": 7,
  "hasAgentsMd": true,
  "hasClaudeMd": false,
  "scripts": {
    "test": "vitest",
    "lint": "eslint",
    "typecheck": "tsc --noEmit"
  },
  "testFramework": "vitest",
  "apiRoutes": 18,
  "validationPatterns": ["zod", "manual", "zod"],
  "docs": { "readmeWords": 1820, "agentsMdWords": 640 }
}`

const LEVELS = [
  {
    name: "Fast scan",
    cost: "0 tokens",
    available: true,
    body: "Deterministic. Reads the file tree, package manifest, configs, and instruction files. This is what you get from pasting a URL. Free for public repositories.",
  },
  {
    name: "Deep scan",
    cost: "~10k tokens",
    available: false,
    body: "Adds targeted LLM calls against the repository profile and a few representative files. BYOK.",
  },
  {
    name: "Benchmark",
    cost: "your compute",
    available: false,
    body: "Runs real coding agents against tasks generated from the repository, then measures success, cost, and scope violations. Use whatever agent you like.",
  },
]

export default function Page() {
  return (
    <>
      <SiteHeader>
        <span className="hidden sm:inline">Fast scan is free</span>
      </SiteHeader>

      <main className="mx-auto max-w-5xl px-6 pb-24">
        <section className="py-16 sm:py-24">
          <h1 className="max-w-3xl text-4xl leading-[1.1] font-medium tracking-tight text-balance sm:text-5xl">
            How easy is your codebase for AI agents to work in?
          </h1>
          <p className="text-muted-foreground mt-5 max-w-xl font-sans text-sm leading-relaxed">
            Paste a repository. GoodRepo reads its structure, instructions, and
            tooling, then scores agent readiness out of 100: {SIGNAL_COUNT}{" "}
            measurable signals, with the evidence behind every point.
          </p>
          <div className="mt-8 max-w-2xl">
            <ScanForm />
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground/60 mr-1">or try</span>
            {EXAMPLES.map((example) => (
              <Link
                key={example.slug}
                href={`/${example.slug}`}
                className="border-border/60 text-muted-foreground hover:text-foreground hover:border-border border px-2 py-1 transition-colors"
              >
                {example.slug}
              </Link>
            ))}
          </div>
        </section>

        <section
          aria-hidden
          className="border-border/60 overflow-hidden border-t py-3 [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]"
        >
          <div className="animate-ticker flex w-max gap-8 whitespace-nowrap motion-reduce:animate-none">
            {[0, 1].map((half) => (
              <div key={half} className="flex gap-8">
                {TICKER.map((signal) => (
                  <span
                    key={signal.text}
                    className="text-muted-foreground/70 flex items-baseline gap-2 text-[11px]"
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

        <section className="border-border/60 border-t py-12">
          <h2 className="text-sm font-medium">What gets scored</h2>
          <ul className="mt-6 grid gap-px sm:grid-cols-2 lg:grid-cols-3">
            {CATEGORIES.map((category) => (
              <li
                key={category.key}
                className="border-border/60 hover:border-border border p-5 transition-colors"
              >
                <h3 className="text-xs font-medium">{category.name}</h3>
                <p className="text-muted-foreground mt-2 font-sans text-sm leading-relaxed">
                  {category.question}
                </p>
                <div className="border-border/40 text-muted-foreground/60 mt-4 flex items-baseline justify-between gap-3 border-t pt-3 text-[10px]">
                  <span className="truncate">
                    &ldquo;{CATEGORY_SAMPLES[category.key]}&rdquo;
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {category.signals.length} signals
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-border/60 grid border-t py-12 sm:grid-cols-[1fr_1.1fr] sm:gap-10">
          <div>
            <h2 className="text-sm font-medium">What a model actually sees</h2>
            <p className="text-muted-foreground mt-3 max-w-md font-sans text-sm leading-relaxed">
              A fast scan compresses the whole repository into a profile like
              this one. If a deep scan runs, this profile, not your source tree,
              is the main input to every model call.
            </p>
            <p className="text-muted-foreground/60 mt-3 font-sans text-xs">
              Illustrative example, shortened.
            </p>
          </div>
          <pre className="border-border/60 bg-muted/40 mt-6 overflow-x-auto border p-4 text-xs leading-relaxed sm:mt-0">
            {PROFILE_EXAMPLE}
          </pre>
        </section>

        <section className="border-border/60 border-t py-12">
          <h2 className="text-sm font-medium">
            Parse everything, sample selectively
          </h2>
          <p className="text-muted-foreground mt-3 max-w-2xl font-sans text-sm leading-relaxed">
            The score comes from measurable signals, not from asking a model for
            a number. Models are used where judgement actually helps: comparing
            sampled files, spotting patterns, and writing the recommendations.
          </p>
          <ul className="mt-6 grid gap-px sm:grid-cols-3">
            {LEVELS.map((level) => (
              <li key={level.name} className="border-border/60 border p-5">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-xs font-medium">{level.name}</h3>
                  <span className="text-muted-foreground/60 text-[10px] tabular-nums">
                    {level.cost}
                  </span>
                </div>
                <p className="text-muted-foreground mt-2 font-sans text-sm leading-relaxed">
                  {level.body}
                </p>
                <p className="text-muted-foreground/60 mt-4 flex items-center gap-1.5 text-[10px]">
                  <span
                    className={
                      level.available
                        ? "bg-success size-1.5"
                        : "border-border size-1.5 border"
                    }
                  />
                  {level.available ? "Available now" : "Planned"}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  )
}
