-- P36: silent reveal mode — wait for user CTA before auto-interpret
alter table tarot_readings
  add column if not exists silent_reveal boolean not null default false;
