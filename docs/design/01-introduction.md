# 1. Introduction

## 1.1 Purpose

This Software Architecture Document (SAD) describes the Version 1 architecture of FreshLens, an AI-powered inventory and freshness monitoring platform for small grocery vendors (CS3203 Group 21, PID 5). It translates the requirements in the System Requirements Specification (SRS) into components, interfaces, runtime processes, deployment topology, and data design.

The audience is the FreshLens development team, course mentors and examiners reviewing Milestone M2, and anyone who later extends the system. The document is the shared reference for contracts across mobile, web, API, worker, and database work.

## 1.2 Scope

This document covers FreshLens Version 1 as scoped in the Project Proposal and the revised SRS:

- Vendor mobile application (Expo / React Native)
- Platform administrator web application (Next.js)
- FastAPI application service
- Asynchronous inference pipeline (Redis, Celery, stub classifier at mid-evaluation, FL-2TC later)
- PostgreSQL with Row-Level Security
- Cloudflare R2 image storage
- Shared sales service for stock deduction, with manual mid-evaluation entry and final voice-assisted drafting

It does not cover UI wireframes, CNN training hyperparameters, IoT hardware, procurement, or accounting modules. Version 2 features such as multi-item image detection, image-based age estimation, and learned rot-date prediction appear only where they constrain a Version 1 decision.

Unless a section marks a component as implemented on the current scaffold, the design describes the approved target V1 architecture. The implementation baseline is `main` commit `a460540`.

## 1.3 Definitions and acronyms

| Term | Meaning |
|---|---|
| SAD | Software Architecture Document (this document) |
| SRS | System Requirements Specification |
| RLS | PostgreSQL Row-Level Security |
| JWT | JSON Web Token from Supabase Auth |
| FL-2TC | FreshLens Two-Tier Classifier |
| R2 | Cloudflare R2 object storage |
| Sale | Confirmed stock deduction transaction |
| Voice draft | Untrusted structured sale candidates from transcript parsing |

## 1.4 References

1. FreshLens Project Proposal, CS3203 Group 21, July 2026.
2. FreshLens Feasibility Study Report, CS3203 Group 21, July 2026.
3. FreshLens System Requirements Specification, `docs/srs/FreshLens-SRS.md`.
4. FreshLens API V1 OpenAPI contract, `docs/api/v1/openapi.yaml`.
5. P. Kruchten, "The 4+1 View Model of Architecture," IEEE Software, vol. 12, no. 6, 1995.
6. Diagram tooling: architecture figures were drawn in the diagrams.net (Draw.io) online visual editor and exported as PNG under `docs/design/diagrams/`.

## 1.5 Overview of the SAD

Section 2 states which views this document uses and how they map to FreshLens. Section 3 records architectural goals and constraints. Section 4 covers architecturally significant use cases. Sections 5 through 9 give the Logical, Process, Deployment, Implementation, and Data views. Sections 10 and 11 relate size, performance, and quality attributes to architectural mechanisms. Section 12 lists references.
