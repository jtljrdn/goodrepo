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

type HistoryRow = {
  repo_count: string
  scan_count: string
  average: string | null
  owner: string | null
  repo: string | null
  commit_sha: string | null
  kind: ScanKind | null
  score: number | null
  created_at: Date | null
}

// Usage counts every scan, the list only the newest per repository, so both
// read the same rows. One query, not two.
export async function historyFor(
  userId: string,
  limit = 50
): Promise<{ usage: Usage; repos: ScannedRepo[] }> {
  const { rows } = await pool.query<HistoryRow>(
    `with mine as (
       select * from goodrepo.scan_run where user_id = $1
     ),
     usage as (
       select
         count(distinct (owner, repo)) as repo_count,
         count(*) as scan_count,
         avg(score) filter (where score is not null) as average
       from mine
     ),
     latest as (
       select owner, repo, commit_sha, kind, score, created_at
       from (
         select distinct on (owner, repo)
           owner, repo, commit_sha, kind, score, created_at
         from mine
         order by owner, repo, created_at desc
       ) newest
       order by created_at desc
       limit $2
     )
     select u.repo_count, u.scan_count, u.average,
            l.owner, l.repo, l.commit_sha, l.kind, l.score, l.created_at
     from usage u
     left join latest l on true
     order by l.created_at desc`,
    [userId, limit]
  )

  const first = rows[0]
  return {
    usage: {
      repos: Number(first?.repo_count ?? 0),
      scans: Number(first?.scan_count ?? 0),
      averageScore:
        first?.average == null ? null : Math.round(Number(first.average)),
    },
    repos: rows.flatMap((row) =>
      row.owner === null ||
      row.repo === null ||
      row.commit_sha === null ||
      row.kind === null ||
      row.created_at === null
        ? []
        : [
            {
              owner: row.owner,
              repo: row.repo,
              commitSha: row.commit_sha,
              kind: row.kind,
              score: row.score,
              scannedAt: row.created_at,
            },
          ]
    ),
  }
}
