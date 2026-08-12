create table if not exists public.research_packet_snapshots (
  id uuid primary key default gen_random_uuid(),
  market_date date not null references public.market_days(market_date) on delete restrict,
  packet_contract_version text not null,
  packet_fingerprint text not null,
  packet jsonb not null,
  source_summary jsonb not null default '{}'::jsonb,
  captured_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint research_packet_snapshots_unique_packet unique (market_date, packet_fingerprint),
  constraint research_packet_snapshots_fingerprint_check check (packet_fingerprint ~ '^[a-f0-9]{64}$'),
  constraint research_packet_snapshots_packet_object_check check (jsonb_typeof(packet) = 'object'),
  constraint research_packet_snapshots_summary_object_check check (jsonb_typeof(source_summary) = 'object')
);

create index if not exists research_packet_snapshots_market_date_idx
  on public.research_packet_snapshots (market_date desc, captured_at desc);

revoke all on public.research_packet_snapshots from anon, authenticated;
grant select, insert on public.research_packet_snapshots to service_role;

alter table public.research_packet_snapshots enable row level security;
