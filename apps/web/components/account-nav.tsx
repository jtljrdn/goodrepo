import Link from "next/link"
import { SignOutButton } from "@/components/auth-form"
import { currentSession } from "@/lib/auth"

export async function AccountNav() {
  const session = await currentSession()

  if (!session) {
    return (
      <Link
        href="/sign-in"
        className="text-muted-foreground transition-colors hover:text-foreground"
      >
        Sign in
      </Link>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="hidden max-w-[11rem] truncate text-muted-foreground sm:inline">
        {session.user.email}
      </span>
      <SignOutButton />
    </div>
  )
}
