-- Candle Taro tables
create extension if not exists pgcrypto;

create table if not exists tarot_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tarot_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references tarot_users(id) on delete cascade,
  session_token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  user_agent text,
  ip text
);

create table if not exists tarot_readings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references tarot_users(id) on delete set null,
  anonymous_id text,
  title text,
  question text not null,
  scene text not null,
  spread_type text not null,
  spread_result jsonb not null,
  status text not null,
  detail_level text not null default 'brief',
  ritual_speed text not null default 'normal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists tarot_readings_user_idx on tarot_readings(user_id) where deleted_at is null;
create index if not exists tarot_readings_anon_idx on tarot_readings(anonymous_id) where deleted_at is null;

create table if not exists tarot_messages (
  id uuid primary key default gen_random_uuid(),
  reading_id uuid not null references tarot_readings(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists tarot_messages_reading_idx on tarot_messages(reading_id, created_at);

create table if not exists tarot_usage_counters (
  subject_key text not null,
  day date not null,
  readings_count int not null default 0,
  messages_count int not null default 0,
  primary key (subject_key, day)
);
