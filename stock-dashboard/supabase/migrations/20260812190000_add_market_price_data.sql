create table if not exists public.instruments (
  id bigint generated always as identity primary key,
  symbol text not null unique,
  display_name text not null,
  exchange text,
  currency text not null default 'USD',
  asset_type text not null,
  instrument_role text not null,
  is_active boolean not null default true,
  source text not null,
  source_as_of date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint instruments_asset_type_check
    check (asset_type in ('equity', 'etf', 'index')),
  constraint instruments_role_check
    check (instrument_role in ('benchmark', 'basket', 'component', 'related-leader'))
);

create table if not exists public.market_days (
  market_date date primary key,
  exchange text not null default 'XNAS',
  is_trading_day boolean not null,
  session_status text not null,
  source text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint market_days_session_status_check
    check (session_status in ('closed', 'holiday'))
);

create table if not exists public.price_bars_daily (
  id bigint generated always as identity primary key,
  instrument_id bigint not null references public.instruments(id) on delete cascade,
  market_date date not null references public.market_days(market_date) on delete restrict,
  open numeric not null,
  high numeric not null,
  low numeric not null,
  close numeric not null,
  adjusted_close numeric,
  volume bigint,
  change_percent numeric,
  source text not null,
  captured_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint price_bars_daily_instrument_date_key
    unique (instrument_id, market_date),
  constraint price_bars_daily_prices_check
    check (
      open > 0
      and high > 0
      and low > 0
      and close > 0
      and (adjusted_close is null or adjusted_close > 0)
      and high >= greatest(open, close, low)
      and low <= least(open, close, high)
      and (volume is null or volume >= 0)
    )
);

create index if not exists price_bars_daily_date_idx
  on public.price_bars_daily (market_date desc, instrument_id);

create index if not exists price_bars_daily_instrument_idx
  on public.price_bars_daily (instrument_id, market_date desc);

insert into public.instruments (
  symbol, display_name, exchange, currency, asset_type, instrument_role, source, source_as_of
)
values
  ('QQQ', 'Invesco QQQ Trust', 'NASDAQ', 'USD', 'etf', 'benchmark', 'Nasdaq NDX Fact Sheet + Yahoo Finance', '2026-06-30'),
  ('MAGS', 'Roundhill Magnificent Seven ETF', 'NASDAQ', 'USD', 'etf', 'basket', 'Nasdaq NDX Fact Sheet + Yahoo Finance', '2026-06-30'),
  ('NVDA', 'NVIDIA', 'NASDAQ', 'USD', 'equity', 'component', 'Nasdaq NDX Fact Sheet', '2026-06-30'),
  ('AAPL', 'Apple', 'NASDAQ', 'USD', 'equity', 'component', 'Nasdaq NDX Fact Sheet', '2026-06-30'),
  ('MU', 'Micron Technology', 'NASDAQ', 'USD', 'equity', 'component', 'Nasdaq NDX Fact Sheet', '2026-06-30'),
  ('MSFT', 'Microsoft', 'NASDAQ', 'USD', 'equity', 'component', 'Nasdaq NDX Fact Sheet', '2026-06-30'),
  ('AMD', 'Advanced Micro Devices', 'NASDAQ', 'USD', 'equity', 'component', 'Nasdaq NDX Fact Sheet', '2026-06-30'),
  ('AMZN', 'Amazon', 'NASDAQ', 'USD', 'equity', 'component', 'Nasdaq NDX Fact Sheet', '2026-06-30'),
  ('TSLA', 'Tesla', 'NASDAQ', 'USD', 'equity', 'component', 'Nasdaq NDX Fact Sheet', '2026-06-30'),
  ('GOOGL', 'Alphabet Class A', 'NASDAQ', 'USD', 'equity', 'component', 'Nasdaq NDX Fact Sheet', '2026-06-30'),
  ('GOOG', 'Alphabet Class C', 'NASDAQ', 'USD', 'equity', 'component', 'Nasdaq NDX Fact Sheet', '2026-06-30'),
  ('INTC', 'Intel', 'NASDAQ', 'USD', 'equity', 'component', 'Nasdaq NDX Fact Sheet', '2026-06-30'),
  ('META', 'Meta Platforms', 'NASDAQ', 'USD', 'equity', 'related-leader', 'Nasdaq NDX Fact Sheet + market radar', '2026-06-30'),
  ('AVGO', 'Broadcom', 'NASDAQ', 'USD', 'equity', 'related-leader', 'Nasdaq NDX Fact Sheet + market radar', '2026-06-30')
on conflict (symbol) do update set
  display_name = excluded.display_name,
  exchange = excluded.exchange,
  currency = excluded.currency,
  asset_type = excluded.asset_type,
  instrument_role = excluded.instrument_role,
  source = excluded.source,
  source_as_of = excluded.source_as_of,
  updated_at = now();

revoke all on public.instruments, public.market_days, public.price_bars_daily from anon, authenticated;
grant select, insert, update on public.instruments, public.market_days, public.price_bars_daily to service_role;
grant usage, select on sequence public.instruments_id_seq, public.price_bars_daily_id_seq to service_role;

alter table public.instruments enable row level security;
alter table public.market_days enable row level security;
alter table public.price_bars_daily enable row level security;
