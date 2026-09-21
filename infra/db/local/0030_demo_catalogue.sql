-- Demo catalogue for local Compose only. Not applied in CI RLS tests.
-- Tenant UUID matches docs/authentication.md so a provisioned vendor JWT can sell.

insert into public.tenants (id, name, status)
values (
  '11111111-1111-4111-8111-111111111111',
  'Example Grocer',
  'active'
)
on conflict (id) do nothing;

insert into public.products (
  id, tenant_id, name, shelf_life_days, low_stock_threshold
)
values
  (
    '11111111-1111-4111-8111-111111111201',
    '11111111-1111-4111-8111-111111111111',
    'Tomato',
    5,
    3
  ),
  (
    '11111111-1111-4111-8111-111111111202',
    '11111111-1111-4111-8111-111111111111',
    'Banana',
    3,
    2
  ),
  (
    '11111111-1111-4111-8111-111111111203',
    '11111111-1111-4111-8111-111111111111',
    'Cucumber',
    7,
    3
  ),
  (
    '11111111-1111-4111-8111-111111111204',
    '11111111-1111-4111-8111-111111111111',
    'Eggplant',
    5,
    3
  )
on conflict (id) do nothing;

insert into public.batches (
  id,
  tenant_id,
  product_id,
  intake_date,
  quantity_received,
  quantity_remaining
)
values
  (
    '11111111-1111-4111-8111-111111111301',
    '11111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-111111111201',
    now(),
    10,
    10
  ),
  (
    '11111111-1111-4111-8111-111111111302',
    '11111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-111111111202',
    now() - interval '10 days',
    6,
    4
  )
on conflict (id) do nothing;

insert into public.alerts (
  tenant_id, type, severity, message, product_id, batch_id
)
select
  '11111111-1111-4111-8111-111111111111',
  'aging',
  'warning',
  'Banana has passed its 3-day shelf life.',
  '11111111-1111-4111-8111-111111111202',
  '11111111-1111-4111-8111-111111111302'
where not exists (
  select 1
  from public.alerts
  where batch_id = '11111111-1111-4111-8111-111111111302'
    and type = 'aging'
);
