create schema if not exists goodrepo;

create table if not exists goodrepo.deep_scan_run (
  id         bigint generated always as identity primary key,
  user_id    text references better_auth."user" (id) on delete set null,
  owner      text        not null,
  repo       text        not null,
  commit_sha text        not null,
  created_at timestamptz not null default now(),
  unique (user_id, owner, repo, commit_sha)
);

create index if not exists deep_scan_run_created_at_idx
  on goodrepo.deep_scan_run (created_at desc);

alter table goodrepo.deep_scan_run enable row level security;
