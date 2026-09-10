"use client"

import * as React from "react"
import Link from "next/link"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { VerificationForm } from "@/components/verification-form"
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

type CopyState =
  | { status: "idle" }
  | { status: "error"; message: string; value?: string }
  | { status: "copied" }

const EMPTY_STATE: FixActionState = { status: "idle", message: "" }
const IMPACT_TONE = {
  High: "border-destructive/35 text-destructive",
  Medium: "border-warn/40 text-warn",
  Low: "border-border text-muted-foreground",
} as const
const WORKFLOW_STEPS = ["Scan", "Choose", "Fix", "Verify"] as const

export function FixWorkflow({
  repository,
  mode,
  choices,
  initialSelected,
  initiallyOpen = false,
}: {
  repository: { owner: string; repo: string; commitSha: string }
  mode: QuickScanMode
  choices: FixChoice[]
  initialSelected: SignalId[]
  initiallyOpen?: boolean
}) {
  const [open, setOpen] = React.useState(
    initiallyOpen || initialSelected.length > 0
  )
  const [selected, setSelected] = React.useState(() => {
    const available = new Set(choices.map((choice) => choice.id))
    const requested = initialSelected.filter((id) => available.has(id))
    return new Set(requested.length > 0 ? requested : [...available])
  })
  const [category, setCategory] = React.useState("all")
  const [state, setState] = React.useState<FixActionState>(EMPTY_STATE)
  const [requestId] = React.useState(() => crypto.randomUUID())
  const [pending, startTransition] = React.useTransition()
  const [activeTask, setActiveTask] = React.useState<"save" | "copy" | null>(
    null
  )
  const [copyState, setCopyState] = React.useState<CopyState>({
    status: "idle",
  })
  const [verificationStarted, setVerificationStarted] = React.useState(false)
  const selectedIds = choices
    .filter((choice) => selected.has(choice.id))
    .map((choice) => choice.id)
  const categoryNames = [...new Set(choices.map((choice) => choice.category))]
  const visible =
    category === "all"
      ? choices
      : choices.filter((choice) => choice.category === category)
  const savedPlanId = state.status === "saved" ? state.planId : undefined
  const currentStep = savedPlanId ? (verificationStarted ? 3 : 2) : open ? 1 : 0

  function resetFeedback() {
    setState(EMPTY_STATE)
    setCopyState({ status: "idle" })
  }

  function toggle(id: SignalId) {
    resetFeedback()
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    resetFeedback()
    setSelected(new Set(choices.map((choice) => choice.id)))
  }

  function clearSelection() {
    resetFeedback()
    setSelected(new Set())
  }

  function save() {
    if (selectedIds.length === 0) return
    setActiveTask("save")
    startTransition(async () => {
      try {
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
      } finally {
        setActiveTask(null)
      }
    })
  }

  function copySelected() {
    if (selectedIds.length === 0) return
    setActiveTask("copy")
    setCopyState({ status: "idle" })
    startTransition(async () => {
      try {
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
      } finally {
        setActiveTask(null)
      }
    })
  }

  const resumeUrl = `/${repository.owner}/${repository.repo}${
    mode === "private" ? "/private" : ""
  }?sha=${repository.commitSha}&choose=1&fixes=${selectedIds.join(",")}`
  const signInUrl = `/sign-in?next=${encodeURIComponent(resumeUrl)}`

  return (
    <section
      id="fix-with-agent"
      className="w-full min-w-0 scroll-mt-20 overflow-x-clip border-y border-border/80 bg-background"
      aria-labelledby="fix-workflow-title"
    >
      <div className="grid min-w-0 gap-4 px-4 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5">
        <div className="min-w-0">
          <h2
            id="fix-workflow-title"
            className="text-lg font-medium tracking-tight"
          >
            Turn this report into a working branch
          </h2>
          <p className="mt-1 max-w-2xl font-sans text-sm leading-6 text-muted-foreground">
            Choose the findings that matter, save the plan, and hand a scoped
            prompt to your coding agent.
          </p>
        </div>
        <Button
          type="button"
          variant={open ? "outline" : "default"}
          size="sm"
          aria-expanded={open}
          aria-controls="fix-workflow-panel"
          onClick={() => setOpen((current) => !current)}
          className="min-h-10 justify-between gap-6 px-3 sm:min-w-44"
        >
          {open ? "Collapse" : "Fix with your agent"}
          <span
            aria-hidden
            className={cn(
              "text-base transition-transform duration-200 motion-reduce:transition-none",
              open && "rotate-90"
            )}
          >
            →
          </span>
        </Button>
      </div>

      <ol className="grid min-w-0 grid-cols-4 border-y border-border/60 bg-muted/15">
        {WORKFLOW_STEPS.map((step, index) => (
          <li
            key={step}
            aria-current={index === currentStep ? "step" : undefined}
            className={cn(
              "min-w-0 border-r border-border/60 px-2 py-2 text-[10px] text-muted-foreground transition-colors duration-200 last:border-r-0 motion-reduce:transition-none sm:px-4 sm:text-xs",
              index < currentStep && "text-success",
              index === currentStep && "bg-muted/70 font-medium text-foreground"
            )}
          >
            <span className="mr-1.5 tabular-nums" aria-hidden>
              {index < currentStep ? "✓" : `0${index + 1}`}
            </span>
            {step}
          </li>
        ))}
      </ol>

      {open ? (
        <div
          id="fix-workflow-panel"
          className="min-w-0 animate-in duration-300 fade-in slide-in-from-top-2 motion-reduce:animate-none"
        >
          {savedPlanId ? (
            <div className="min-w-0 animate-in px-4 py-7 duration-300 fade-in slide-in-from-right-3 motion-reduce:animate-none sm:px-5 sm:py-8">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <h3 className="text-xl font-medium tracking-tight">
                    Plan saved. Hand it off.
                  </h3>
                  <p className="mt-1.5 max-w-2xl font-sans text-sm leading-6 text-muted-foreground">
                    Your {selectedIds.length}-issue plan is attached to commit{" "}
                    <span className="font-mono text-foreground">
                      {repository.commitSha.slice(0, 7)}
                    </span>
                    .
                  </p>
                </div>
                <span className="w-fit border border-success/40 px-2 py-1 text-[11px] text-success">
                  Saved to your account
                </span>
              </div>

              <ol className="mt-7 border-y border-border/60">
                <li className="grid gap-3 border-b border-border/60 py-5 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:items-center sm:gap-4">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    01
                  </span>
                  <div>
                    <p className="text-sm font-medium">Copy the agent prompt</p>
                    <p className="mt-1 max-w-2xl font-sans text-sm leading-5 text-muted-foreground">
                      It contains only your selected findings and their scan
                      evidence.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={copySelected}
                    disabled={pending}
                    className="min-h-10 px-3"
                  >
                    {copyState.status === "copied"
                      ? "Prompt copied"
                      : activeTask === "copy"
                        ? "Preparing prompt"
                        : "Copy prompt"}
                  </Button>
                </li>
                <li className="grid gap-3 border-b border-border/60 py-5 sm:grid-cols-[2rem_minmax(0,1fr)] sm:gap-4">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    02
                  </span>
                  <div>
                    <p className="text-sm font-medium">
                      Run it in your coding agent
                    </p>
                    <p className="mt-1 max-w-2xl font-sans text-sm leading-5 text-muted-foreground">
                      Paste the prompt in the repository. The agent will verify
                      the findings, create a branch, make the fixes, and commit
                      the work.
                    </p>
                  </div>
                </li>
                <li className="grid min-w-0 gap-3 py-5 sm:grid-cols-[2rem_minmax(0,1fr)] sm:gap-4">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    03
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      Verify the new commit here
                    </p>
                    <p className="mt-1 max-w-2xl font-sans text-sm leading-5 text-muted-foreground">
                      Paste the pushed commit SHA to compare it with this saved
                      baseline without leaving the workflow.
                    </p>
                    <VerificationForm
                      planId={savedPlanId}
                      embedded
                      onVerificationStart={() => setVerificationStarted(true)}
                    />
                  </div>
                </li>
              </ol>

              <CopyFallback copyState={copyState} />
            </div>
          ) : (
            <div>
              <div className="min-w-0 px-4 py-6 sm:px-5">
                <div>
                  <h3 className="text-lg font-medium tracking-tight">
                    Choose what your agent should fix
                  </h3>
                  <p className="mt-1.5 font-sans text-sm text-muted-foreground">
                    All failed checks are selected by default. Uncheck anything
                    you want to leave out.
                  </p>
                </div>

                <div className="mt-5 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-border/60">
                  <FilterButton
                    active={category === "all"}
                    onClick={() => setCategory("all")}
                  >
                    All issues
                  </FilterButton>
                  {categoryNames.map((name) => (
                    <FilterButton
                      key={name}
                      active={category === name}
                      onClick={() => setCategory(name)}
                    >
                      {name}
                    </FilterButton>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {selectedIds.length}/{choices.length} selected
                  </span>
                  <button
                    type="button"
                    onClick={selectAll}
                    className="min-h-8 text-xs underline-offset-4 hover:underline focus-visible:outline-1 focus-visible:outline-ring"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="min-h-8 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-1 focus-visible:outline-ring"
                  >
                    Clear
                  </button>
                  <span className="hidden flex-1 sm:block" />
                  <p className="text-[10px] text-muted-foreground">
                    Saved privately against this commit
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    onClick={save}
                    disabled={pending || selectedIds.length === 0}
                    className="min-h-10 px-3"
                  >
                    {activeTask === "save"
                      ? "Saving plan"
                      : "Save and continue"}
                    <span aria-hidden>→</span>
                  </Button>
                </div>
              </div>

              {state.message ? (
                <div
                  role="alert"
                  className="border-b border-destructive/30 px-5 py-3 text-xs text-destructive sm:px-6"
                >
                  {state.message}{" "}
                  {state.message.startsWith("Sign in") ? (
                    <Link
                      href={signInUrl}
                      className="underline underline-offset-4"
                    >
                      Sign in without losing this selection
                    </Link>
                  ) : null}
                </div>
              ) : null}

              <ul className="min-w-0 divide-y divide-border/60 border-t border-border/60">
                {visible.map((choice) => {
                  const checked = selected.has(choice.id)
                  const showFinding =
                    choice.finding.trim() !== choice.title.trim()
                  return (
                    <li key={choice.id}>
                      <label
                        className={cn(
                          "grid min-w-0 cursor-pointer grid-cols-[auto_minmax(0,1fr)] gap-3 px-4 py-5 transition-colors duration-150 sm:gap-4 sm:px-5",
                          checked ? "bg-background" : "bg-muted/20",
                          "hover:bg-muted/35"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(choice.id)}
                          className="mt-6 size-4 accent-foreground"
                        />
                        <span className="min-w-0">
                          <span className="mb-2 flex min-h-5 flex-wrap items-center gap-2">
                            <span className="text-[10px] text-muted-foreground">
                              {choice.category}
                            </span>
                            {choice.impact ? (
                              <span
                                className={cn(
                                  "border px-1.5 py-px text-[10px] font-normal",
                                  IMPACT_TONE[choice.impact]
                                )}
                              >
                                {choice.impact} impact
                              </span>
                            ) : null}
                          </span>
                          <span className="block max-w-3xl text-sm leading-5 font-medium break-words">
                            {choice.title}
                          </span>
                          {showFinding ? (
                            <span className="mt-1.5 block max-w-3xl font-sans text-sm leading-6 text-muted-foreground">
                              {choice.finding}
                            </span>
                          ) : null}
                          <span className="mt-2.5 block max-w-3xl text-xs leading-5 text-foreground/90">
                            {choice.suggestedFix.join(" ")}
                          </span>
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      ) : null}
    </section>
  )
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "min-h-8 border-b px-0.5 text-xs transition-colors focus-visible:outline-1 focus-visible:outline-ring",
        active
          ? "border-foreground text-foreground"
          : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}

function CopyFallback({ copyState }: { copyState: CopyState }) {
  if (copyState.status !== "error") return null
  return (
    <div className="mt-5 max-w-2xl text-xs text-destructive">
      <p role="alert">{copyState.message}</p>
      {copyState.value ? (
        <textarea
          readOnly
          value={copyState.value}
          onFocus={(event) => event.currentTarget.select()}
          rows={8}
          aria-label="Agent prompt"
          className="mt-2 block w-full border border-input bg-background p-3 text-xs text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      ) : null}
    </div>
  )
}
