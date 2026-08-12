create table if not exists public.research_task_runs (
  id uuid primary key default gen_random_uuid(),
  capture_run_id uuid not null references public.market_capture_runs(id) on delete cascade,
  market_date date not null references public.market_days(market_date) on delete restrict,
  task_kind text not null,
  task_version text not null,
  status text not null,
  attempt integer not null default 1,
  failure_code text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint research_task_runs_kind_check check (task_kind in ('research_input_snapshot', 'daily_fact_report', 'model_recap', 'outcome_evaluation')),
  constraint research_task_runs_status_check check (status in ('succeeded', 'skipped', 'failed', 'disabled')),
  constraint research_task_runs_attempt_check check (attempt > 0),
  constraint research_task_runs_failure_code_check check (failure_code is null or failure_code in ('task_failed')),
  constraint research_task_runs_details_object_check check (jsonb_typeof(details) = 'object')
);

create index if not exists research_task_runs_recent_idx
  on public.research_task_runs (created_at desc);
create index if not exists research_task_runs_task_kind_idx
  on public.research_task_runs (task_kind, market_date desc, created_at desc);

revoke all on public.research_task_runs from anon, authenticated;
grant select, insert on public.research_task_runs to service_role;
alter table public.research_task_runs enable row level security;
