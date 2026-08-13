alter table public.research_packet_snapshots
  add column if not exists capture_run_id uuid references public.market_capture_runs(id) on delete set null;

create index if not exists research_packet_snapshots_capture_run_idx
  on public.research_packet_snapshots (capture_run_id)
  where capture_run_id is not null;
