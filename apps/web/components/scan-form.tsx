"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { parseRepoInput } from "@/lib/parse-repo"

const DEFAULT_HINT = "Public repos need no sign in. No AI, no waiting."

export function ScanForm({
  className,
  hint = DEFAULT_HINT,
}: {
  className?: string
  hint?: string | null
}) {
  const router = useRouter()
  const [value, setValue] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [pending, startTransition] = React.useTransition()

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    const parsed = parseRepoInput(value)
    if (!parsed) {
      setError("Enter a repository as github.com/owner/repo")
      return
    }
    setError(null)
    startTransition(() => {
      router.push(`/${parsed.owner}/${parsed.repo}`)
    })
  }

  const message = error ?? hint

  return (
    <form onSubmit={onSubmit} className={cn("w-full", className)}>
      <div
        className={cn(
          "flex h-14 items-center border bg-card pl-4 transition-colors focus-within:border-ring",
          error && "border-destructive"
        )}
      >
        <span className="hidden text-sm text-muted-foreground select-none sm:inline">
          github.com/
        </span>
        <input
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            setError(null)
          }}
          placeholder="owner/repository"
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          aria-label="GitHub repository"
          className="h-full min-w-0 flex-1 bg-transparent px-2 text-base outline-none placeholder:text-muted-foreground/60"
        />
        <Button type="submit" size="lg" disabled={pending} className="m-1 px-4">
          {pending ? "Scanning" : "Scan"}
        </Button>
      </div>
      {message ? (
        <p
          className={cn(
            "mt-2 text-xs",
            error ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {message}
        </p>
      ) : null}
    </form>
  )
}
