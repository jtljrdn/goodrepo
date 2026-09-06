"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Copy01Icon, Tick02Icon } from "@hugeicons/core-free-icons"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

type CopyState = "idle" | "copied" | "error"

const LABELS: Record<CopyState, string> = {
  idle: "Copy",
  copied: "Copied",
  error: "Copy failed",
}

export function CopyButton({
  value,
  label,
  text = "Copy",
  manualFallback = false,
  className,
}: {
  value: string
  label: string
  text?: string
  manualFallback?: boolean
  className?: string
}) {
  const [state, setState] = React.useState<CopyState>("idle")
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setState("copied")
    } catch {
      setState("error")
    }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setState(current => current === "error" && manualFallback ? current : "idle"), 2000)
  }

  const button = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={copy}
      aria-label={label}
      className={cn(
        "shrink-0",
        state === "error" && "text-destructive",
        className
      )}
    >
      <HugeiconsIcon
        data-icon="inline-start"
        icon={state === "copied" ? Tick02Icon : Copy01Icon}
        strokeWidth={2}
        className={cn(
          state === "copied" &&
            "animate-in text-success duration-200 zoom-in-75"
        )}
      />
      <span aria-hidden>{state === "idle" ? text : LABELS[state]}</span>
      <span aria-live="polite" className="sr-only">
        {state === "idle" ? "" : LABELS[state]}
      </span>
    </Button>
  )

  if (!manualFallback) return button
  return (
    <div className="flex max-w-full flex-col items-start gap-2 sm:items-end">
      {button}
      {state === "error" ? (
        <div className="w-full max-w-md">
          <label className="text-xs text-muted-foreground">
            Clipboard unavailable. Select and copy the instructions below.
            <textarea
              readOnly
              value={value}
              onFocus={event => event.currentTarget.select()}
              rows={8}
              className="mt-2 block w-full border border-input bg-background p-3 text-xs text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </label>
        </div>
      ) : null}
    </div>
  )
}
