create table if not exists public.research_narrative_audits (
  id uuid primary key default gen_random_uuid(),
  market_date date not null references public.market_days(market_date) on delete restrict,
  packet_contract_version text not null,
  packet_fingerprint text not null,
  narrative_contract_version text,
  output_fingerprint text not null,
  provider text,
  model text,
  status text not null,
  narrative jsonb not null default '{}'::jsonb,
  validation_errors jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint research_narrative_audits_status_check check (status in ('accepted', 'rejected')),
  constraint research_narrative_audits_packet_fingerprint_check check (packet_fingerprint ~ '^[a-f0-9]{64}$'),
  constraint research_narrative_audits_output_fingerprint_check check (output_fingerprint ~ '^[a-f0-9]{64}$'),
  constraint research_narrative_audits_errors_array_check check (jsonb_typeof(validation_errors) = 'array')
);

create index if not exists research_narrative_audits_market_date_idx
  on public.research_narrative_audits (market_date desc, created_at desc);
create index if not exists research_narrative_audits_status_idx
  on public.research_narrative_audits (status, created_at desc);

revoke all on public.research_narrative_audits from anon, authenticated;
grant select, insert on public.research_narrative_audits to service_role;

alter table public.research_narrative_audits enable row level security;
