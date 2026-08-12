-- One model/version may publish only one accepted narrative for the same immutable input packet.
-- Rejected attempts remain append-only for audit and daily-cost accounting.
create unique index if not exists research_narrative_audits_accepted_packet_model_uidx
  on public.research_narrative_audits (packet_fingerprint, provider, model)
  where status = 'accepted';
