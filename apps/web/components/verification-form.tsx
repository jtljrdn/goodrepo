"use client"

import { useActionState } from "react"
import { Button } from "@workspace/ui/components/button"
import { verifyFixPlanAction } from "@/lib/fix-actions"
import { INITIAL_FIX_ACTION_STATE } from "@/lib/fix-action-state"

export function VerificationForm({ planId }: { planId: string }) {
  const action = verifyFixPlanAction.bind(null, planId)
  const [state, formAction, pending] = useActionState(
    action,
    INITIAL_FIX_ACTION_STATE
  )
  return (
    <form action={formAction} className="border border-border/60 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1 text-xs text-muted-foreground">
          Target commit (optional)
          <input
            key={state.targetSha ?? "head"}
            name="target"
            defaultValue={state.status === "unsaved" ? state.targetSha : ""}
            placeholder="Default branch HEAD, full SHA, or GitHub commit URL"
            className="mt-2 block min-h-10 w-full border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </label>
        <Button type="submit" disabled={pending} className="min-h-10">
          {pending
            ? "Verifying"
            : state.status === "unsaved"
              ? "Retry save"
              : "Verify fixes"}
        </Button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Leave blank to resolve the current default-branch HEAD. Branch names and
        arbitrary URLs are not accepted.
      </p>
      {state.message ? (
        <div
          role={
            state.status === "error" || state.status === "unsaved"
              ? "alert"
              : "status"
          }
          className={`mt-4 border px-3 py-2 text-xs ${
            state.status === "error" || state.status === "unsaved"
              ? "border-destructive/40 text-destructive"
              : "border-success/40 text-success"
          }`}
        >
          <p>{state.message}</p>
          {state.targetSha ? (
            <p className="mt-1 text-muted-foreground">
              Resolved target: {state.targetSha}
              {state.nowFailing !== undefined
                ? ` · ${state.nowFailing} unrelated checks now fail · ${state.coverageChanged ?? 0} changed coverage`
                : ""}
            </p>
          ) : null}
        </div>
      ) : null}
    </form>
  )
}
