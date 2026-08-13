create table if not exists public.event_rule_labels (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  label_version text not null,
  input_fingerprint text not null,
  suggested_status text not null,
  requires_review boolean not null,
  flags jsonb not null default '[]'::jsonb,
  computed_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint event_rule_labels_version_input_key unique (event_id, label_version, input_fingerprint),
  constraint event_rule_labels_status_check check (suggested_status in ('accepted', 'needs_attention')),
  constraint event_rule_labels_flags_array_check check (jsonb_typeof(flags) = 'array')
);

create index if not exists event_rule_labels_event_computed_idx
  on public.event_rule_labels (event_id, computed_at desc);
create index if not exists event_rule_labels_computed_idx
  on public.event_rule_labels (computed_at desc);

revoke all on public.event_rule_labels from anon, authenticated;
grant select, insert on public.event_rule_labels to service_role;
alter table public.event_rule_labels enable row level security;

alter table public.research_task_runs
  drop constraint if exists research_task_runs_kind_check;

alter table public.research_task_runs
  add constraint research_task_runs_kind_check
  check (task_kind in (
    'market_collection',
    'event_attribution',
    'event_labeling',
    'research_input_snapshot',
    'daily_fact_report',
    'weekly_fact_report',
    'model_recap',
    'outcome_evaluation'
  ));
