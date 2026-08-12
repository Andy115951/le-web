alter table public.research_task_runs
  drop constraint if exists research_task_runs_kind_check;

alter table public.research_task_runs
  add constraint research_task_runs_kind_check
  check (task_kind in (
    'market_collection',
    'research_input_snapshot',
    'daily_fact_report',
    'model_recap',
    'outcome_evaluation'
  ));

alter table public.research_task_runs
  drop constraint if exists research_task_runs_status_check;

alter table public.research_task_runs
  add constraint research_task_runs_status_check
  check (status in ('succeeded', 'partial', 'skipped', 'failed', 'disabled'));
