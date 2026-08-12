create table if not exists public.similar_day_matches (
  id bigint generated always as identity primary key,
  target_instrument_id bigint not null references public.instruments(id) on delete cascade,
  target_market_date date not null references public.market_days(market_date) on delete restrict,
  candidate_instrument_id bigint not null references public.instruments(id) on delete cascade,
  candidate_market_date date not null references public.market_days(market_date) on delete restrict,
  method_version text not null,
  rank integer not null,
  similarity_score numeric not null,
  momentum_score numeric,
  risk_score numeric,
  participation_score numeric,
  event_score numeric,
  used_feature_keys jsonb not null default '{}'::jsonb,
  normalization_start_date date not null,
  normalization_end_date date not null,
  normalization_sample_count integer not null,
  candidate_return_1d_percent numeric,
  candidate_return_3d_percent numeric,
  candidate_return_5d_percent numeric,
  candidate_return_20d_percent numeric,
  candidate_max_drawdown_20d_percent numeric,
  candidate_realized_volatility_20d_percent numeric,
  computed_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint similar_day_matches_target_rank_key
    unique (target_instrument_id, target_market_date, method_version, rank),
  constraint similar_day_matches_target_candidate_key
    unique (target_instrument_id, target_market_date, method_version, candidate_instrument_id, candidate_market_date),
  constraint similar_day_matches_rank_check check (rank > 0),
  constraint similar_day_matches_score_check check (similarity_score >= 0 and similarity_score <= 100),
  constraint similar_day_matches_component_scores_check check (
    (momentum_score is null or (momentum_score >= 0 and momentum_score <= 100))
    and (risk_score is null or (risk_score >= 0 and risk_score <= 100))
    and (participation_score is null or (participation_score >= 0 and participation_score <= 100))
    and (event_score is null or (event_score >= 0 and event_score <= 100))
  ),
  constraint similar_day_matches_normalization_check check (
    normalization_sample_count > 0
    and normalization_start_date <= normalization_end_date
    and candidate_market_date < target_market_date
  ),
  constraint similar_day_matches_feature_keys_object_check check (jsonb_typeof(used_feature_keys) = 'object')
);

create index if not exists similar_day_matches_target_idx
  on public.similar_day_matches (target_instrument_id, target_market_date desc, method_version, rank);

create index if not exists similar_day_matches_candidate_idx
  on public.similar_day_matches (candidate_instrument_id, candidate_market_date desc);

revoke all on public.similar_day_matches from anon, authenticated;
grant select, insert, update, delete on public.similar_day_matches to service_role;
grant usage, select on sequence public.similar_day_matches_id_seq to service_role;

alter table public.similar_day_matches enable row level security;
