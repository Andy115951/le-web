create extension if not exists pgcrypto;

alter table public.nasdaq_market_event_history
  add column if not exists event_time timestamptz,
  add column if not exists available_at timestamptz;

update public.nasdaq_market_event_history
set available_at = captured_at
where available_at is null;

create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  source_kind text not null,
  provider text not null,
  title text not null,
  canonical_url text not null,
  content_fingerprint text not null,
  published_at timestamptz,
  available_at timestamptz,
  captured_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sources_canonical_url_key unique (canonical_url),
  constraint sources_content_fingerprint_key unique (content_fingerprint),
  constraint sources_kind_check
    check (source_kind in ('market_data', 'news', 'official', 'filing', 'macro', 'company_ir', 'index_provider')),
  constraint sources_url_check
    check (canonical_url ~ '^https?://')
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  market_date date not null references public.market_days(market_date) on delete restrict,
  event_time timestamptz,
  available_at timestamptz not null,
  captured_at timestamptz not null,
  event_type text not null,
  title text not null,
  summary text not null default '',
  sentiment text not null default 'unknown',
  impact_scope text not null default 'unknown',
  impact_level text not null default 'unknown',
  confidence numeric not null default 0,
  tickers jsonb not null default '[]'::jsonb,
  themes jsonb not null default '[]'::jsonb,
  attributes jsonb not null default '{}'::jsonb,
  extractor_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_sentiment_check
    check (sentiment in ('positive', 'negative', 'neutral', 'mixed', 'unknown')),
  constraint events_impact_scope_check
    check (impact_scope in ('market', 'sector', 'company', 'instrument', 'unknown')),
  constraint events_impact_level_check
    check (impact_level in ('low', 'medium', 'high', 'unknown')),
  constraint events_confidence_check
    check (confidence >= 0 and confidence <= 1),
  constraint events_tickers_array_check
    check (jsonb_typeof(tickers) = 'array'),
  constraint events_themes_array_check
    check (jsonb_typeof(themes) = 'array')
);

create table if not exists public.event_sources (
  event_id uuid not null references public.events(id) on delete cascade,
  source_id uuid not null references public.sources(id) on delete cascade,
  relation_type text not null,
  created_at timestamptz not null default now(),
  primary key (event_id, source_id),
  constraint event_sources_relation_check
    check (relation_type in ('primary', 'evidence', 'context'))
);

create table if not exists public.event_entities (
  event_id uuid not null references public.events(id) on delete cascade,
  instrument_id bigint not null references public.instruments(id) on delete cascade,
  entity_role text not null,
  created_at timestamptz not null default now(),
  primary key (event_id, instrument_id),
  constraint event_entities_role_check
    check (entity_role in ('primary', 'benchmark', 'related'))
);

create index if not exists events_market_date_idx on public.events (market_date desc, event_type);
create index if not exists sources_published_at_idx on public.sources (published_at desc nulls last);
create index if not exists event_sources_source_idx on public.event_sources (source_id, event_id);
create index if not exists event_entities_instrument_idx on public.event_entities (instrument_id, event_id);

revoke all on public.sources, public.events, public.event_sources, public.event_entities from anon, authenticated;
grant select, insert, update on public.sources, public.events, public.event_sources, public.event_entities to service_role;

alter table public.sources enable row level security;
alter table public.events enable row level security;
alter table public.event_sources enable row level security;
alter table public.event_entities enable row level security;

update public.events
set event_time = null, updated_at = now()
where event_time = '1970-01-01T00:00:00Z'::timestamptz;

update public.sources
set published_at = null, updated_at = now()
where published_at = '1970-01-01T00:00:00Z'::timestamptz;

insert into public.sources (
  source_kind, provider, title, canonical_url, content_fingerprint, captured_at, metadata
)
select distinct
  'market_data',
  'Yahoo Finance',
  history.symbol || ' market data',
  'https://finance.yahoo.com/quote/' || history.symbol || '/history/',
  encode(digest('https://finance.yahoo.com/quote/' || history.symbol || '/history/', 'sha256'), 'hex'),
  history.captured_at,
  jsonb_build_object('symbol', history.symbol, 'legacyBackfill', true)
from public.nasdaq_market_event_history history
on conflict (canonical_url) do update set
  captured_at = greatest(public.sources.captured_at, excluded.captured_at),
  updated_at = now();

insert into public.sources (
  source_kind, provider, title, canonical_url, content_fingerprint,
  published_at, available_at, captured_at, metadata
)
select distinct on (news_item->>'url')
  'news',
  coalesce(nullif(news_item->>'publisher', ''), 'Unknown publisher'),
  coalesce(nullif(news_item->>'title', ''), 'Untitled source'),
  news_item->>'url',
  encode(digest(news_item->>'url', 'sha256'), 'hex'),
  nullif(news_item->>'publishedAt', '')::timestamptz,
  history.captured_at,
  history.captured_at,
  jsonb_build_object('legacyBackfill', true)
from public.nasdaq_market_event_history history
cross join lateral jsonb_array_elements(history.news) as news_item
where coalesce(news_item->>'url', '') ~ '^https?://'
order by news_item->>'url', history.captured_at desc
on conflict (canonical_url) do update set
  title = excluded.title,
  provider = excluded.provider,
  published_at = coalesce(excluded.published_at, public.sources.published_at),
  captured_at = greatest(public.sources.captured_at, excluded.captured_at),
  updated_at = now();

insert into public.events (
  event_key, market_date, event_time, available_at, captured_at, event_type,
  title, summary, sentiment, impact_scope, impact_level, confidence,
  tickers, themes, attributes, extractor_version
)
select
  'market-move:' || history.market_date || ':' || history.symbol || ':v1',
  history.market_date,
  history.event_time,
  coalesce(history.available_at, history.captured_at),
  history.captured_at,
  'market_move_attribution',
  history.symbol || ' daily market move',
  history.summary,
  'unknown',
  case when history.symbol = 'QQQ' then 'market' else 'instrument' end,
  case
    when abs(coalesce(history.change_percent, 0)) >= 2 then 'high'
    when abs(coalesce(history.change_percent, 0)) >= 0.75 then 'medium'
    else 'low'
  end,
  case history.confidence when 'high' then 0.85 when 'medium' then 0.65 else 0.35 end,
  jsonb_build_array(history.symbol),
  '[]'::jsonb,
  jsonb_build_object(
    'changePercent', history.change_percent,
    'benchmarkChangePercent', history.benchmark_change_percent,
    'driverType', history.driver_type,
    'reasons', history.reasons,
    'legacyBackfill', true
  ),
  'market-attribution-rules-v1'
from public.nasdaq_market_event_history history
join public.market_days day on day.market_date = history.market_date
on conflict (event_key) do update set
  summary = excluded.summary,
  available_at = excluded.available_at,
  captured_at = excluded.captured_at,
  impact_level = excluded.impact_level,
  confidence = excluded.confidence,
  attributes = excluded.attributes,
  updated_at = now();

insert into public.event_sources (event_id, source_id, relation_type)
select event.id, source.id, 'primary'
from public.nasdaq_market_event_history history
join public.events event
  on event.event_key = 'market-move:' || history.market_date || ':' || history.symbol || ':v1'
join public.sources source
  on source.canonical_url = 'https://finance.yahoo.com/quote/' || history.symbol || '/history/'
on conflict (event_id, source_id) do update set relation_type = excluded.relation_type;

insert into public.event_sources (event_id, source_id, relation_type)
select distinct event.id, source.id, 'evidence'
from public.nasdaq_market_event_history history
cross join lateral jsonb_array_elements(history.news) as news_item
join public.events event
  on event.event_key = 'market-move:' || history.market_date || ':' || history.symbol || ':v1'
join public.sources source on source.canonical_url = news_item->>'url'
where coalesce(news_item->>'url', '') ~ '^https?://'
on conflict (event_id, source_id) do update set relation_type = excluded.relation_type;

insert into public.event_entities (event_id, instrument_id, entity_role)
select event.id, instrument.id, 'primary'
from public.nasdaq_market_event_history history
join public.events event
  on event.event_key = 'market-move:' || history.market_date || ':' || history.symbol || ':v1'
join public.instruments instrument on instrument.symbol = history.symbol
on conflict (event_id, instrument_id) do update set entity_role = excluded.entity_role;

insert into public.event_entities (event_id, instrument_id, entity_role)
select event.id, benchmark.id, 'benchmark'
from public.nasdaq_market_event_history history
join public.events event
  on event.event_key = 'market-move:' || history.market_date || ':' || history.symbol || ':v1'
join public.instruments benchmark on benchmark.symbol = 'QQQ'
where history.symbol <> 'QQQ'
on conflict (event_id, instrument_id) do update set entity_role = excluded.entity_role;
