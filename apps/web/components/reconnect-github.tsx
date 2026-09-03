"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { GithubIcon } from "@hugeicons/core-free-icons"
import { Button } from "@workspace/ui/components/button"
import { authClient } from "@/lib/auth-client"

export function ReconnectGitHub({ next }: { next: string }) {
  const [busy, setBusy] = React.useState(false)

  async function onClick() {
    setBusy(true)
    await authClient.signOut()
    window.location.href = `/sign-in?next=${encodeURIComponent(next)}`
  }

  return (
    <Button variant="outline" size="sm" disabled={busy} onClick={onClick}>
      <HugeiconsIcon
        data-icon="inline-start"
        icon={GithubIcon}
        strokeWidth={2}
      />
      {busy ? "Opening GitHub" : "Reconnect GitHub"}
    </Button>
  )
}
