import { Suspense } from "react"
import Link from "next/link"
import { AccountNav, AccountNavFallback } from "@/components/account-nav"

export function SiteHeader({
  children,
  account = true,
}: {
  children?: React.ReactNode
  account?: boolean
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-12 max-w-5xl items-center px-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-medium transition-opacity hover:opacity-70"
        >
          <span className="inline-flex size-5 items-center justify-center bg-foreground text-[10px] leading-none font-bold text-background">
            G
          </span>
          GoodRepo
        </Link>
        <div className="ml-auto flex items-center gap-4 self-stretch text-xs text-muted-foreground">
          {children}
          {account ? (
            <Suspense fallback={<AccountNavFallback />}>
              <AccountNav />
            </Suspense>
          ) : null}
        </div>
      </div>
    </header>
  )
}
