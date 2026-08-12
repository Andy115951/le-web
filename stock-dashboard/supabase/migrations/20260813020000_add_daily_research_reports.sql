create table if not exists public.daily_research_reports (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.research_packet_snapshots(id) on delete restrict,
  market_date date not null references public.market_days(market_date) on delete restrict,
  report_version text not null,
  report jsonb not null,
  created_at timestamptz not null default now(),
  constraint daily_research_reports_unique_snapshot_version unique (snapshot_id, report_version),
  constraint daily_research_reports_report_object_check check (jsonb_typeof(report) = 'object')
);

create index if not exists daily_research_reports_market_date_idx
  on public.daily_research_reports (market_date desc, created_at desc);

revoke all on public.daily_research_reports from anon, authenticated;
grant select, insert on public.daily_research_reports to service_role;
alter table public.daily_research_reports enable row level security;
