# FreshLens System Requirements Specification (SRS)

CS3203, Group 21, PID 5. Milestone M2 (due 2026-08-09).

Working source for the course SRS. Parent issue: [#5](https://github.com/FreshLens-AI/FreshLens-AI/issues/5).

## Files

| File | Section | Issue |
|------|---------|-------|
| [01-introduction.md](01-introduction.md) | Section 1 Introduction | #34 |
| [02-overall-description.md](02-overall-description.md) | Section 2 Overall Description | #35 |
| [03-1-vendor-mobile.md](03-1-vendor-mobile.md) | Section 3.1 Vendor (mobile) | #36 |
| [03-1-platform-admin.md](03-1-platform-admin.md) | Section 3.1 Platform Admin (web) | #37 |
| [03-1-scan-ml-alerts.md](03-1-scan-ml-alerts.md) | Section 3.1 Scan / ML / alerts | #38 |
| [03-2-usability.md](03-2-usability.md) | Section 3.2 Usability | #39 |
| [03-3-to-5-nfrs.md](03-3-to-5-nfrs.md) | Section 3.3 to 3.5 Reliability, Perf & Security, Supportability | #40 |
| [03-6-to-8-constraints.md](03-6-to-8-constraints.md) | Section 3.6 to 3.8 Constraints, help, purchased components | #41 |
| [03-9-interfaces.md](03-9-interfaces.md) | Section 3.9 Interfaces | #42 |
| [03-10-database.md](03-10-database.md) | Section 3.10 Database requirements | #43 |
| [03-11-to-12-and-4.md](03-11-to-12-and-4.md) | Section 3.11 to 3.12 + Section 4 Supporting information | #44 |
| [FreshLens-SRS.md](FreshLens-SRS.md) | Assembled master document | #5 / #44 |

## Requirement ID prefixes

| Prefix | Meaning |
|--------|---------|
| `FR-V-*` | Vendor / mobile functions |
| `FR-A-*` | Platform admin / web functions |
| `FR-S-*` | Scan pipeline / ML / alerts |
| `NFR-R-*` | Reliability |
| `NFR-P-*` | Performance |
| `NFR-SEC-*` | Security / multi-tenancy |
| `NFR-U-*` | Usability |
| `NFR-SUP-*` | Supportability |
| `DR-*` | Logical database requirements |
| `IR-*` | Interface requirements |

Sales-related IDs (mid-evaluation manual and final V1 voice-assisted): `FR-V-011`, `FR-V-012`, `FR-S-014`, `FR-S-015`, `FR-S-016`, `NFR-R-005`, `NFR-SEC-007`, `NFR-U-009`, `DR-010`, `DR-011`, `IR-HW-003`, `IR-SW-006`, `IR-SW-007`.

Priority: Must = Version 1 graded deliverable; Should = desirable V1 if time; Could = Version 2 / future.

## Authoring rules

- Requirements describe what the system shall do, not how (architecture goes in the SAD, issue #6).
- Each functional requirement states inputs, processing, and outputs where applicable.
- No use-case diagrams in the SRS (SAD Section 4 / issue #48).
- Align enums and paths with [`docs/api/v1/openapi.yaml`](../api/v1/openapi.yaml).
- Before Moodle/Canvas PDF: paste into the official CS3203 SRS template and delete InfoBlue guidance text.

## Sources

- [Project proposal](../proposal/proposal.tex)
- [API V1 contract](../api/README.md)
- [Schedule](../schedule/README.md)
- Architecture rules: `.cursor/rules/freshlens-architecture.mdc`

## Section ownership

| Section | Assignee |
|---------|----------|
| Sections 1, 2, 3.1 scan/ML/alerts, 3.3 to 3.5, 3.6 to 3.8, 3.10, assemble | @buwaneka-halpage |
| Section 3.1 Vendor, 3.2 Usability | @sathurshna |
| Section 3.1 Platform Admin, 3.9 Interfaces | @SMS123456789 |

## Submission steps (remaining)

1. Open [FreshLens-SRS.md](FreshLens-SRS.md) (or section files) and paste into the official CS3203 SRS Word template.
2. Delete all InfoBlue guidance boxes from the template.
3. Export PDF for mentor review (Gantt window about 2026-08-05 to 08-12).
4. After internal acceptance, close GitHub [#5](https://github.com/FreshLens-AI/FreshLens-AI/issues/5) and sub-issues #34 to #44.
