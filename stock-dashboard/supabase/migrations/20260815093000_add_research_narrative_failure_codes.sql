alter table public.research_narrative_audits
  add column if not exists failure_code text;

alter table public.research_narrative_audits
  drop constraint if exists research_narrative_audits_failure_code_check;

alter table public.research_narrative_audits
  add constraint research_narrative_audits_failure_code_check
  check (failure_code is null or failure_code in (
    'model_response_incomplete',
    'model_response_empty',
    'model_response_invalid_json',
    'gateway_http_error',
    'gateway_request_failed',
    'narrative_contract_invalid'
  ));

create index if not exists research_narrative_audits_failure_code_idx
  on public.research_narrative_audits (failure_code, created_at desc)
  where failure_code is not null;
