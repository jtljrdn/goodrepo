"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { GithubIcon } from "@hugeicons/core-free-icons"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { authClient } from "@/lib/auth-client"

type Mode = "sign-in" | "sign-up"

const COPY: Record<Mode, { heading: string; submit: string; busy: string }> = {
  "sign-in": { heading: "Sign in", submit: "Sign in", busy: "Signing in" },
  "sign-up": {
    heading: "Create account",
    submit: "Create account",
    busy: "Creating account",
  },
}

function readable(mode: Mode, message: string | undefined): string {
  const fallback =
    mode === "sign-in"
      ? "That did not sign you in. Try again in a moment."
      : "The account could not be created. Try again in a moment."
  if (!message) return fallback

  const lower = message.toLowerCase()
  if (lower.includes("invalid email or password")) {
    return "No account matches that email and password. Check them, or create an account."
  }
  if (
    lower.includes("already exists") ||
    lower.includes("already registered")
  ) {
    return "An account already uses that email. Sign in instead."
  }
  return message
}

export function AuthForm({ next, github }: { next: string; github: boolean }) {
  const router = useRouter()
  const [mode, setMode] = React.useState<Mode>("sign-in")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  const copy = COPY[mode]

  function switchTo(target: Mode) {
    setMode(target)
    setError(null)
  }

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

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)

    const result =
      mode === "sign-in"
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({
            email,
            password,
            name: email.split("@")[0] ?? email,
          })

    if (result.error) {
      setError(readable(mode, result.error.message))
      setBusy(false)
      return
    }

    router.push(next)
    router.refresh()
  }

  return (
    <div className="border border-border/60">
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-2.5">
        <h2 className="text-xs font-medium">{copy.heading}</h2>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => switchTo(mode === "sign-in" ? "sign-up" : "sign-in")}
          className="text-muted-foreground hover:text-foreground"
        >
          {mode === "sign-in" ? "Create account" : "I have an account"}
        </Button>
      </div>

      {github ? (
        <div className="border-b border-border/60 p-4">
          <Button
            type="button"
            variant="outline"
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
            Continue with GitHub
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            Allows for scanning of private repositories.
          </p>
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="p-4">
        <label htmlFor="email" className="block text-xs text-muted-foreground">
          Email
        </label>
        <div
          className={cn(
            "mt-1.5 flex h-12 items-center border bg-card transition-colors focus-within:border-ring",
            error && "border-destructive"
          )}
        >
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              setError(null)
            }}
            required
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="email"
            aria-invalid={error !== null}
            aria-describedby={error ? "auth-error" : undefined}
            className="h-full w-full min-w-0 bg-transparent px-3 text-base outline-none placeholder:text-muted-foreground/60"
          />
        </div>

        <label
          htmlFor="password"
          className="mt-4 block text-xs text-muted-foreground"
        >
          Password
        </label>
        <div
          className={cn(
            "mt-1.5 flex h-12 items-center border bg-card transition-colors focus-within:border-ring",
            error && "border-destructive"
          )}
        >
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value)
              setError(null)
            }}
            required
            minLength={8}
            autoComplete={
              mode === "sign-in" ? "current-password" : "new-password"
            }
            aria-invalid={error !== null}
            aria-describedby={error ? "auth-error" : undefined}
            className="h-full w-full min-w-0 bg-transparent px-3 text-base outline-none placeholder:text-muted-foreground/60"
          />
        </div>
        <p className="mt-1.5 min-h-4 text-xs text-muted-foreground">
          {mode === "sign-up" ? "At least 8 characters." : null}
        </p>

        <Button type="submit" size="lg" disabled={busy} className="mt-4 w-full">
          {busy ? copy.busy : copy.submit}
        </Button>

        {error ? (
          <p
            id="auth-error"
            role="alert"
            className="mt-3 text-xs leading-relaxed text-destructive"
          >
            {error}
          </p>
        ) : null}
      </form>
    </div>
  )
}

export function SignOutButton() {
  const router = useRouter()
  const [busy, setBusy] = React.useState(false)

  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        await authClient.signOut()
        router.refresh()
      }}
      className="text-muted-foreground hover:text-foreground"
    >
      {busy ? "Signing out" : "Sign out"}
    </Button>
  )
}
