"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { parseRepoInput } from "@/lib/parse-repo"

export function ScanForm({ className }: { className?: string }) {
  const router = useRouter()
  const [value, setValue] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [pending, startTransition] = React.useTransition()

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    const parsed = parseRepoInput(value)
    if (!parsed) {
      setError("Enter a public repository as github.com/owner/repo")
      return
    }
    setError(null)
    startTransition(() => {
      router.push(`/${parsed.owner}/${parsed.repo}`)
    })
  }

  return (
    <form onSubmit={onSubmit} className={cn("w-full", className)}>
      <div
        className={cn(
          "focus-within:border-ring flex h-14 items-center border bg-card pl-4 transition-colors",
          error && "border-destructive"
        )}
      >
        <span className="text-muted-foreground hidden text-sm select-none sm:inline">
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
          className="placeholder:text-muted-foreground/60 h-full min-w-0 flex-1 bg-transparent px-2 text-base outline-none"
        />
        <Button type="submit" size="lg" disabled={pending} className="m-1 px-4">
          {pending ? "Scanning" : "Scan"}
        </Button>
      </div>
      <p
        className={cn(
          "mt-2 text-xs",
          error ? "text-destructive" : "text-muted-foreground"
        )}
      >
        {error ?? "Public repos only. No sign in, no model call, no waiting."}
      </p>
    </form>
  )
}
