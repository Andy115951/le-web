create table if not exists public.watchlist_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  items jsonb not null default '[]'::jsonb,
  preferences jsonb not null default '{}'::jsonb,
  us_peaks jsonb not null default '{}'::jsonb,
  market_events jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.market_event_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  market_date date not null,
  symbol text not null,
  display_name text not null,
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
  constraint market_event_history_user_date_symbol_key
    unique (user_id, market_date, symbol),
  constraint market_event_history_driver_type_check
    check (driver_type in ('market', 'company', 'mixed', 'unclear')),
  constraint market_event_history_confidence_check
    check (confidence in ('high', 'medium', 'low'))
);

create index if not exists market_event_history_user_date_idx
  on public.market_event_history (user_id, market_date desc);

grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on public.watchlist_states
  to authenticated, service_role;
grant select, insert, update, delete on public.market_event_history
  to authenticated, service_role;
grant usage, select on sequence public.market_event_history_id_seq
  to authenticated, service_role;

alter table public.watchlist_states enable row level security;
alter table public.market_event_history enable row level security;

drop policy if exists "watchlist_select_own" on public.watchlist_states;
create policy "watchlist_select_own"
  on public.watchlist_states
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "watchlist_insert_own" on public.watchlist_states;
create policy "watchlist_insert_own"
  on public.watchlist_states
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "watchlist_update_own" on public.watchlist_states;
create policy "watchlist_update_own"
  on public.watchlist_states
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "market_history_select_own" on public.market_event_history;
create policy "market_history_select_own"
  on public.market_event_history
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "market_history_insert_own" on public.market_event_history;
create policy "market_history_insert_own"
  on public.market_event_history
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "market_history_update_own" on public.market_event_history;
create policy "market_history_update_own"
  on public.market_event_history
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
