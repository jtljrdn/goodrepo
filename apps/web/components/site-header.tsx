import Link from "next/link"

export function SiteHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="border-border/60 sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-12 max-w-5xl items-center gap-3 px-6">
        <Link href="/" className="flex items-center gap-2 text-sm font-medium">
          <span className="bg-foreground text-background inline-flex size-5 items-center justify-center text-[10px] leading-none font-bold">
            G
          </span>
          GoodRepo
        </Link>
        <div className="text-muted-foreground ml-auto flex items-center gap-3 text-xs">
          {children}
        </div>
      </div>
    </header>
  )
}
