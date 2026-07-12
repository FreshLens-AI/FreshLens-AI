# FreshLens project schedule

CS3203 Group 21 · PID 5. Traditional SDLC Gantt covering **2026-07-01 → 2026-10-11**, aligned to the CS3203 batch-23 deadlines sheet.

The chart axis pads to full weeks and shows **every calendar day** (day-of-month on the bottom axis, week-start `YYYY-MM-DD` on the top axis), plus horizontal row grid lines.

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

## Deadline mapping (batch-23)

| Due | Deliverable |
|-----|-------------|
| 2026-07-05 | Project proposal |
| 2026-07-12 | Feasibility document + Gantt chart |
| 2026-08-09 | SRS + System Architecture and Design |
| 2026-08-10 – 08-14 | Progress Review 1 (Iteration 1) |
| 2026-08-15 – 08-30 | Mid evaluation (Iteration 1 demo) |
| 2026-09-27 | Testing document |
| 2026-09-28 – 10-02 | Progress Review 2 (Iteration 2) |
| 2026-10-02 | Demo video (YouTube) |
| 2026-10-03 | Final report + source zip |
| 2026-10-03 – 10-11 | Final evaluation |

Development / implementation intentionally overlaps requirements and design (parallel tracks).

## Issue

Closes GitHub issue #4.
