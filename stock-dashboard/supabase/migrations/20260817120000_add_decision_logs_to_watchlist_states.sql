alter table public.watchlist_states
add column if not exists decision_logs jsonb not null default '[]'::jsonb;
