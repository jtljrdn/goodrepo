import { pool } from "@/lib/db"

export type ScanKind = "fast" | "deep" | "private"

export type ScannedRepo = {
  owner: string
  repo: string
  commitSha: string
  kind: ScanKind
  score: number | null
  scannedAt: Date
}

export type Usage = {
  repos: number
  scans: number
  averageScore: number | null
}

export type ScanRecord = {
  owner: string
  repo: string
  commitSha: string
  kind: ScanKind
  score: number | null
}

// Deliberately swallows its errors. This runs as a side effect of rendering a report, and a
// history row is worth less than the report itself, so a database that is down or a schema
// that has not been migrated yet must not take the page with it.
export async function recordScan(
  userId: string,
  scan: ScanRecord
): Promise<void> {
  try {
    await pool.query(
      `insert into goodrepo.scan_run
         (user_id, owner, repo, commit_sha, kind, score)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (user_id, owner, repo, commit_sha, kind) do nothing`,
      [userId, scan.owner, scan.repo, scan.commitSha, scan.kind, scan.score]
    )
  } catch (error) {
    console.warn("Could not record scan history.", error)
  }
}

type RepoRow = {
  owner: string
  repo: string
  commit_sha: string
  kind: ScanKind
  score: number | null
  created_at: Date
}

// One entry per repository, showing the newest commit that account scanned. Re-scanning at a
// new commit replaces the entry rather than stacking beside it.
export async function recentRepos(
  userId: string,
  limit = 50
): Promise<ScannedRepo[]> {
  const { rows } = await pool.query<RepoRow>(
    `select owner, repo, commit_sha, kind, score, created_at
     from (
       select distinct on (owner, repo)
         owner, repo, commit_sha, kind, score, created_at
       from goodrepo.scan_run
       where user_id = $1
       order by owner, repo, created_at desc
     ) latest
     order by created_at desc
     limit $2`,
    [userId, limit]
  )

  return rows.map((row) => ({
    owner: row.owner,
    repo: row.repo,
    commitSha: row.commit_sha,
    kind: row.kind,
    score: row.score,
    scannedAt: row.created_at,
  }))
}

type UsageRow = { repos: string; scans: string; average: string | null }

export async function usageFor(userId: string): Promise<Usage> {
  const { rows } = await pool.query<UsageRow>(
    `select
       count(distinct (owner, repo)) as repos,
       count(*) as scans,
       avg(score) filter (where score is not null) as average
     from goodrepo.scan_run
     where user_id = $1`,
    [userId]
  )

  const row = rows[0]
  return {
    repos: Number(row?.repos ?? 0),
    scans: Number(row?.scans ?? 0),
    averageScore: row?.average == null ? null : Math.round(Number(row.average)),
  }
}
