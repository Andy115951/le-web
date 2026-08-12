create table if not exists public.market_capture_runs (
  id uuid primary key,
  trigger_type text not null,
  status text not null,
  market_date date,
  started_at timestamptz not null,
  finished_at timestamptz,
  duration_ms integer,
  source_users integer not null default 0,
  processed_users integer not null default 0,
  saved_events integer not null default 0,
  skipped_users integer not null default 0,
  failed_users integer not null default 0,
  error_message text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint market_capture_runs_trigger_type_check
    check (trigger_type in ('cron', 'manual')),
  constraint market_capture_runs_status_check
    check (status in ('running', 'succeeded', 'partial', 'skipped', 'failed')),
  constraint market_capture_runs_counts_check
    check (
      source_users >= 0
      and processed_users >= 0
      and saved_events >= 0
      and skipped_users >= 0
      and failed_users >= 0
    )
);

create index if not exists market_capture_runs_started_at_idx
  on public.market_capture_runs (started_at desc);

revoke all on public.market_capture_runs from anon, authenticated;
grant select, insert, update on public.market_capture_runs to service_role;

alter table public.market_capture_runs enable row level security;

