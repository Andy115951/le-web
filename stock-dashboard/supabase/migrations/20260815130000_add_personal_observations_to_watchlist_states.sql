alter table public.watchlist_states
add column if not exists observations jsonb not null default '[]'::jsonb;
