-- Append-only task rows preserve timing and retry telemetry without persisting raw errors.
alter table public.research_task_runs
  add column if not exists queued_at timestamptz,
  add column if not exists started_at timestamptz,
  add column if not exists finished_at timestamptz,
  add column if not exists queue_delay_ms integer,
  add column if not exists duration_ms integer;

alter table public.research_task_runs
  drop constraint if exists research_task_runs_failure_code_check;

alter table public.research_task_runs
  add constraint research_task_runs_failure_code_check
  check (failure_code is null or failure_code in ('task_failed', 'retryable_task_failure'));

alter table public.research_task_runs
  add constraint research_task_runs_queue_delay_check
  check (queue_delay_ms is null or queue_delay_ms >= 0);

alter table public.research_task_runs
  add constraint research_task_runs_duration_check
  check (duration_ms is null or duration_ms >= 0);

create index if not exists research_task_runs_capture_attempt_idx
  on public.research_task_runs (capture_run_id, task_kind, attempt desc);
