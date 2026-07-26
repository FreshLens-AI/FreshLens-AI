# 1. Introduction

Issue: [#34](https://github.com/FreshLens-AI/FreshLens-AI/issues/34). Priority: Must.

## 1.1 Purpose

This Software Requirements Specification (SRS) states the functional and non-functional requirements for FreshLens, an AI-powered inventory and freshness monitoring platform for small-scale grocery retailers (CS3203 Group 21, PID 5).

Readers include:

- Course mentors and examiners evaluating Milestone M2
- FreshLens developers building Version 1 (mobile, web, API, ML worker)
- Testers who derive acceptance and isolation tests from numbered requirements

This document covers what the system shall do. Architecture and design live in the Software Architecture Document (SAD).

## 1.2 Scope

Product name: FreshLens: AI-Powered Automated Inventory and Freshness Monitoring System for Small-Scale Retailers.

FreshLens is a multi-tenant SaaS product with two roles:

| Role | Client | Primary capabilities |
|------|--------|----------------------|
| Vendor (shop owner) | Mobile (Expo / React Native) | Capture produce photos, confirm quantity, view scan results, inventory summary, and alerts |
| Platform Administrator | Web (Next.js) | Manage tenants / vendor profiles, product catalogues, and platform analytics |

Version 1 includes:

- An asynchronous scan pipeline: the vendor submits a photo and a confirmed quantity; the API accepts with HTTP 202; classification runs in the background
- FreshLens Two-Tier Classifier (FL-2TC): Tier 1 identifies produce type; Tier 2 labels it `fresh`, `medium`, or `spoiled` (a stub classifier is acceptable at mid-evaluation)
- Multi-tenant isolation through PostgreSQL Row-Level Security (`tenant_id` on every business table)
- Low-stock alerts and static aging alerts based on administrator-configured shelf-life days
- Core entities: tenants, users, products, scans, batches, alerts

Version 2 (future) includes image-based age estimation, predicted rot-dates, ML-based nearing-spoilage alerts, voice sale deduction, and multi-item shelf detection.

Out of scope for all versions: IoT / smart scales, automated procurement or supply-chain integration, and accounting / tax modules.

## 1.3 Definitions, acronyms, and abbreviations

| Term | Definition |
|------|------------|
| Alert | Notification raised for low stock, static aging, spoilage classification, or related conditions |
| Batch | Stock intake grouping for a product: intake date, quantity received, quantity remaining, shelf-life context |
| Classification | Freshness label assigned by Tier 2: `fresh`, `medium`, or `spoiled` |
| FL-2TC | FreshLens Two-Tier Classifier. Tier 1 product identity, Tier 2 freshness |
| JWT | JSON Web Token issued by Supabase Auth |
| Platform Admin | User role that manages the platform via the web application (`platform_admin`) |
| RLS | PostgreSQL Row-Level Security: database policies that restrict rows by `tenant_id` |
| Scan | One produce photo submission plus confirmed quantity and resulting classification record |
| Stub classifier | Non-CNN placeholder that writes a valid classification for mid-evaluation demos |
| Tenant | Logical vendor organization boundary; all business data is scoped by `tenant_id` |
| Vendor | Shop-owner user role using the mobile application (`vendor`) |
| V1 / V2 | Version 1 / Version 2 (documented future work) |
| Celery | Asynchronous task queue worker used for inference |
| R2 | Cloudflare R2 object storage for scan images |
| SAD | Software Architecture Document (companion to this SRS) |
| SRS | Software Requirements Specification (this document) |

## 1.4 References

1. FreshLens Project Proposal (CS3203 Group 21), July 2026
2. FreshLens Feasibility Study
3. FreshLens Project Schedule / Gantt
4. FreshLens API V1 OpenAPI contract
5. IEEE Std 830-1998, *IEEE Recommended Practice for Software Requirements Specifications* (superseded; the structural practice is still widely used)
6. ISO/IEC/IEEE 29148:2018, *Systems and software engineering: Life cycle processes: Requirements engineering*
7. Mukhiddinov et al., "Improved classification approach for fruits and vegetables freshness based on deep learning," *Sensors*, 2022
8. Fahad et al., "Fruits and vegetables freshness categorization using deep learning," *CMC*, 2022
9. GitHub repository FreshLens-AI/FreshLens-AI, issues #5, #34 to #44 (SRS), #6 (SAD)

## 1.5 Overview of the SRS document

- Section 2 summarizes product perspective, functions, users, constraints, and assumptions without detailed shall-statements.
- Section 3 states specific functional, usability, reliability, performance, security, supportability, interface, and database requirements.
- Section 4 provides supporting information, including requirement traceability.

Requirements use unique IDs (`FR-*`, `NFR-*`, `DR-*`, `IR-*`) and priority Must / Should / Could.
