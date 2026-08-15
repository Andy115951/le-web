create table if not exists public.earnings_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  instrument_id bigint not null references public.instruments(id) on delete restrict,
  market_date date not null,
  scheduled_at timestamptz,
  available_at timestamptz not null,
  captured_at timestamptz not null,
  session text not null default 'unknown',
  event_status text not null default 'scheduled',
  fiscal_period text,
  eps_estimate numeric,
  eps_actual numeric,
  revenue_estimate numeric,
  revenue_actual numeric,
  source_id uuid not null references public.sources(id) on delete restrict,
  collector_version text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint earnings_events_session_check check (session in ('before_market', 'after_market', 'during_market', 'unknown')),
  constraint earnings_events_status_check check (event_status in ('scheduled', 'reported', 'cancelled')),
  constraint earnings_events_fiscal_period_check check (fiscal_period is null or length(fiscal_period) <= 64)
);

create index if not exists earnings_events_market_date_idx
  on public.earnings_events (market_date asc, event_status, session);
create index if not exists earnings_events_instrument_date_idx
  on public.earnings_events (instrument_id, market_date desc);

revoke all on public.earnings_events from anon, authenticated;
grant select, insert, update on public.earnings_events to service_role;

alter table public.earnings_events enable row level security;
