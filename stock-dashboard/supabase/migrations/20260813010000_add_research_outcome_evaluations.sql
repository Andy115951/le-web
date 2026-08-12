create table if not exists public.research_outcome_evaluations (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.research_packet_snapshots(id) on delete restrict,
  market_date date not null references public.market_days(market_date) on delete restrict,
  evaluation_version text not null,
  horizon_trading_days integer not null check (horizon_trading_days > 0 and horizon_trading_days <= 60),
  label_version text not null,
  realized_return_percent numeric,
  maximum_drawdown_percent numeric,
  realized_volatility_percent numeric,
  evaluated_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint research_outcome_evaluations_unique_snapshot_version unique (snapshot_id, evaluation_version),
  constraint research_outcome_evaluations_payload_check check (
    realized_return_percent is not null
    or maximum_drawdown_percent is not null
    or realized_volatility_percent is not null
  )
);

create index if not exists research_outcome_evaluations_market_date_idx
  on public.research_outcome_evaluations (market_date desc, evaluated_at desc);

revoke all on public.research_outcome_evaluations from anon, authenticated;
grant select, insert on public.research_outcome_evaluations to service_role;
alter table public.research_outcome_evaluations enable row level security;
