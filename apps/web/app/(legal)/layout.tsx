import { SiteHeader } from "@/components/site-header"

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <SiteHeader />

      <main className="mx-auto max-w-5xl px-6 py-16 sm:border-x sm:border-border/60">
        <article
          className={[
            "max-w-2xl text-sm leading-relaxed text-muted-foreground",
            "[&>h1]:text-2xl [&>h1]:leading-tight [&>h1]:font-medium [&>h1]:tracking-tight [&>h1]:text-balance [&>h1]:text-foreground",
            "[&>h2]:mt-12 [&>h2]:mb-3 [&>h2]:text-xs [&>h2]:font-medium [&>h2]:tracking-widest [&>h2]:uppercase [&>h2]:text-foreground",
            "[&>p]:mt-4 [&>ul]:mt-4 [&>ul]:space-y-2 [&>ul]:pl-5",
            "[&>ul>li]:list-disc [&>ul>li]:marker:text-border",
            "[&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:no-underline",
            "[&_strong]:font-medium [&_strong]:text-foreground",
          ].join(" ")}
        >
          {children}
        </article>
      </main>
    </>
  )
}
