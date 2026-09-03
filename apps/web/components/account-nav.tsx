import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight02Icon } from "@hugeicons/core-free-icons"
import { AccountMenu } from "@/components/account-menu"
import { currentSession } from "@/lib/auth"
import { DEEP_SCAN_ENABLED } from "@/lib/flags"
import { DAILY_RUNS_PER_ACCOUNT } from "@/lib/quota"

const CELL =
  "-mr-6 flex h-12 items-center self-stretch border-l border-border pr-6 pl-4"

export function AccountNavFallback() {
  return (
    <div className={CELL} aria-hidden>
      <span className="size-5 animate-pulse bg-muted" />
      <span className="ml-2 size-3 animate-pulse bg-muted" />
    </div>
  )
}

export async function AccountNav() {
  const session = await currentSession()

  if (!session) {
    return (
      <Link
        href="/sign-in"
        className={`${CELL} group gap-2 text-xs font-medium text-foreground transition-colors outline-none hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring`}
      >
        Sign in
        <HugeiconsIcon
          icon={ArrowRight02Icon}
          strokeWidth={2}
          className="size-3.5 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5"
        />
      </Link>
    )
  }

  const { email, name, image } = session.user

  return (
    <AccountMenu
      email={email}
      name={name || (email.split("@")[0] ?? email)}
      image={image ?? null}
      allowance={
        DEEP_SCAN_ENABLED ? `${DAILY_RUNS_PER_ACCOUNT} deep scans a day` : null
      }
    />
  )
}
