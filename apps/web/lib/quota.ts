import { pool } from "@/lib/db"

export const DAILY_RUNS_PER_ACCOUNT: number = 5

const DEFAULT_MONTHLY_RUNS = 700

export function parseCeiling(raw: string | undefined): number | null {
  if (raw === undefined || raw.trim() === "") return null
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed < 0) return null
  return parsed
}

const configured = parseCeiling(process.env.GOODREPO_MONTHLY_DEEP_SCANS)

if (configured === null && process.env.GOODREPO_MONTHLY_DEEP_SCANS) {
  console.warn(
    `GOODREPO_MONTHLY_DEEP_SCANS is not a whole count ("${process.env.GOODREPO_MONTHLY_DEEP_SCANS}"). Using ${DEFAULT_MONTHLY_RUNS}.`
  )
}

export const MONTHLY_RUNS_TOTAL: number = configured ?? DEFAULT_MONTHLY_RUNS

export const RUN_COST_USD = 0.038

export type QuotaRefusal = "daily" | "monthly"

export type QuotaClaim =
  { allowed: true } | { allowed: false; reason: QuotaRefusal }

export type RunCounts = {
  monthRuns: number
  dayRuns: number
  alreadyRan: boolean
}

export function decideClaim(counts: RunCounts): QuotaClaim {
  if (counts.alreadyRan) return { allowed: true }
  if (counts.monthRuns >= MONTHLY_RUNS_TOTAL) {
    return { allowed: false, reason: "monthly" }
  }
  if (counts.dayRuns >= DAILY_RUNS_PER_ACCOUNT) {
    return { allowed: false, reason: "daily" }
  }
  return { allowed: true }
}

type CountRow = { month_runs: string; day_runs: string; already: string }

const CLAIM_LOCK = 20260901

export async function claimDeepScan(
  userId: string,
  owner: string,
  repo: string,
  commitSha: string
): Promise<QuotaClaim> {
  const client = await pool.connect()
  try {
    await client.query("begin")
    await client.query("select pg_advisory_xact_lock($1)", [CLAIM_LOCK])

    const { rows } = await client.query<CountRow>(
      `select
         count(*) filter (
           where created_at >= date_trunc('month', now() at time zone 'utc')
         ) as month_runs,
         count(*) filter (
           where user_id = $1 and created_at > now() - interval '1 day'
         ) as day_runs,
         count(*) filter (
           where user_id = $1 and owner = $2 and repo = $3 and commit_sha = $4
         ) as already
       from goodrepo.deep_scan_run`,
      [userId, owner, repo, commitSha]
    )

    const row = rows[0]
    if (!row) throw new Error("Quota query returned no row.")

    const alreadyRan = Number(row.already) > 0
    const claim = decideClaim({
      monthRuns: Number(row.month_runs),
      dayRuns: Number(row.day_runs),
      alreadyRan,
    })

    if (claim.allowed && !alreadyRan) {
      await client.query(
        `insert into goodrepo.deep_scan_run (user_id, owner, repo, commit_sha)
         values ($1, $2, $3, $4)
         on conflict do nothing`,
        [userId, owner, repo, commitSha]
      )
    }

    await client.query("commit")
    return claim
  } catch (error) {
    await client.query("rollback")
    throw error
  } finally {
    client.release()
  }
}

export async function deepRunsToday(userId: string): Promise<number> {
  const { rows } = await pool.query<{ runs: string }>(
    `select count(*) as runs
     from goodrepo.deep_scan_run
     where user_id = $1 and created_at > now() - interval '1 day'`,
    [userId]
  )
  return Number(rows[0]?.runs ?? 0)
}
