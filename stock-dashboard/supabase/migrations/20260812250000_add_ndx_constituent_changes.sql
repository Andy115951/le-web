create table if not exists public.ndx_constituent_changes (
  id bigint generated always as identity primary key,
  snapshot_id bigint not null references public.ndx_constituent_snapshots(id) on delete cascade,
  prior_snapshot_id bigint references public.ndx_constituent_snapshots(id) on delete set null,
  instrument_id bigint not null references public.instruments(id) on delete restrict,
  change_kind text not null,
  previous_weight_percent numeric,
  current_weight_percent numeric,
  captured_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint ndx_constituent_changes_kind_check check (change_kind in ('membership_added', 'membership_removed', 'weight_changed')),
  constraint ndx_constituent_changes_membership_added_check check (
    change_kind <> 'membership_added' or (previous_weight_percent is null and current_weight_percent is not null)
  ),
  constraint ndx_constituent_changes_membership_removed_check check (
    change_kind <> 'membership_removed' or (previous_weight_percent is not null and current_weight_percent is null)
  ),
  constraint ndx_constituent_changes_weight_changed_check check (
    change_kind <> 'weight_changed' or (
      previous_weight_percent is not null
      and current_weight_percent is not null
      and previous_weight_percent <> current_weight_percent
    )
  ),
  constraint ndx_constituent_changes_snapshot_instrument_kind_key unique (snapshot_id, instrument_id, change_kind)
);

create index if not exists ndx_constituent_changes_snapshot_idx
  on public.ndx_constituent_changes (snapshot_id, change_kind);
create index if not exists ndx_constituent_changes_instrument_idx
  on public.ndx_constituent_changes (instrument_id, snapshot_id desc);

revoke all on public.ndx_constituent_changes from anon, authenticated;
grant select, insert, update, delete on public.ndx_constituent_changes to service_role;
grant usage, select on sequence public.ndx_constituent_changes_id_seq to service_role;

alter table public.ndx_constituent_changes enable row level security;
