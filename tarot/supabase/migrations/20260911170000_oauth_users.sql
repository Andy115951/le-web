-- P34: OAuth users (GitHub / Google) — password_hash nullable; provider identity
alter table tarot_users alter column password_hash drop not null;

alter table tarot_users add column if not exists auth_provider text not null default 'password';
alter table tarot_users add column if not exists provider_user_id text;
alter table tarot_users add column if not exists avatar_url text;
alter table tarot_users add column if not exists email text;

alter table tarot_users drop constraint if exists tarot_users_auth_provider_check;
alter table tarot_users
  add constraint tarot_users_auth_provider_check
  check (auth_provider in ('password', 'github', 'google'));

create unique index if not exists tarot_users_provider_uid_idx
  on tarot_users (auth_provider, provider_user_id)
  where provider_user_id is not null;
