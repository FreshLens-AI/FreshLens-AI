begin;

-- Snapshot the configured lifecycle when inventory is received. This keeps an
-- existing batch's deadlines stable when an administrator later edits the
-- shared category rule.
alter table public.batches
  add column initial_classification public.classification,
  add column fresh_to_medium_at timestamptz,
  add column medium_to_spoiled_at timestamptz,
  add constraint batches_lifecycle_order check (
    fresh_to_medium_at is null
    or medium_to_spoiled_at is null
    or fresh_to_medium_at <= medium_to_spoiled_at
  );

-- An alert event key distinguishes the two aging transitions and supplies an
-- idempotency boundary for periodic workers. Legacy rows remain valid.
alter table public.alerts
  add column event_key text,
  add column transition_at timestamptz,
  add column read_at timestamptz,
  add column resolved_at timestamptz,
  add column notification_sent_at timestamptz,
  add constraint alerts_event_key_nonempty check (
    event_key is null or char_length(trim(event_key)) > 0
  );

update public.alerts
set event_key = 'legacy_' || type::text,
    notification_sent_at = created_at
where event_key is null;

-- Preserve one alert per lifecycle event while allowing separate warnings for
-- fresh-to-medium and medium-to-spoiled transitions on the same batch.
create unique index alerts_tenant_batch_event_unique
on public.alerts (tenant_id, batch_id, event_key)
where batch_id is not null and event_key is not null;

create index batches_fresh_to_medium_due_idx
on public.batches (tenant_id, fresh_to_medium_at)
where quantity_remaining > 0 and fresh_to_medium_at is not null;

create index batches_medium_to_spoiled_due_idx
on public.batches (tenant_id, medium_to_spoiled_at)
where quantity_remaining > 0 and medium_to_spoiled_at is not null;

create index alerts_pending_notification_idx
on public.alerts (tenant_id, created_at)
where notification_sent_at is null and resolved_at is null;

-- Existing scan-created batches receive the same stable snapshot when enough
-- source data is available. Unknown/unclassified inventory remains unscheduled.
with initial_scans as (
  select distinct on (batch_id)
    batch_id,
    classification
  from public.scans
  where batch_id is not null and classification is not null
  order by batch_id, created_at, id
), lifecycle as (
  select
    batches.id,
    initial_scans.classification,
    rules.fresh_to_medium_days,
    rules.medium_to_spoiled_days
  from public.batches as batches
  join public.products as products
    on products.id = batches.product_id
   and products.tenant_id = batches.tenant_id
  join public.product_category_shelf_life as rules
    on rules.category = lower(trim(products.name))
  join initial_scans on initial_scans.batch_id = batches.id
  where rules.fresh_to_medium_days is not null
    and rules.medium_to_spoiled_days is not null
)
update public.batches as batches
set initial_classification = lifecycle.classification,
    fresh_to_medium_at = case lifecycle.classification
      when 'fresh' then batches.intake_date
        + make_interval(days => lifecycle.fresh_to_medium_days)
      when 'medium' then batches.intake_date
      when 'spoiled' then batches.intake_date
    end,
    medium_to_spoiled_at = case lifecycle.classification
      when 'fresh' then batches.intake_date
        + make_interval(
            days => lifecycle.fresh_to_medium_days
              + lifecycle.medium_to_spoiled_days
          )
      when 'medium' then batches.intake_date
        + make_interval(days => lifecycle.medium_to_spoiled_days)
      when 'spoiled' then batches.intake_date
    end
from lifecycle
where batches.id = lifecycle.id;

commit;
