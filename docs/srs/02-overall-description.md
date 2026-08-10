# 2. Overall description

Issue: [#35](https://github.com/FreshLens-AI/FreshLens-AI/issues/35). Priority: Must.

This section gives context for the specific requirements in Section 3. It does not replace numbered shall-statements.

## 2.1 Product perspective

FreshLens is a standalone multi-tenant SaaS system. It depends on these external systems:

```text
[Vendor Mobile] ----\                    +--> [Cloudflare R2]  (images)
                     \                   |
[Admin Web] ----------+--> [FreshLens API (FastAPI)]
                     /         |         |
[Supabase Auth] ----/          |         +--> [PostgreSQL + RLS]
                               |
                               +--> [Redis] --> [Celery ML Worker] --> [FL-2TC / stub]
```

- Clients authenticate with Supabase-issued JWTs.
- The API never runs CNN inference inline; it enqueues work and returns immediately.
- Isolation between vendors is enforced in PostgreSQL via RLS using `app.tenant_id` set from the JWT.

Physical deployment, container topology, and detailed sequence diagrams belong in the SAD.

## 2.2 Product functions (summary)

1. Authenticate vendors and platform admins.
2. Capture and submit a single-product scan with confirmed quantity.
3. Store the image, create a pending scan, enqueue classification, and return acceptance.
4. Classify produce (identify and freshness) asynchronously and persist results.
5. List scans and show classification and freshness score to the vendor.
6. Maintain batches and inventory quantities linked to scans where applicable.
7. List tenant-scoped products and active batches for sale entry.
8. Record confirmed sales through one stock-deduction path and evaluate low-stock alerts from the committed post-sale quantities.
9. Raise and list low-stock and static aging alerts.
10. Let platform admins manage tenants, vendor profiles, and product catalogues, and view aggregated analytics (V1 graded scope as implemented for demos).

## 2.3 User characteristics

| User class     | Characteristics                                                       | Implications |
| -------------- | --------------------------------------------------------------------- |-------------|
| Vendor         | Small-shop owner; smartphone user; limited time; may not be technical | Mobile UX must be simple; camera, quantity confirm, and clear status; no on-device CNN required for V1 |
| Platform Admin | Platform operator; uses desktop browser                               | Web console for catalogues, tenants, and analytics |

## 2.4 Constraints

| Constraint               | Implication |
| ------------------------ |-------------|
| Approved stack           | FastAPI, PostgreSQL + RLS, Supabase Auth, Next.js, Expo, Celery + Redis, Cloudflare R2, Docker Compose |
| Async inference only     | No CNN inside API request handlers |
| Tenant isolation         | Every business table has `tenant_id` + RLS in the same migration |
| Redis namespacing        | Keys use `tenant:{tenant_id}:...` |
| V1 scan model            | One product type per photo; quantity is vendor-confirmed |
| Course calendar          | Mid-eval may use stub ML; real FL-2TC by Progress Review 2 / final |
| No NestJS / second queue | Stack is locked for V1 |

## 2.5 Assumptions and dependencies

1. Vendors have a smartphone with a working camera and network access.
2. Supabase Auth remains available for JWT issuance and validation during the prototype period.
3. Public and curated datasets are sufficient to train or stub FL-2TC for the graded demo.
4. Docker Compose local/dev environment provides Postgres and Redis for the prototype.
5. Cloudflare R2 (or equivalent object storage compatible with the V1 contract) is available for image bytes.
6. Vendors enter quantities honestly; V1 does not independently verify counts from the image.
7. Platform admin accounts are provisioned out-of-band for the prototype (not self-serve signup).
8. Final V1 relies on device speech-to-text to produce transcript text for voice-assisted sale entry.
9. A provider-neutral external LLM parser is available in final V1 to convert transcript text into an untrusted structured sale draft. The draft cannot change inventory.

## 2.6 Apportioning of requirements (V1 vs V2)

| Scope               | Examples |
| ------------------- |----------|
| Must (mid-evaluation V1) | Auth, async scan 202, stub classification, RLS, manual one-item sale entry with one selected product and active batch, low-stock and static aging alerts, vendor mobile core flows, admin catalogue/tenant basics |
| Must (final V1)     | FL-2TC classification and voice-assisted sale entry that may draft multiple products but requires product resolution, vendor-selected batches, correction, and explicit confirmation |
| Should (V1 if time) | Richer admin analytics, alert CRUD beyond list, product/batch full CRUD APIs |
| Could (V2)          | Multi-item image detection, age estimation, predicted rot dates, learned aging alerts, offline capture |
| Out of scope        | IoT sensors, procurement integrations, accounting/tax |

Specific requirements in Section 3 are Must unless marked otherwise.
