create table if not exists public.market_forward_labels (
  id bigint generated always as identity primary key,
  instrument_id bigint not null references public.instruments(id) on delete cascade,
  market_date date not null references public.market_days(market_date) on delete restrict,
  return_1d_percent numeric,
  return_3d_percent numeric,
  return_5d_percent numeric,
  return_20d_percent numeric,
  max_drawdown_20d_percent numeric,
  realized_volatility_20d_percent numeric,
  price_basis text not null default 'adjusted_close',
  horizon_unit text not null default 'trading_day',
  label_version text not null,
  computed_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint market_forward_labels_instrument_date_key
    unique (instrument_id, market_date),
  constraint market_forward_labels_drawdown_check
    check (max_drawdown_20d_percent is null or max_drawdown_20d_percent <= 0),
  constraint market_forward_labels_volatility_check
    check (realized_volatility_20d_percent is null or realized_volatility_20d_percent >= 0),
  constraint market_forward_labels_price_basis_check
    check (price_basis = 'adjusted_close'),
  constraint market_forward_labels_horizon_unit_check
    check (horizon_unit = 'trading_day')
);

create index if not exists market_forward_labels_date_idx
  on public.market_forward_labels (market_date desc, instrument_id);

create index if not exists market_forward_labels_instrument_idx
  on public.market_forward_labels (instrument_id, market_date desc);

revoke all on public.market_forward_labels from anon, authenticated;
grant select, insert, update on public.market_forward_labels to service_role;
grant usage, select on sequence public.market_forward_labels_id_seq to service_role;

alter table public.market_forward_labels enable row level security;
