create table goodrepo.scan_snapshot (
  id                      uuid        primary key default gen_random_uuid(),
  user_id                 text        not null references better_auth."user" (id) on delete cascade,
  repository_id           text        not null check (length(repository_id) between 1 and 64),
  owner                   text        not null check (length(owner) between 1 and 100),
  repo                    text        not null check (length(repo) between 1 and 100),
  commit_sha              text        not null check (commit_sha ~ '^[0-9a-f]{40}$'),
  mode                    text        not null check (mode in ('public', 'private')),
  analysis_version        text        not null check (length(analysis_version) between 1 and 64),
  snapshot_schema_version int         not null check (snapshot_schema_version > 0),
  payload                 jsonb       not null check (pg_column_size(payload) <= 131072),
  observed_at             timestamptz not null default now(),
  unique (user_id, repository_id, commit_sha, mode, analysis_version),
  unique (id, user_id, repository_id, mode, analysis_version)
);

create index scan_snapshot_baseline_idx
  on goodrepo.scan_snapshot
  (user_id, repository_id, mode, analysis_version, observed_at desc, id desc);

create table goodrepo.fix_plan (
  id                   uuid        primary key default gen_random_uuid(),
  user_id              text        not null references better_auth."user" (id) on delete cascade,
  baseline_snapshot_id uuid        not null,
  repository_id        text        not null,
  mode                 text        not null,
  analysis_version     text        not null,
  selected_signal_ids  text[]      not null check (
    cardinality(selected_signal_ids) between 1 and 40
  ),
  request_id            uuid        not null,
  created_at            timestamptz not null default now(),
  archived_at           timestamptz,
  unique (user_id, request_id),
  unique (id, user_id, repository_id, mode, analysis_version),
  foreign key (
    baseline_snapshot_id, user_id, repository_id, mode, analysis_version
  ) references goodrepo.scan_snapshot (
    id, user_id, repository_id, mode, analysis_version
  )
);

create index fix_plan_user_active_idx
  on goodrepo.fix_plan (user_id, created_at desc, id desc)
  where archived_at is null;

create index fix_plan_baseline_snapshot_idx
  on goodrepo.fix_plan (baseline_snapshot_id);

create table goodrepo.fix_verification (
  id                 bigint generated always as identity primary key,
  user_id            text        not null,
  plan_id            uuid        not null,
  repository_id      text        not null,
  mode               text        not null,
  analysis_version   text        not null,
  target_snapshot_id uuid        not null,
  verified_at        timestamptz not null default now(),
  unique (plan_id, target_snapshot_id),
  foreign key (plan_id, user_id, repository_id, mode, analysis_version)
    references goodrepo.fix_plan
      (id, user_id, repository_id, mode, analysis_version)
    on delete cascade,
  foreign key (
    target_snapshot_id, user_id, repository_id, mode, analysis_version
  ) references goodrepo.scan_snapshot (
    id, user_id, repository_id, mode, analysis_version
  )
);

create index fix_verification_plan_verified_idx
  on goodrepo.fix_verification (plan_id, verified_at desc, id desc);

create index fix_verification_target_snapshot_idx
  on goodrepo.fix_verification (target_snapshot_id);

alter table goodrepo.scan_snapshot enable row level security;
alter table goodrepo.fix_plan enable row level security;
alter table goodrepo.fix_verification enable row level security;

revoke all on goodrepo.scan_snapshot from anon, authenticated;
revoke all on goodrepo.fix_plan from anon, authenticated;
revoke all on goodrepo.fix_verification from anon, authenticated;
revoke all on sequence goodrepo.fix_verification_id_seq from anon, authenticated;
