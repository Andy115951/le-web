create table if not exists public.model_gateway_compatibility_audits (
  id uuid primary key default gen_random_uuid(),
  probe_version text not null,
  provider text not null,
  model text not null,
  status text not null,
  completion_status text,
  output_fingerprint text,
  validation_errors jsonb not null default '[]'::jsonb,
  latency_ms integer,
  requested_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint model_gateway_compatibility_unique_probe unique (probe_version, provider, model),
  constraint model_gateway_compatibility_status_check check (status in ('pending', 'accepted', 'rejected')),
  constraint model_gateway_compatibility_errors_array_check check (jsonb_typeof(validation_errors) = 'array'),
  constraint model_gateway_compatibility_latency_check check (latency_ms is null or latency_ms >= 0)
);

create index if not exists model_gateway_compatibility_created_idx
  on public.model_gateway_compatibility_audits (created_at desc);

revoke all on public.model_gateway_compatibility_audits from anon, authenticated;
grant select, insert, update on public.model_gateway_compatibility_audits to service_role;
alter table public.model_gateway_compatibility_audits enable row level security;
