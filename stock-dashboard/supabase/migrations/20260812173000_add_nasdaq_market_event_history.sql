create table if not exists public.nasdaq_market_event_history (
  id bigint generated always as identity primary key,
  market_date date not null,
  symbol text not null,
  display_name text not null,
  instrument_role text not null default 'component',
  universe_as_of date,
  change_percent numeric,
  benchmark_change_percent numeric,
  driver_type text not null default 'unclear',
  confidence text not null default 'low',
  summary text not null default '',
  reasons jsonb not null default '[]'::jsonb,
  news jsonb not null default '[]'::jsonb,
  captured_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nasdaq_market_event_history_date_symbol_key
    unique (market_date, symbol),
  constraint nasdaq_market_event_history_role_check
    check (instrument_role in ('benchmark', 'basket', 'component', 'related-leader')),
  constraint nasdaq_market_event_history_driver_type_check
    check (driver_type in ('market', 'company', 'mixed', 'unclear')),
  constraint nasdaq_market_event_history_confidence_check
    check (confidence in ('high', 'medium', 'low'))
);

create index if not exists nasdaq_market_event_history_date_idx
  on public.nasdaq_market_event_history (market_date desc, symbol);

revoke all on public.nasdaq_market_event_history from anon, authenticated;
grant select, insert, update on public.nasdaq_market_event_history to service_role;
grant usage, select on sequence public.nasdaq_market_event_history_id_seq to service_role;

alter table public.nasdaq_market_event_history enable row level security;
