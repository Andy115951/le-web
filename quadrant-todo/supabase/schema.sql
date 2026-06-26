create extension if not exists pgcrypto;

create table if not exists public.todo_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  display_name text not null,
  email text,
  email_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint todo_users_email_unique unique (email)
);

create table if not exists public.todo_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.todo_users(id) on delete cascade,
  session_token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  user_agent text,
  ip text
);

create table if not exists public.quadrant_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.todo_users(id) on delete cascade,
  title text not null,
  description text not null default '',
  quadrant text not null check (quadrant in ('q1', 'q2', 'q3', 'q4')),
  status text not null default 'todo' check (status in ('todo', 'done', 'archived')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.quadrant_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.todo_users(id) on delete cascade,
  title text not null,
  description text not null default '',
  area text not null default 'other' check (area in ('finance', 'health', 'reading', 'learning', 'work', 'life', 'other')),
  status text not null default 'active' check (status in ('active', 'done', 'paused')),
  progress integer not null default 0 check (progress between 0 and 100),
  target_date date,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists todo_sessions_user_idx on public.todo_sessions(user_id, expires_at desc);
create index if not exists quadrant_tasks_user_idx on public.quadrant_tasks(user_id, quadrant, status, created_at desc);
create index if not exists quadrant_goals_user_idx on public.quadrant_goals(user_id, area, status, sort_order);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_todo_users_updated_at on public.todo_users;
create trigger trg_todo_users_updated_at
before update on public.todo_users
for each row execute function public.set_updated_at();

drop trigger if exists trg_quadrant_tasks_updated_at on public.quadrant_tasks;
create trigger trg_quadrant_tasks_updated_at
before update on public.quadrant_tasks
for each row execute function public.set_updated_at();

drop trigger if exists trg_quadrant_goals_updated_at on public.quadrant_goals;
create trigger trg_quadrant_goals_updated_at
before update on public.quadrant_goals
for each row execute function public.set_updated_at();

alter table public.todo_users enable row level security;
alter table public.todo_sessions enable row level security;
alter table public.quadrant_tasks enable row level security;
alter table public.quadrant_goals enable row level security;
