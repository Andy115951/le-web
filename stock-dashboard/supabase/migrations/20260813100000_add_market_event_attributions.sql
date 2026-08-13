create table if not exists public.market_event_attributions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  market_date date not null references public.market_days(market_date),
  attribution_version text not null,
  input_fingerprint text not null,
  classification text not null,
  confidence numeric(4,3) not null,
  hypothesis_code text not null,
  primary_source_count integer not null default 0,
  evidence_source_count integer not null default 0,
  counter_evidence_count integer not null default 0,
  computed_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint market_event_attributions_version_input_key
    unique (event_id, attribution_version, input_fingerprint),
  constraint market_event_attributions_classification_check
    check (classification in ('market', 'company', 'mixed', 'insufficient_evidence')),
  constraint market_event_attributions_confidence_check
    check (confidence >= 0 and confidence <= 1),
  constraint market_event_attributions_primary_source_count_check
    check (primary_source_count >= 0),
  constraint market_event_attributions_evidence_source_count_check
    check (evidence_source_count >= 0),
  constraint market_event_attributions_counter_evidence_count_check
    check (counter_evidence_count >= 0)
);

create index if not exists market_event_attributions_market_date_idx
  on public.market_event_attributions (market_date desc, computed_at desc);
create index if not exists market_event_attributions_event_id_idx
  on public.market_event_attributions (event_id, computed_at desc);

revoke all on public.market_event_attributions from anon, authenticated;
grant select, insert on public.market_event_attributions to service_role;

alter table public.market_event_attributions enable row level security;
