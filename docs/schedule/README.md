# FreshLens project schedule

CS3203 Group 21 · PID 5. Traditional SDLC Gantt covering **2026-07-01 → 2026-10-03**, aligned with Moodle / GitHub milestones M1–M5.

The chart axis pads to full weeks and shows **every calendar day** (day-of-month on the bottom axis, week-start `YYYY-MM-DD` on the top axis).

## Files

| File | Role |
|------|------|
| [`gantt-tasks.yaml`](gantt-tasks.yaml) | Source of truth (phases, verb-form tasks, dates) |
| [`generate_gantt.py`](generate_gantt.py) | Renders landscape PDF |
| [`230602EGanttChart.pdf`](230602EGanttChart.pdf) | Moodle submission PDF (rename per teammate index if needed) |

Teammate copies for individual upload: `230600VGanttChart.pdf`, `230592UGanttChart.pdf` (same chart).

## Regenerate

```bash
pip install pyyaml matplotlib
python docs/schedule/generate_gantt.py
```

Optional:

```bash
python docs/schedule/generate_gantt.py --output docs/schedule/230600VGanttChart.pdf
```

## Milestone mapping

| Milestone | Due | Deliverable focus |
|-----------|-----|-------------------|
| M1 | 2026-07-12 | Proposal, feasibility, schedule |
| M2 | 2026-08-09 | SRS + architecture design |
| M3 | 2026-08-30 | Iteration 1 mid-eval (stub ML OK) |
| M4 | 2026-09-20 | FL-2TC + Celery + alerts |
| M5 | 2026-10-03 | Testing doc, demo video, final report |

Development / implementation intentionally spans **~Jul 13 – Sep 28** and overlaps requirements and design (parallel tracks).

## Issue

Closes GitHub issue #4.
