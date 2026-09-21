begin;

alter table public.scans
  add column identity_label text check (
    identity_label is null
    or identity_label in ('Banana', 'Cucumber', 'Eggplant', 'Tomato')
  ),
  add column identity_score real check (
    identity_score is null
    or (identity_score >= 0 and identity_score <= 1)
  ),
  add column identity_model_version text;

comment on column public.scans.identity_label is
  'Catalogue-compatible identity-v1 display label; null for unknown/rejected input.';
comment on column public.scans.identity_score is
  'Tier-1 identity confidence, separate from Tier-2 freshness confidence.';

commit;
