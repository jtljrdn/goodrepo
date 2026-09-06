"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { githubToken, verifiedSession } from "@/lib/auth"
import { compareSnapshots } from "@/lib/scan-comparison"
import {
  ANALYSIS_VERSION,
  SNAPSHOT_SCHEMA_VERSION,
  snapshotPayload,
  type QuickScanMode,
  type ScanSnapshot,
} from "@/lib/scan-snapshot"
import {
  deleteFixPlan,
  fixPlanFor,
  recordVerification,
  saveFixPlan,
  setPlanArchived,
} from "@/lib/fix-plans"
import {
  normalizeVerificationRef,
  parseSelectedIds,
  validRepositoryPart,
} from "@/lib/fix-input"
import type { FixActionState } from "@/lib/fix-action-state"
import { improvementWorkflow } from "@/lib/flags"
import { runPrivateScan, runScan } from "@/lib/scan"
import { buildAgentInstructions } from "@/lib/agent-instructions"

type SaveInput = {
  owner: string
  repo: string
  sha: string
  mode: QuickScanMode
  selectedIds: string[]
  requestId: string
}

async function authenticated() {
  if (!(await improvementWorkflow())) return null
  return verifiedSession()
}

async function scanFor(
  mode: QuickScanMode,
  owner: string,
  repo: string,
  ref: string | null
) {
  if (mode === "public") return runScan(owner, repo, ref)
  const token = await githubToken()
  if (!token) return null
  return runPrivateScan(owner, repo, token, ref)
}

export async function saveFixPlanAction(
  input: SaveInput
): Promise<FixActionState> {
  const session = await authenticated()
  if (!session)
    return { status: "error", message: "Sign in again to save this plan." }
  const selectedIds = parseSelectedIds(input.selectedIds)
  if (
    !validRepositoryPart(input.owner) ||
    !validRepositoryPart(input.repo) ||
    !/^[0-9a-f]{40}$/.test(input.sha) ||
    !["public", "private"].includes(input.mode) ||
    !selectedIds
  )
    return { status: "error", message: "The selected fix plan is invalid." }

  const result = await scanFor(input.mode, input.owner, input.repo, input.sha)
  if (!result)
    return {
      status: "error",
      message: "Reconnect GitHub before saving a private fix plan.",
    }
  if (!result.ok)
    return {
      status: "error",
      message: "The baseline scan could not be revalidated.",
    }
  try {
    const plan = await saveFixPlan(
      session.user.id,
      input.requestId,
      selectedIds,
      result.profile,
      result.overall,
      result.categories,
      input.mode
    )
    revalidatePath("/dashboard")
    return {
      status: "saved",
      message: "Fix plan saved.",
      planId: plan.id,
    }
  } catch (error) {
    console.error("Could not save fix plan.", error)
    return {
      status: "error",
      message:
        "The plan was not saved. Your selection is still here; try again.",
    }
  }
}

export async function buildSelectedInstructionsAction(
  input: Omit<SaveInput, "requestId">
): Promise<{ ok: true; value: string } | { ok: false; message: string }> {
  if (!(await improvementWorkflow()))
    return { ok: false, message: "Guided fixes are not enabled." }
  const selectedIds = parseSelectedIds(input.selectedIds)
  if (
    !validRepositoryPart(input.owner) ||
    !validRepositoryPart(input.repo) ||
    !/^[0-9a-f]{40}$/.test(input.sha) ||
    !["public", "private"].includes(input.mode) ||
    !selectedIds
  )
    return { ok: false, message: "The selected fixes are invalid." }
  const result = await scanFor(input.mode, input.owner, input.repo, input.sha)
  if (!result || !result.ok)
    return { ok: false, message: "The baseline scan could not be revalidated." }
  try {
    return {
      ok: true,
      value: buildAgentInstructions({
        profile: result.profile,
        overall: result.overall,
        categories: result.categories,
        kind: input.mode === "private" ? "private" : "static",
        selectedIds,
      }),
    }
  } catch {
    return { ok: false, message: "Select only failed checks from this scan." }
  }
}

function transientSnapshot(
  userId: string,
  mode: QuickScanMode,
  result: Extract<Awaited<ReturnType<typeof runScan>>, { ok: true }>
): ScanSnapshot {
  return {
    id: "unsaved",
    userId,
    repositoryId: result.profile.repositoryId,
    owner: result.profile.owner,
    repo: result.profile.repo,
    commitSha: result.profile.commitSha,
    mode,
    analysisVersion: ANALYSIS_VERSION,
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    observedAt: new Date(),
    payload: snapshotPayload(result.profile, result.overall, result.categories),
  }
}

export async function verifyFixPlanAction(
  planId: string,
  _previous: FixActionState,
  formData: FormData
): Promise<FixActionState> {
  const session = await authenticated()
  if (!session)
    return { status: "error", message: "Sign in again to verify this plan." }
  const detail = await fixPlanFor(session.user.id, planId)
  if (!detail)
    return { status: "error", message: "This fix plan was not found." }
  const raw = formData.get("target")
  if (typeof raw !== "string" || raw.length > 300)
    return {
      status: "error",
      message: "Enter a full commit SHA or GitHub commit URL.",
    }
  const ref = normalizeVerificationRef(
    raw,
    detail.baseline.owner,
    detail.baseline.repo
  )
  if (ref === "invalid")
    return {
      status: "error",
      message: "Enter a full commit SHA or GitHub commit URL.",
    }
  const result = await scanFor(
    detail.plan.mode,
    detail.baseline.owner,
    detail.baseline.repo,
    ref
  )
  if (!result)
    return {
      status: "error",
      message: "Reconnect GitHub before verifying this private plan.",
    }
  if (!result.ok)
    return {
      status: "error",
      message:
        "The target commit could not be scanned. The saved plan is unchanged.",
    }
  if (result.profile.repositoryId !== detail.plan.repositoryId)
    return {
      status: "error",
      message: "GitHub now resolves this name to a different repository.",
    }
  if (result.profile.commitSha === detail.baseline.commitSha)
    return {
      status: "unchanged",
      message: "No new commit found. Push your changes or choose a commit.",
      targetSha: result.profile.commitSha,
    }

  const target = transientSnapshot(session.user.id, detail.plan.mode, result)
  const comparison = compareSnapshots(detail.baseline, target)
  const selected = new Set(detail.plan.selectedSignalIds)
  const selectedOutcomes = comparison.signals.filter((item) =>
    selected.has(item.id)
  )
  const complete = selectedOutcomes.every(
    (item) =>
      item.target?.status === "pass" && item.transition !== "not-comparable"
  )
  const state = {
    targetSha: target.commitSha,
    nowPassing: selectedOutcomes.filter(
      (item) => item.transition === "now-passing"
    ).length,
    nowFailing: comparison.counts.nowFailing,
    coverageChanged: comparison.counts.coverageChanged,
    complete,
  }
  try {
    await recordVerification(
      session.user.id,
      detail.plan,
      result.profile,
      result.overall,
      result.categories
    )
    revalidatePath(`/fixes/${planId}`)
    revalidatePath("/dashboard")
    return {
      status: "saved",
      message: complete
        ? "All selected checks pass at this commit."
        : `${state.nowPassing} of ${selected.size} selected checks now pass.`,
      ...state,
    }
  } catch (error) {
    console.error("Verification scan completed but could not be saved.", error)
    return {
      status: "unsaved",
      message:
        "The scan completed, but its result was not saved. Retry this commit.",
      ...state,
    }
  }
}

export async function archiveFixPlanAction(planId: string): Promise<void> {
  const session = await authenticated()
  if (!session) return
  await setPlanArchived(session.user.id, planId, true)
  revalidatePath(`/fixes/${planId}`)
  revalidatePath("/dashboard")
}

export async function unarchiveFixPlanAction(planId: string): Promise<void> {
  const session = await authenticated()
  if (!session) return
  await setPlanArchived(session.user.id, planId, false)
  revalidatePath(`/fixes/${planId}`)
  revalidatePath("/dashboard")
}

export async function deleteFixPlanAction(planId: string): Promise<void> {
  const session = await authenticated()
  if (!session) return
  await deleteFixPlan(session.user.id, planId)
  revalidatePath("/dashboard")
  redirect("/dashboard")
}
