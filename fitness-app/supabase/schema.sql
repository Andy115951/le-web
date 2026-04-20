create extension if not exists pgcrypto;

-- 单用户无认证模式：重建表结构（会清空旧数据）
drop table if exists public.daily_logs;

create table public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  log_date date not null,
  day_type text not null,
  status text not null default 'pending' check (status in ('pending', 'complete', 'baseline', 'sick')),
  feeling text check (feeling in ('易', '中', '难') or feeling is null),
  waist numeric,
  note text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create unique index daily_logs_date_idx
on public.daily_logs (log_date);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_daily_logs_updated_at on public.daily_logs;
create trigger trg_daily_logs_updated_at
before update on public.daily_logs
for each row execute function public.set_updated_at();

alter table public.daily_logs enable row level security;

drop policy if exists "public select logs" on public.daily_logs;
create policy "public select logs"
on public.daily_logs
for select
to anon, authenticated
using (true);

drop policy if exists "public insert logs" on public.daily_logs;
create policy "public insert logs"
on public.daily_logs
for insert
to anon, authenticated
with check (true);

drop policy if exists "public update logs" on public.daily_logs;
create policy "public update logs"
on public.daily_logs
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "public delete logs" on public.daily_logs;
create policy "public delete logs"
on public.daily_logs
for delete
to anon, authenticated
using (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.daily_logs to anon, authenticated;
