create table if not exists public.ndx_constituent_snapshots (
  id bigint generated always as identity primary key,
  index_symbol text not null default 'NDX',
  effective_date date not null,
  published_at timestamptz,
  source_url text not null,
  source_id uuid references public.sources(id) on delete set null,
  constituent_count integer not null,
  total_weight_percent numeric not null,
  weight_precision integer not null default 2,
  is_pro_forma boolean not null default false,
  captured_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ndx_constituent_snapshots_index_date_key unique (index_symbol, effective_date),
  constraint ndx_constituent_snapshots_count_check check (constituent_count > 0),
  constraint ndx_constituent_snapshots_weight_check check (total_weight_percent > 95 and total_weight_percent < 105),
  constraint ndx_constituent_snapshots_url_check check (source_url ~ '^https?://')
);

create table if not exists public.ndx_constituent_members (
  snapshot_id bigint not null references public.ndx_constituent_snapshots(id) on delete cascade,
  instrument_id bigint not null references public.instruments(id) on delete cascade,
  security_name text not null,
  weight_percent numeric not null,
  rank integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (snapshot_id, instrument_id),
  constraint ndx_constituent_members_weight_check check (weight_percent >= 0 and weight_percent <= 100),
  constraint ndx_constituent_members_rank_check check (rank > 0),
  constraint ndx_constituent_members_rank_key unique (snapshot_id, rank)
);

create index if not exists ndx_constituent_snapshots_date_idx
  on public.ndx_constituent_snapshots (effective_date desc);
create index if not exists ndx_constituent_members_instrument_idx
  on public.ndx_constituent_members (instrument_id, snapshot_id);

revoke all on public.ndx_constituent_snapshots, public.ndx_constituent_members from anon, authenticated;
grant select, insert, update on public.ndx_constituent_snapshots, public.ndx_constituent_members to service_role;
grant usage, select on sequence public.ndx_constituent_snapshots_id_seq to service_role;

alter table public.ndx_constituent_snapshots enable row level security;
alter table public.ndx_constituent_members enable row level security;

alter table public.ndx_constituent_members
  drop constraint if exists ndx_constituent_members_rank_key;
alter table public.ndx_constituent_members
  add constraint ndx_constituent_members_rank_key
  unique (snapshot_id, rank) deferrable initially deferred;
