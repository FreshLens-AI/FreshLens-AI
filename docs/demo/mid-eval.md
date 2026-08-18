# Mid-evaluation demo script

**Issue:** [#15](https://github.com/FreshLens-AI/FreshLens-AI/issues/15)  
**Bar:** vendor scan → two-tier YOLO26-cls → confirmed sale → alert → admin tenants
**Known limit:** both checkpoints are CPU-trained public-dataset baselines. A
device-diverse, team-captured release set is still required.

Demo tenant UUID (Compose seed): `11111111-1111-4111-8111-111111111111`

## 0. Start the stack

```bash
docker compose --env-file .env -f infra/docker/docker-compose.yml down -v
docker compose --env-file .env -f infra/docker/docker-compose.yml up --build
```

A fresh volume is required only for the initial demo reset so `0030_demo_catalogue.sql` loads Tomato / Banana batches and the aging alert. `down -v` also deletes the local vendor mappings created in section 1, so do not run it again after provisioning. For a normal restart, run only the `up` command.

The worker image includes CPU PyTorch and both local model checkpoints. The first
`--build` is slow because it installs the inference runtime.

Web: `cd apps/web && npm run dev` (needs `NEXT_PUBLIC_SUPABASE_URL`, publishable key, `NEXT_PUBLIC_API_URL=http://localhost:8000`).  
Mobile: `cd apps/mobile && npx expo start` (same URL/key as `EXPO_PUBLIC_*`).

## 1. Provision accounts

Hosted Supabase is **IdP only**. Compose Postgres holds business rows.

**Platform admin** (already in the shared project): sign in on the web app.

**Vendor**

1. In Supabase Auth, create a user (email/password). Disable public signup; create the user in the dashboard.
2. In the SQL editor on the **hosted** project, map the user to the demo tenant so the JWT carries `app_role=vendor` and `tenant_id`:

```sql
insert into public.tenants (id, name)
values ('11111111-1111-4111-8111-111111111111', 'Example Grocer')
on conflict (id) do nothing;

insert into public.users (id, tenant_id, role, display_name, email)
select id, '11111111-1111-4111-8111-111111111111', 'vendor', 'Example Vendor', email
from auth.users
where email = 'vendor@example.com';
```

3. Copy that user's UUID from Authentication → Users. On the laptop running Compose:

```bash
scripts/provision-local-vendor.sh <supabase-user-uuid> vendor@example.com
```

Sign in again after provisioning so the access token includes the custom claims.

## 2. Vendor scan (mobile)

1. Sign in on Expo.
2. **Start scan** → capture one product → quantity ≥ 1 → submit.
3. Expect HTTP 202. Poll until `completed` or `failed`.
4. A completed result shows the four-product Model 1 identity and Model 2 Fresh /
   Medium / Spoiled grade with separate confidence scores. An identity accepted
   at 75% or higher creates and links one inventory batch using the confirmed
   quantity. A low-confidence freshness result fails safely for a retake, and a
   spoiled result creates a critical alert. Set `CLASSIFIER=stub` only as a
   fallback when checkpoints are unavailable. The API handler never classifies.

## 3. Vendor sale and alerts (mobile)

1. **Record sale** → Tomato → the batch with 10 remaining → sell 8 (threshold is 3) → confirm.
2. Replay is safe: the client sends a new `Idempotency-Key` per confirm. Retrying the same key in curl does not deduct twice.
3. **View alerts** — seeded Banana aging alert is visible; Tomato low-stock appears after the sale.

## 4. Admin tenants (web)

1. Sign in as `platform_admin`.
2. Open **Tenants**. The list is `GET /api/v1/admin/tenants` against Compose Postgres (Example Grocer). Catalogue and shelf-life screens remain demo/`localStorage` until product admin APIs exist.
3. Open Example Grocer. Raw scan images, quantities, and batches are not shown.

## 5. Say out loud

- Isolation is PostgreSQL RLS from JWT `tenant_id`, not a client-supplied field.
- Inference is async Celery. Model 1 identifies the supported product, then
  Model 2 grades freshness; both are fine-tuned YOLO26n-cls checkpoints.
- Sales is the only stock writer.
