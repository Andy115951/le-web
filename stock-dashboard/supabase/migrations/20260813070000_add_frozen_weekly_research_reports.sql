create table if not exists public.frozen_weekly_research_reports (
  id uuid primary key default gen_random_uuid(),
  week_start date not null references public.market_days(market_date) on delete restrict,
  report_version text not null,
  report jsonb not null,
  frozen_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint frozen_weekly_research_reports_week_version_unique unique (week_start, report_version),
  constraint frozen_weekly_research_reports_report_object_check check (jsonb_typeof(report) = 'object')
);

create index if not exists frozen_weekly_research_reports_recent_idx
  on public.frozen_weekly_research_reports (week_start desc, frozen_at desc);

revoke all on public.frozen_weekly_research_reports from anon, authenticated;
grant select, insert on public.frozen_weekly_research_reports to service_role;
alter table public.frozen_weekly_research_reports enable row level security;

alter table public.research_task_runs
  drop constraint if exists research_task_runs_kind_check;

alter table public.research_task_runs
  add constraint research_task_runs_kind_check
  check (task_kind in (
    'market_collection',
    'event_attribution',
    'research_input_snapshot',
    'daily_fact_report',
    'weekly_fact_report',
    'model_recap',
    'outcome_evaluation'
  ));
