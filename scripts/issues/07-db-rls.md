## Acceptance criteria
- [ ] Tables: tenants, users, products, scans, alerts
- [ ] Every business table has `tenant_id`
- [ ] RLS policies use `current_setting('app.tenant_id')`
- [ ] Migrations in `infra/db/migrations/`
