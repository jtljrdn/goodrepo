"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { GithubIcon } from "@hugeicons/core-free-icons"
import { Button } from "@workspace/ui/components/button"
import { authClient } from "@/lib/auth-client"

export function AuthForm({ next }: { next: string }) {
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  // Returning by the back button restores this component from the bfcache with `busy` still
  // set, and `pageshow` is the only event that fires on such a restore.
  React.useEffect(() => {
    const wake = () => setBusy(false)
    window.addEventListener("pageshow", wake)
    return () => window.removeEventListener("pageshow", wake)
  }, [])

  async function onGithub() {
    setError(null)
    setBusy(true)
    const result = await authClient.signIn.social({
      provider: "github",
      callbackURL: next,
    })
    if (result.error) {
      setError(result.error.message ?? "GitHub sign-in did not complete.")
      setBusy(false)
    }
  }

  return (
    <div className="border border-border/60 p-4">
      <Button
        type="button"
        size="lg"
        disabled={busy}
        onClick={onGithub}
        className="w-full"
      >
        <HugeiconsIcon
          data-icon="inline-start"
          icon={GithubIcon}
          strokeWidth={2}
        />
        {busy ? "Opening GitHub" : "Continue with GitHub"}
      </Button>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        Signing in unlocks private repositories and deep scans.
      </p>
      {error ? (
        <p role="alert" className="mt-3 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
