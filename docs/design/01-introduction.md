# 1. Introduction

## 1.1 Purpose

This document is the Software Architecture Document (SAD) for FreshLens, an AI-powered inventory and freshness monitoring system for small-scale retailers. It translates the requirements in the System Requirements Specification (SRS) into a concrete architecture: the components that make up the system, how they communicate, where data lives, and why the design decisions in the Proposal and Feasibility Study were made the way they were.

The SAD serves three audiences. Team members use it as the reference for building their assigned subsystem, so that the mobile app, the web app, and the backend agree on the same contracts before code is written. The project mentor and course evaluators use it to check the design against the CS3203 Software Architecture Document template and the project's own SRS. Anyone joining the project later, or extending it into Version 2, uses it to understand why the system is shaped the way it is, not just what it does.

## 1.2 Scope

This document covers the architecture of FreshLens Version 1, as scoped in the Project Proposal (§5.2): the vendor mobile application, the platform administrator web application, the FastAPI backend, the asynchronous inference pipeline (Redis, Celery, and the FreshLens Two-Tier Classifier), the PostgreSQL database with Row-Level Security, and object storage on Cloudflare R2.

It does not cover UI-level visual design (wireframes, mockups, exact screen layouts), which sit outside the SAD's role. It does not cover the internal training procedure or hyperparameters of the ML models. Version 2 features, image-based age estimation, predicted rot-dates, periodic batch re-evaluation, voice-based sale deduction, and multi-item shelf detection, are named here only where they affect a Version 1 design decision (for example, the batch data model is shaped to support them later). Their own architecture is future work, not part of this document.

## 1.3 Definitions and Acronyms

| Term | Meaning |
|---|---|
| SAD | Software Architecture Document (this document) |
| SRS | System Requirements Specification |
| RLS | Row-Level Security (PostgreSQL feature enforcing per-tenant data isolation) |
| JWT | JSON Web Token, used for session authentication |
| CNN | Convolutional Neural Network |
| FL-2TC | FreshLens Two-Tier Classifier (produce identification, then freshness scoring) |
| R2 | Cloudflare R2, the object storage service used for scan images |
| RN | React Native, the mobile app framework |
| API | Application Programming Interface, provided by the FastAPI backend |
| Tenant | A single vendor's account and all data scoped to it |
| Batch | A recorded intake of stock for one product, with quantity and shelf-life tracked over time |
| V1 / V2 | Version 1 (this semester's graded scope) / Version 2 (documented future work) |

## 1.4 References

1. FreshLens Project Proposal, CS3203, Group 21, July 2026.
2. FreshLens Feasibility Study Report, CS3203, Group 21, July 2026.
3. FreshLens System Requirements Specification, §3.1 Vendor Functional Requirements (Mobile), `docs/srs/3.1-functionality-vendor-mobile.md`.
4. FreshLens System Requirements Specification, §3.2 Usability Requirements, `docs/srs/3.2-usability-requirements.md`.
5. PostgreSQL Global Development Group, "Row Security Policies." Available: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
6. FastAPI, "FastAPI Documentation." Available: https://fastapi.tiangolo.com/
7. Meta Platforms Inc., "React Native Documentation." Available: https://reactnative.dev/
8. Diagramming tool used for all figures in this document: **[team to confirm — draw.io / Excalidraw / Mermaid]**.

> Note: the diagram tool listed above is a placeholder. Confirm with the team which tool was actually used for the component, sequence, and package diagrams in §2, §4, and §8, and update this line before final assembly in §12.

## 1.5 Overview of the SAD

The rest of this document is organized as follows.

Section 2 lists which architectural views this document uses (Use-Case, Logical, Process, Deployment, Implementation, Data) and what each one is meant to show for FreshLens specifically.

Section 3 states the architectural goals and constraints driving the design, cost, team size, tenant isolation, async processing, and where those constraints came from in the Feasibility Study.

Section 4 gives the use-case view: the main actors (Vendor, Platform Administrator) and their use cases, with realizations for the core scenarios.

Sections 5 through 9 give the Logical, Process, Deployment, Implementation, and Data views: the components and their responsibilities, how requests flow through the system at runtime, what runs where, how the codebase is laid out, and the database schema.

Sections 10 and 11 cover size, performance, and quality attributes. Section 12 assembles the final references and the complete document.
