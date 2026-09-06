import type { PoolClient } from "pg"
import type { RepoProfile, SignalId } from "@/lib/profile"
import { pool } from "@/lib/db"
import {
  ANALYSIS_VERSION,
  failedSignalIds,
  parseSnapshotPayload,
  SNAPSHOT_SCHEMA_VERSION,
  snapshotPayload,
  type QuickScanMode,
  type ScanSnapshot,
  type ScanSnapshotPayload,
} from "@/lib/scan-snapshot"
import type { ScoredCategory } from "@/lib/score"

const MAX_HISTORY = 50
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type SnapshotRow = {
  id: string
  user_id: string
  repository_id: string
  owner: string
  repo: string
  commit_sha: string
  mode: QuickScanMode
  analysis_version: string
  snapshot_schema_version: number
  payload: unknown
  observed_at: Date
}

export type FixPlan = {
  id: string
  userId: string
  baselineSnapshotId: string
  repositoryId: string
  mode: QuickScanMode
  analysisVersion: string
  selectedSignalIds: SignalId[]
  createdAt: Date
  archivedAt: Date | null
}

export type FixVerification = {
  target: ScanSnapshot
  verifiedAt: Date
}

export type FixPlanDetail = {
  plan: FixPlan
  baseline: ScanSnapshot
  verifications: FixVerification[]
}

function snapshotFromRow(row: SnapshotRow): ScanSnapshot {
  const payload = parseSnapshotPayload(row.payload)
  if (!payload) throw new Error("Stored scan snapshot is invalid.")
  return {
    id: row.id,
    userId: row.user_id,
    repositoryId: row.repository_id,
    owner: row.owner,
    repo: row.repo,
    commitSha: row.commit_sha,
    mode: row.mode,
    analysisVersion: row.analysis_version,
    schemaVersion: row.snapshot_schema_version,
    payload,
    observedAt: row.observed_at,
  }
}

function planFromRow(row: {
  id: string
  user_id: string
  baseline_snapshot_id: string
  repository_id: string
  mode: QuickScanMode
  analysis_version: string
  selected_signal_ids: SignalId[]
  created_at: Date
  archived_at: Date | null
}): FixPlan {
  return {
    id: row.id,
    userId: row.user_id,
    baselineSnapshotId: row.baseline_snapshot_id,
    repositoryId: row.repository_id,
    mode: row.mode,
    analysisVersion: row.analysis_version,
    selectedSignalIds: row.selected_signal_ids,
    createdAt: row.created_at,
    archivedAt: row.archived_at,
  }
}

async function insertSnapshot(
  client: PoolClient,
  userId: string,
  profile: RepoProfile,
  overall: number | null,
  categories: ScoredCategory[],
  mode: QuickScanMode
): Promise<ScanSnapshot> {
  if (!profile.repositoryId || !/^[0-9a-f]{40}$/.test(profile.commitSha))
    throw new Error(
      "The scan does not have a stable repository and commit identity."
    )
  const payload = snapshotPayload(profile, overall, categories)
  await client.query(
    `insert into goodrepo.scan_snapshot
       (user_id, repository_id, owner, repo, commit_sha, mode,
        analysis_version, snapshot_schema_version, payload)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     on conflict (user_id, repository_id, commit_sha, mode, analysis_version)
     do nothing`,
    [
      userId,
      profile.repositoryId,
      profile.owner,
      profile.repo,
      profile.commitSha,
      mode,
      ANALYSIS_VERSION,
      SNAPSHOT_SCHEMA_VERSION,
      payload,
    ]
  )
  const { rows } = await client.query<SnapshotRow>(
    `select * from goodrepo.scan_snapshot
     where user_id = $1 and repository_id = $2 and commit_sha = $3
       and mode = $4 and analysis_version = $5`,
    [userId, profile.repositoryId, profile.commitSha, mode, ANALYSIS_VERSION]
  )
  if (!rows[0]) throw new Error("The scan snapshot could not be saved.")
  return snapshotFromRow(rows[0])
}

export async function observeSnapshot(
  userId: string,
  profile: RepoProfile,
  overall: number | null,
  categories: ScoredCategory[],
  mode: QuickScanMode
): Promise<{ snapshot: ScanSnapshot; baseline: ScanSnapshot | null }> {
  const client = await pool.connect()
  try {
    await client.query("begin")
    const snapshot = await insertSnapshot(
      client,
      userId,
      profile,
      overall,
      categories,
      mode
    )
    const { rows } = await client.query<SnapshotRow>(
      `select * from goodrepo.scan_snapshot
       where user_id = $1 and repository_id = $2 and mode = $3
         and analysis_version = $4 and commit_sha <> $5
         and observed_at <= transaction_timestamp()
       order by observed_at desc, id desc
       limit 1`,
      [
        userId,
        snapshot.repositoryId,
        mode,
        ANALYSIS_VERSION,
        snapshot.commitSha,
      ]
    )
    await client.query("commit")
    return {
      snapshot,
      baseline: rows[0] ? snapshotFromRow(rows[0]) : null,
    }
  } catch (error) {
    await client.query("rollback")
    throw error
  } finally {
    client.release()
  }
}

export async function saveFixPlan(
  userId: string,
  requestId: string,
  selectedIds: readonly SignalId[],
  profile: RepoProfile,
  overall: number | null,
  categories: ScoredCategory[],
  mode: QuickScanMode
): Promise<FixPlan> {
  if (!UUID.test(requestId)) throw new Error("Invalid save request.")
  const unique = [...new Set(selectedIds)]
  const failed = new Set(
    failedSignalIds(snapshotPayload(profile, overall, categories))
  )
  if (
    unique.length === 0 ||
    unique.length > 40 ||
    unique.some((id) => !failed.has(id))
  )
    throw new Error("Select one or more failed checks from this scan.")

  const client = await pool.connect()
  try {
    await client.query("begin")
    const baseline = await insertSnapshot(
      client,
      userId,
      profile,
      overall,
      categories,
      mode
    )
    const { rows } = await client.query(
      `insert into goodrepo.fix_plan
         (user_id, baseline_snapshot_id, repository_id, mode,
          analysis_version, selected_signal_ids, request_id)
       values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (user_id, request_id) do nothing
       returning *`,
      [
        userId,
        baseline.id,
        baseline.repositoryId,
        mode,
        ANALYSIS_VERSION,
        unique,
        requestId,
      ]
    )
    const row =
      rows[0] ??
      (
        await client.query(
          `select * from goodrepo.fix_plan
           where user_id = $1 and request_id = $2`,
          [userId, requestId]
        )
      ).rows[0]
    if (!row) throw new Error("The fix plan could not be saved.")
    await client.query("commit")
    return planFromRow(row)
  } catch (error) {
    await client.query("rollback")
    throw error
  } finally {
    client.release()
  }
}

export async function recordVerification(
  userId: string,
  plan: FixPlan,
  profile: RepoProfile,
  overall: number | null,
  categories: ScoredCategory[]
): Promise<FixVerification> {
  const client = await pool.connect()
  try {
    await client.query("begin")
    const target = await insertSnapshot(
      client,
      userId,
      profile,
      overall,
      categories,
      plan.mode
    )
    if (
      target.repositoryId !== plan.repositoryId ||
      target.analysisVersion !== plan.analysisVersion
    )
      throw new Error(
        "The verification target is not comparable with this plan."
      )
    const { rows } = await client.query<{ verified_at: Date }>(
      `insert into goodrepo.fix_verification
         (user_id, plan_id, repository_id, mode, analysis_version,
          target_snapshot_id)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (plan_id, target_snapshot_id) do update
         set target_snapshot_id = excluded.target_snapshot_id
       returning verified_at`,
      [
        userId,
        plan.id,
        plan.repositoryId,
        plan.mode,
        plan.analysisVersion,
        target.id,
      ]
    )
    await client.query("commit")
    return { target, verifiedAt: rows[0]!.verified_at }
  } catch (error) {
    await client.query("rollback")
    throw error
  } finally {
    client.release()
  }
}

export async function fixPlanFor(
  userId: string,
  planId: string
): Promise<FixPlanDetail | null> {
  if (!UUID.test(planId)) return null
  const { rows } = await pool.query<
    SnapshotRow & {
      plan_id: string
      baseline_snapshot_id: string
      plan_repository_id: string
      plan_mode: QuickScanMode
      plan_analysis_version: string
      selected_signal_ids: SignalId[]
      created_at: Date
      archived_at: Date | null
    }
  >(
    `select p.id as plan_id, p.baseline_snapshot_id,
            p.repository_id as plan_repository_id, p.mode as plan_mode,
            p.analysis_version as plan_analysis_version,
            p.selected_signal_ids, p.created_at, p.archived_at, s.*
     from goodrepo.fix_plan p
     join goodrepo.scan_snapshot s on s.id = p.baseline_snapshot_id
     where p.id = $1 and p.user_id = $2 and s.user_id = $2`,
    [planId, userId]
  )
  const row = rows[0]
  if (!row) return null
  const plan = planFromRow({
    id: row.plan_id,
    user_id: row.user_id,
    baseline_snapshot_id: row.baseline_snapshot_id,
    repository_id: row.plan_repository_id,
    mode: row.plan_mode,
    analysis_version: row.plan_analysis_version,
    selected_signal_ids: row.selected_signal_ids,
    created_at: row.created_at,
    archived_at: row.archived_at,
  })
  const verificationRows = await pool.query<
    SnapshotRow & { verified_at: Date }
  >(
    `select s.*, v.verified_at
     from goodrepo.fix_verification v
     join goodrepo.scan_snapshot s on s.id = v.target_snapshot_id
     where v.plan_id = $1 and v.user_id = $2 and s.user_id = $2
     order by v.verified_at desc, v.id desc
     limit $3`,
    [planId, userId, MAX_HISTORY]
  )
  return {
    plan,
    baseline: snapshotFromRow(row),
    verifications: verificationRows.rows.map((verification) => ({
      target: snapshotFromRow(verification),
      verifiedAt: verification.verified_at,
    })),
  }
}

export async function snapshotFor(
  userId: string,
  snapshotId: string
): Promise<ScanSnapshot | null> {
  if (!UUID.test(snapshotId)) return null
  const { rows } = await pool.query<SnapshotRow>(
    `select * from goodrepo.scan_snapshot where id = $1 and user_id = $2`,
    [snapshotId, userId]
  )
  return rows[0] ? snapshotFromRow(rows[0]) : null
}

export async function baselinesFor(
  userId: string,
  snapshot: ScanSnapshot,
  limit = 20
): Promise<ScanSnapshot[]> {
  const bounded = Math.max(1, Math.min(limit, 50))
  const { rows } = await pool.query<SnapshotRow>(
    `select * from goodrepo.scan_snapshot
     where user_id = $1 and repository_id = $2 and mode = $3
       and analysis_version = $4 and id <> $5
     order by observed_at desc, id desc
     limit $6`,
    [
      userId,
      snapshot.repositoryId,
      snapshot.mode,
      snapshot.analysisVersion,
      snapshot.id,
      bounded,
    ]
  )
  return rows.map(snapshotFromRow)
}

export async function setPlanArchived(
  userId: string,
  planId: string,
  archived: boolean
): Promise<boolean> {
  if (!UUID.test(planId)) return false
  const result = await pool.query(
    `update goodrepo.fix_plan
     set archived_at = case when $3 then coalesce(archived_at, now()) else null end
     where id = $1 and user_id = $2`,
    [planId, userId, archived]
  )
  return result.rowCount === 1
}

export async function deleteFixPlan(
  userId: string,
  planId: string
): Promise<boolean> {
  if (!UUID.test(planId)) return false
  const result = await pool.query(
    `delete from goodrepo.fix_plan where id = $1 and user_id = $2`,
    [planId, userId]
  )
  return result.rowCount === 1
}

export async function activePlanSummary(userId: string): Promise<{
  count: number
  byRepository: Map<string, { id: string; selected: number }>
}> {
  const { rows } = await pool.query<{
    id: string
    repository_id: string
    selected: number
    total: string
  }>(
    `select id, repository_id, cardinality(selected_signal_ids) as selected,
            count(*) over () as total
     from goodrepo.fix_plan
     where user_id = $1 and archived_at is null
     order by created_at desc, id desc
     limit $2`,
    [userId, MAX_HISTORY]
  )
  const byRepository = new Map<string, { id: string; selected: number }>()
  for (const row of rows)
    if (!byRepository.has(row.repository_id))
      byRepository.set(row.repository_id, {
        id: row.id,
        selected: row.selected,
      })
  return { count: Number(rows[0]?.total ?? 0), byRepository }
}

export function selectedSignals(
  payload: ScanSnapshotPayload,
  selected: readonly SignalId[]
): Set<SignalId> {
  const failed = new Set(failedSignalIds(payload))
  return new Set(selected.filter((id) => failed.has(id)))
}
