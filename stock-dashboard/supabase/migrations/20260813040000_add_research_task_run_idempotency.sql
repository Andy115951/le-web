alter table public.research_task_runs
  add constraint research_task_runs_capture_task_attempt_unique
  unique (capture_run_id, task_kind, attempt);
