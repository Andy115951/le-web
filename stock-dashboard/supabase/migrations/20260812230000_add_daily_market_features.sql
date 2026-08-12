create table if not exists public.daily_market_features (
  id bigint generated always as identity primary key,
  instrument_id bigint not null references public.instruments(id) on delete cascade,
  market_date date not null references public.market_days(market_date) on delete restrict,
  feature_version text not null,
  feature_as_of timestamptz not null,
  return_1d_percent numeric,
  return_5d_percent numeric,
  return_20d_percent numeric,
  gap_percent numeric,
  trailing_volatility_20d_percent numeric,
  trailing_drawdown_20d_percent numeric,
  volume_ratio_20d_percent numeric,
  available_event_count integer not null default 0,
  high_impact_event_count integer not null default 0,
  medium_impact_event_count integer not null default 0,
  low_impact_event_count integer not null default 0,
  event_ticker_count integer not null default 0,
  event_type_counts jsonb not null default '{}'::jsonb,
  input_price_source text not null,
  input_price_captured_at timestamptz,
  input_event_max_available_at timestamptz,
  computed_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_market_features_instrument_date_version_key
    unique (instrument_id, market_date, feature_version),
  constraint daily_market_features_drawdown_check
    check (trailing_drawdown_20d_percent is null or trailing_drawdown_20d_percent <= 0),
  constraint daily_market_features_volatility_check
    check (trailing_volatility_20d_percent is null or trailing_volatility_20d_percent >= 0),
  constraint daily_market_features_event_counts_check
    check (
      available_event_count >= 0
      and high_impact_event_count >= 0
      and medium_impact_event_count >= 0
      and low_impact_event_count >= 0
      and event_ticker_count >= 0
    ),
  constraint daily_market_features_event_type_counts_object_check
    check (jsonb_typeof(event_type_counts) = 'object')
);

create index if not exists daily_market_features_instrument_date_idx
  on public.daily_market_features (instrument_id, market_date desc);

create index if not exists daily_market_features_date_idx
  on public.daily_market_features (market_date desc, instrument_id);

revoke all on public.daily_market_features from anon, authenticated;
grant select, insert, update on public.daily_market_features to service_role;
grant usage, select on sequence public.daily_market_features_id_seq to service_role;

alter table public.daily_market_features enable row level security;
