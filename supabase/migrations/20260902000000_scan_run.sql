create table if not exists goodrepo.scan_run (
  id         bigint generated always as identity primary key,
  user_id    text        not null references better_auth."user" (id) on delete cascade,
  owner      text        not null,
  repo       text        not null,
  commit_sha text        not null,
  kind       text        not null check (kind in ('fast', 'deep', 'private')),
  score      int,
  created_at timestamptz not null default now(),
  unique (user_id, owner, repo, commit_sha, kind)
);

create index if not exists scan_run_user_created_at_idx
  on goodrepo.scan_run (user_id, created_at desc);

alter table goodrepo.scan_run enable row level security;
