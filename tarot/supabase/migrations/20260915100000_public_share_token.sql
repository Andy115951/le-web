-- P50: opaque public share token (null = disabled / invalidated)
alter table tarot_readings
  add column if not exists public_share_token text;

create unique index if not exists tarot_readings_public_share_token_uidx
  on tarot_readings (public_share_token)
  where public_share_token is not null;
