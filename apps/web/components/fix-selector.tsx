"use client"

import * as React from "react"
import Link from "next/link"
import { Button } from "@workspace/ui/components/button"
import {
  buildSelectedInstructionsAction,
  saveFixPlanAction,
} from "@/lib/fix-actions"
import type { FixActionState } from "@/lib/fix-action-state"
import type { SignalId } from "@/lib/profile"
import type { QuickScanMode } from "@/lib/scan-snapshot"

export type FixChoice = {
  id: SignalId
  category: string
  finding: string
  measurement: string | null
  title: string
  impact: "High" | "Medium" | "Low" | null
  suggestedFix: string[]
}

const EMPTY_STATE: FixActionState = { status: "idle", message: "" }

export function FixSelector({
  repository,
  mode,
  choices,
  initialSelected,
}: {
  repository: { owner: string; repo: string; commitSha: string }
  mode: QuickScanMode
  choices: FixChoice[]
  initialSelected: SignalId[]
}) {
  const [selected, setSelected] = React.useState(
    () =>
      new Set(
        initialSelected.filter((id) => choices.some((item) => item.id === id))
      )
  )
  const [category, setCategory] = React.useState<string>("all")
  const [state, setState] = React.useState<FixActionState>(EMPTY_STATE)
  const [requestId] = React.useState(() => crypto.randomUUID())
  const [pending, startTransition] = React.useTransition()
  const [copyState, setCopyState] = React.useState<
    | { status: "idle" }
    | { status: "error"; message: string; value?: string }
    | { status: "copied" }
  >({ status: "idle" })
  const selectedIds = choices
    .filter((choice) => selected.has(choice.id))
    .map((choice) => choice.id)
  const categoryNames = [...new Set(choices.map((choice) => choice.category))]
  const visible =
    category === "all"
      ? choices
      : choices.filter((choice) => choice.category === category)

  function toggle(id: SignalId) {
    setState(EMPTY_STATE)
    setCopyState({ status: "idle" })
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function save() {
    if (selectedIds.length === 0) return
    startTransition(async () => {
      setState(
        await saveFixPlanAction({
          owner: repository.owner,
          repo: repository.repo,
          sha: repository.commitSha,
          mode,
          selectedIds,
          requestId,
        })
      )
    })
  }

  function copySelected() {
    if (selectedIds.length === 0) return
    startTransition(async () => {
      const result = await buildSelectedInstructionsAction({
        owner: repository.owner,
        repo: repository.repo,
        sha: repository.commitSha,
        mode,
        selectedIds,
      })
      if (!result.ok) {
        setCopyState({ status: "error", message: result.message })
        return
      }
      try {
        await navigator.clipboard.writeText(result.value)
        setCopyState({ status: "copied" })
      } catch {
        setCopyState({
          status: "error",
          message:
            "Clipboard unavailable. Select and copy the instructions below.",
          value: result.value,
        })
      }
    })
  }

  const resumeUrl = `/${repository.owner}/${repository.repo}${
    mode === "private" ? "/private" : ""
  }?sha=${repository.commitSha}&fixes=${selectedIds.join(",")}`
  const signInUrl = `/sign-in?next=${encodeURIComponent(resumeUrl)}`

  return (
    <div id="choose-fixes" className="scroll-mt-16">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setCategory("all")}
          aria-pressed={category === "all"}
          className="border border-border/60 px-2 py-1 text-xs aria-pressed:border-foreground"
        >
          All
        </button>
        {categoryNames.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setCategory(name)}
            aria-pressed={category === name}
            className="border border-border/60 px-2 py-1 text-xs aria-pressed:border-foreground"
          >
            {name}
          </button>
        ))}
        <button
          type="button"
          onClick={() =>
            setSelected(new Set(choices.map((choice) => choice.id)))
          }
          className="ml-auto text-xs underline-offset-4 hover:underline"
        >
          Select all
        </button>
        <button
          type="button"
          onClick={() => setSelected(new Set())}
          className="text-xs underline-offset-4 hover:underline"
        >
          Clear
        </button>
      </div>

      <ul className="mt-4 divide-y divide-border/60 border-y border-border/60">
        {visible.map((choice) => (
          <li key={choice.id}>
            <label className="grid cursor-pointer grid-cols-[auto_1fr] gap-3 px-2 py-4 hover:bg-muted/40">
              <input
                type="checkbox"
                checked={selected.has(choice.id)}
                onChange={() => toggle(choice.id)}
                className="mt-1 size-4 accent-foreground"
              />
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {choice.title}
                  {choice.impact ? (
                    <span className="border border-border/60 px-1.5 py-px text-[10px] text-muted-foreground">
                      {choice.impact} impact
                    </span>
                  ) : null}
                  <span className="text-[10px] font-normal text-muted-foreground">
                    {choice.category}
                  </span>
                </span>
                <span className="mt-2 block font-sans text-sm leading-relaxed text-muted-foreground">
                  {choice.finding}
                </span>
                {choice.measurement ? (
                  <span className="mt-1 block text-[11px] text-muted-foreground/70">
                    Measurement: {choice.measurement}
                  </span>
                ) : null}
                <span className="mt-2 block text-xs text-foreground">
                  {choice.suggestedFix.join(" ")}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      <div className="sticky bottom-3 mt-5 flex flex-wrap items-center gap-3 border border-border bg-background/95 p-3 backdrop-blur">
        <span className="mr-auto text-xs tabular-nums">
          {selectedIds.length} selected
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={copySelected}
          disabled={pending || selectedIds.length === 0}
        >
          {copyState.status === "copied"
            ? "Copied"
            : pending
              ? "Preparing"
              : "Copy selected instructions"}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={save}
          disabled={pending || selectedIds.length === 0}
        >
          {pending ? "Saving" : "Save fix plan"}
        </Button>
      </div>
      {copyState.status === "error" ? (
        <div className="mt-3 max-w-xl text-xs text-destructive">
          <p role="alert">{copyState.message}</p>
          {copyState.value ? (
            <textarea
              readOnly
              value={copyState.value}
              onFocus={(event) => event.currentTarget.select()}
              rows={8}
              className="mt-2 block w-full border border-input bg-background p-3 text-xs text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          ) : null}
        </div>
      ) : null}
      {state.message ? (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={`mt-3 text-xs ${state.status === "error" ? "text-destructive" : "text-success"}`}
        >
          {state.message}{" "}
          {state.planId ? (
            <Link href={`/fixes/${state.planId}`} className="underline">
              Open saved plan
            </Link>
          ) : state.status === "error" &&
            state.message.startsWith("Sign in") ? (
            <Link href={signInUrl} className="underline">
              Sign in without losing this selection
            </Link>
          ) : null}
        </p>
      ) : null}
    </div>
  )
}
