-- NDX is stored under the project-facing index symbol. The Yahoo provider mapping to
-- ^NDX lives only in server code, so API inputs and foreign-keyed price history stay stable.
insert into public.instruments (
  symbol, display_name, exchange, currency, asset_type, instrument_role, source, source_as_of
)
values (
  'NDX', 'Nasdaq-100 Index', 'NASDAQ', 'USD', 'index', 'benchmark',
  'Nasdaq-100 Index + Yahoo Finance chart', '2026-09-15'
)
on conflict (symbol) do update set
  display_name = excluded.display_name,
  exchange = excluded.exchange,
  currency = excluded.currency,
  asset_type = excluded.asset_type,
  instrument_role = excluded.instrument_role,
  source = excluded.source,
  source_as_of = excluded.source_as_of,
  updated_at = now();
