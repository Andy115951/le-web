create extension if not exists pgcrypto;

drop table if exists public.messages;
drop table if exists public.comments;
drop table if exists public.posts;
drop table if exists public.questions;
drop table if exists public.users;

create table public.users (
  id uuid primary key default gen_random_uuid(),
  device_id text not null unique,
  nickname text not null,
  avatar text not null,
  pair_code text not null unique,
  partner_id uuid references public.users(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  pair_time timestamp with time zone,
  updated_at timestamp with time zone not null default now()
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  asker_id uuid not null references public.users(id) on delete cascade,
  answerer_id uuid not null references public.users(id) on delete cascade,
  question text not null,
  answer text,
  answered boolean not null default false,
  question_date date not null default current_date,
  created_at timestamp with time zone not null default now(),
  answered_at timestamp with time zone
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  author_id uuid not null references public.users(id) on delete cascade,
  author_name text not null,
  tags text[] not null default '{}',
  view_count integer not null default 0,
  like_count integer not null default 0,
  comment_count integer not null default 0,
  is_deleted boolean not null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  author_name text not null,
  content text not null,
  is_deleted boolean not null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references public.users(id) on delete cascade,
  to_user_id uuid not null references public.users(id) on delete cascade,
  content text not null,
  type text not null default 'text',
  is_read boolean not null default false,
  is_deleted boolean not null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index questions_date_idx on public.questions(question_date desc);
create index questions_asker_idx on public.questions(asker_id);
create index questions_answerer_idx on public.questions(answerer_id, answered);

create index posts_created_idx on public.posts(created_at desc);
create index posts_author_idx on public.posts(author_id);

create index comments_post_idx on public.comments(post_id, created_at desc);
create index comments_user_idx on public.comments(user_id);

create index messages_from_idx on public.messages(from_user_id, created_at desc);
create index messages_to_idx on public.messages(to_user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at
before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists trg_posts_updated_at on public.posts;
create trigger trg_posts_updated_at
before update on public.posts
for each row execute function public.set_updated_at();

drop trigger if exists trg_comments_updated_at on public.comments;
create trigger trg_comments_updated_at
before update on public.comments
for each row execute function public.set_updated_at();

drop trigger if exists trg_messages_updated_at on public.messages;
create trigger trg_messages_updated_at
before update on public.messages
for each row execute function public.set_updated_at();

alter table public.users enable row level security;
alter table public.questions enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.messages enable row level security;

-- 迁移版采用开放策略保证先跑通，生产请改为严格 RLS + Auth。
drop policy if exists "public users read" on public.users;
create policy "public users read" on public.users
for select to anon, authenticated using (true);

drop policy if exists "public users write" on public.users;
create policy "public users write" on public.users
for all to anon, authenticated using (true) with check (true);

drop policy if exists "public questions read" on public.questions;
create policy "public questions read" on public.questions
for select to anon, authenticated using (true);

drop policy if exists "public questions write" on public.questions;
create policy "public questions write" on public.questions
for all to anon, authenticated using (true) with check (true);

drop policy if exists "public posts read" on public.posts;
create policy "public posts read" on public.posts
for select to anon, authenticated using (true);

drop policy if exists "public posts write" on public.posts;
create policy "public posts write" on public.posts
for all to anon, authenticated using (true) with check (true);

drop policy if exists "public comments read" on public.comments;
create policy "public comments read" on public.comments
for select to anon, authenticated using (true);

drop policy if exists "public comments write" on public.comments;
create policy "public comments write" on public.comments
for all to anon, authenticated using (true) with check (true);

drop policy if exists "public messages read" on public.messages;
create policy "public messages read" on public.messages
for select to anon, authenticated using (true);

drop policy if exists "public messages write" on public.messages;
create policy "public messages write" on public.messages
for all to anon, authenticated using (true) with check (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.users to anon, authenticated;
grant select, insert, update, delete on public.questions to anon, authenticated;
grant select, insert, update, delete on public.posts to anon, authenticated;
grant select, insert, update, delete on public.comments to anon, authenticated;
grant select, insert, update, delete on public.messages to anon, authenticated;
