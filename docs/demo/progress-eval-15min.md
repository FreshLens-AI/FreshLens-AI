# FreshLens — 15-minute progress evaluation demo

**Audience:** CS3203 progress review  
**Length:** 15 minutes (hard stop)  
**Bar:** vendor login → real FL-2TC scan → sale with stock deduction → alerts → admin tenants / catalogue / shelf-life  
**Date prepared:** 2026-09-30

This replaces the mid-eval Compose-only script in `docs/demo/mid-eval.md` for the
hosted demo day. Keep mid-eval.md for local laptop resets.

---

## 0. One-page cheat sheet

| Surface | URL / artifact |
|---|---|
| Admin web | https://freshlens-admin.vercel.app |
| API health (via Vercel proxy) | https://freshlens-admin.vercel.app/health → `{"status":"ok"}` |
| API health (VPS direct) | http://172.198.64.148:8000/health |
| Vendor Android APK (invite + password setup, VPS API) | https://expo.dev/artifacts/eas/_1wPnmqJzozXF06ATYB_-jryhag3Dv4nscNAbef8eHM.apk |
| Repo | https://github.com/FreshLens-AI/FreshLens-AI |

| Role | App | Notes |
|---|---|---|
| `platform_admin` | Web only | No `tenant_id`. Lists tenants, catalogue, shelf-life rules, aggregates. |
| `vendor` | Mobile only | One store (`tenant_id` in JWT). Scan, sale, alerts. |

| Identity | Meaning |
|---|---|
| **Tenant** | One grocery store. Wall around products, batches, scans, sales, alerts. |
| **Account creation** | Owner / admin provisioned. **No public signup.** Admin can invite the first vendor when creating a tenant. |

**Supported produce (Model 1):** banana, cucumber, eggplant, tomato (+ unknown below 0.75 confidence).  
**Freshness (Model 2):** fresh / medium / spoiled (min confidence 0.50).  
**Classifier on VPS:** `CLASSIFIER=identity-v1` (real YOLO, not stub).

Fill passwords from the team credential note before the session. Do not commit them.

| Account (examples) | Role | Password |
|---|---|---|
| *(platform admin email)* | `platform_admin` | *[team vault]* |
| `vendor123@gmail.com` (or invited vendor) | `vendor` | *[team vault]* |

---

## 1. Timeline (15:00 total)

| Min | Who | What | Goal |
|---|---|---|---|
| **0:00–1:30** | Speaker | Pitch + architecture slide | Problem, roles, async ML, RLS |
| **1:30–6:30** | Demo lead | Mobile: login → scan → result | Live FL-2TC, 202 async |
| **6:30–9:30** | Demo lead | Mobile: sale → alerts | Only sales deduct stock |
| **9:30–13:00** | Demo lead | Admin web: tenants, catalogue, shelf-life, analytics | Platform view, no raw vendor photos |
| **13:00–15:00** | Speaker | Architecture recap + Q&A buffer | Claim checklist |

If something fails, skip to the next block. Do not debug live for more than ~45 seconds.

---

## 2. Pre-demo checklist (T−60 to T−15)

Do this **before** the evaluators arrive. One person owns “green lights.”

### 2.1 Connectivity

```bash
curl -fsS https://freshlens-admin.vercel.app/health
curl -fsS http://172.198.64.148:8000/health
```

Both must return `{"status":"ok"}`.

### 2.2 Phone

1. Install the **latest** preview APK (link above). Uninstall older builds first if the sign-in screen looks wrong.
2. Confirm the phone is on network/cellular that can reach `172.198.64.148:8000` (HTTP cleartext is allowed in the preview build).
3. Sign in once as the demo vendor. Allow camera and notifications if prompted.
4. Confirm Home shows the store dashboard (not “not provisioned”).
5. Optional: leave the app backgrounded once after a scan to verify push (“Scan complete…”) — not required for the 15‑min script.

### 2.3 Laptop / admin

1. Open https://freshlens-admin.vercel.app/login in a clean browser profile or Incognito.
2. Sign in as platform admin. Confirm **Dashboard**, **Tenants**, **Catalogue**, **Analytics** load without 500s.
3. Pre-open tabs you will show: Tenants list, one tenant detail, Catalogue / shelf-life rules, Analytics.

### 2.4 Props

- 1–2 pieces of **real** produce from the supported set (tomato / banana preferred).
- Phone brightness high; laptop zoom 125% if projecting.
- Backup photos in gallery if the room has bad lighting (gallery fallback if the build supports it).

### 2.5 Schema / deploy reality check

VPS deploy rebuilds containers but **does not auto-apply SQL migrations**. If admin catalogue or invite flows 500, a migration may be missing on the VPS. That is a prep-day fix, not a live-demo fix. Confirm with the team that VPS has migrations through the latest numbered file on `main` (as of 2026-09-30: through `0006`).

### 2.6 Talking-point card (print or second screen)

- Supabase Auth = identity only; FastAPI verifies JWT; Postgres RLS = tenant wall.
- `POST /scans` returns **202**; Celery + YOLO run off-request.
- Sales service is the **only** stock writer; idempotent.
- Admin sees aggregates / catalogue — not another vendor’s raw inventory photos.
- No public self-signup; stores are owner/admin provisioned (invite for password setup).

---

## 3. Minute-by-minute script

### 3.1 Opening (0:00–1:30)

**Say:**

> FreshLens helps small grocery vendors cut produce waste. The vendor scans one item on a phone; a two-tier CNN identifies the product and grades freshness. Results update inventory and alerts. Platform admins see tenants and catalogue settings on the web. Isolation is PostgreSQL RLS from the signed JWT — the client never chooses a tenant id.

**Show (optional slide):** phone → API 202 → Celery worker → Postgres; admin web beside it.

---

### 3.2 Mobile — login and scan (1:30–6:30)

1. Open FreshLens on the phone. Sign in with the **provisioned vendor** email/password.
2. Point at Home: Connected, product / scan / alert counts.
3. Tap **Scan Produce**. Capture **one** item (one product per photo in V1). Confirm quantity ≥ 1. Submit.
4. Narrate while waiting:

   > The API accepted the image with HTTP 202 and queued Celery. The API process never runs the CNN. The worker runs Model 1 (identity) then Model 2 (freshness).

5. Open History / result. Call out:
   - Identity label + score (or unknown / retake path if confidence fails)
   - Freshness class + score
   - Non-stub `model_version` (identity / freshness YOLO versions)
6. If identity is accepted, say that a batch is linked with the confirmed quantity.

**If scan hangs > 30s:** open History and refresh once. If still pending, say “worker queue / network” and continue with a **pre-completed scan** from an earlier dry run, or skip to sale on an existing product/batch.

**If “not provisioned”:** wrong account or mapping missing — switch to backup vendor credentials prepared offline. Do not create users live.

---

### 3.3 Mobile — sale and alerts (6:30–9:30)

1. Tap **Record Sale**.
2. Pick a product that has a batch with remaining stock (demo seed often includes Tomato / Banana).
3. Select the **batch**, enter a quantity that will push stock near or under the low-stock threshold (e.g. sell enough that remaining ≤ threshold).
4. Confirm. Narrate:

   > Only the shared sales service deducts stock. It is atomic and idempotent — the same idempotency key cannot deduct twice.

5. Open **Active Alerts**. Show:
   - Any spoilage alert from a spoiled scan (if you produced one), and/or
   - Low-stock / aging alerts for the demo store.

**If sale fails (422 / no batches):** use another product that already has stock from a successful scan, or skip to admin and say inventory was pre-seeded for the eval.

---

### 3.4 Admin web (9:30–13:00)

1. Sign in as **platform admin** (vendor account must get 403 / access denied on admin).
2. **Dashboard / Analytics** — platform aggregates (scans by class, tenant glance). Say these are aggregate views, not raw cross-tenant inventory dumps.
3. **Tenants** — list stores; open one tenant. Show profile / status. Emphasize you do **not** see that vendor’s scan image bytes or batch quantities the way the phone does.
4. **Catalogue / shelf-life** — shared category shelf-life stages (fresh→medium, medium→spoiled days) managed by admin and synchronized to matching products.
5. **Optional (30s):** if invite UI is ready, show **Create tenant** with vendor email — “admin invites the first vendor; they set a password from the email link; no public signup.” Do **not** send a live invite unless SMTP and redirect URLs were verified in prep.

---

### 3.5 Close (13:00–15:00)

**Say (claim checklist):**

1. Multi-tenant isolation via Postgres RLS + JWT `tenant_id` / `app_role`.
2. Async inference only — FastAPI accepts, Celery classifies.
3. Real FL-2TC checkpoints on the demo worker (`identity-v1` / `freshness-v1`), not the stub.
4. Sales is the sole stock-deduction path.
5. Roles: vendor mobile vs platform admin web; accounts are provisioned / invited, not open registration.

Leave ~60–90 seconds for questions.

---

## 4. Architecture answers (Q&A)

| Question | Short answer |
|---|---|
| Where does the model run? | Celery worker on the Azure VPS Docker stack. Not in the API request handler. |
| Where is the database? | Demo business data on VPS Postgres. Supabase Auth issues JWTs; custom claims come from the access-token hook (HTTP hook to the API in current deploy). |
| Can a vendor see another store? | No. RLS filters on `app.tenant_id` set from the verified JWT. |
| Can admin scan? | No. Scan/sales routes require `vendor`. |
| Can anyone sign up? | No. Public GoTrue signup stays off. Admin/owner provisions or invites. |
| What if confidence is low? | Identity below ~0.75 → unknown / no batch. Freshness below ~0.50 → fail safely for retake. |
| Migrations on deploy? | CI/CD redeploys containers; SQL migrations on the existing VPS volume are applied manually. |

---

## 5. Failure playbook

| Symptom | Likely cause | Demo action |
|---|---|---|
| Health not ok | VPS / Vercel down | Switch to recorded screen capture if prepared; otherwise explain architecture offline |
| Login “not provisioned” | Missing `public.users` mapping | Use backup vendor account |
| Scan stuck pending | Worker / Redis | Refresh History; use prior completed scan |
| Scan failed | Model / image | Retake with clearer produce; use tomato/banana |
| Upload / 413 / proxy errors | Large JPEG via wrong API host | Use APK built against `http://172.198.64.148:8000` (current preview profile) |
| Sale no batches | No successful identity scan yet | Scan first, or pick seeded product |
| Admin 500 on catalogue | Migration not applied on VPS | Skip catalogue; show Tenants + Analytics only |
| Push missing | Device token not registered | Ignore for timed demo; scan result on History is enough |

---

## 6. Roles on stage

| Person | Job |
|---|---|
| **Speaker** | Pitch, architecture lines, Q&A |
| **Demo lead** | Drives phone + laptop; stays silent except “next screen” cues |
| **Shadow** | Off-stage: health curls, worker logs if asked after the session — not during the 15 minutes |

---

## 7. Dry run (T−1 day or morning of)

Full path once, timed:

1. Health OK  
2. Vendor login  
3. Scan tomato/banana → completed with real `model_version`  
4. Sale → stock down  
5. Alerts visible  
6. Admin tenants + catalogue  
7. Total ≤ 12 minutes (leaves buffer)

Record a 3‑minute backup video of scan+sale if the room network is unreliable.

---

## 8. What not to demo

- Public “Create store” / self-signup (out of scope for this eval).
- Voice sale drafting (API may be documented but not required for this 15‑min bar).
- Wiping the VPS Postgres volume (`down -v`) — destroys demo data.
- Live migration applies or SSH debugging on stage.
- Platform admin login on the mobile app (wrong role).

---

## 9. Post-demo (optional)

If evaluators ask for evidence afterward:

```bash
curl -fsS http://172.198.64.148:8000/health
# On VPS (team only): worker recent classify lines
# docker compose logs --tail=40 worker | grep -iE 'classify|error'
```

Point them at `docs/api/v1/openapi.yaml`, `docs/authentication.md`, and `docs/design/FreshLens-SAD.md` for contract and architecture.
