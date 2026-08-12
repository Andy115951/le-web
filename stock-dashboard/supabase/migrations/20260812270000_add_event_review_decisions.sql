create table if not exists public.event_review_decisions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  review_status text not null,
  reviewer text not null,
  review_note text not null default '',
  review_version text not null,
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint event_review_decisions_status_check
    check (review_status in ('accepted', 'rejected', 'needs_attention')),
  constraint event_review_decisions_reviewer_check
    check (char_length(trim(reviewer)) between 2 and 80),
  constraint event_review_decisions_note_check
    check (char_length(review_note) <= 1000)
);

create index if not exists event_review_decisions_event_reviewed_idx
  on public.event_review_decisions (event_id, reviewed_at desc, created_at desc);

revoke all on public.event_review_decisions from anon, authenticated;
grant select, insert on public.event_review_decisions to service_role;

alter table public.event_review_decisions enable row level security;
