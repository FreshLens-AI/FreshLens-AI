#!/usr/bin/env python3
"""Generate landscape A4 FreshLens Gantt chart PDF from gantt-tasks.yaml."""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timedelta
from pathlib import Path

try:
    import yaml
except ImportError:
    sys.exit("Missing PyYAML. Install with: pip install pyyaml matplotlib")

try:
    import matplotlib.pyplot as plt
    import matplotlib.dates as mdates
    from matplotlib.patches import Patch
except ImportError:
    sys.exit("Missing matplotlib. Install with: pip install pyyaml matplotlib")


HERE = Path(__file__).resolve().parent
DEFAULT_YAML = HERE / "gantt-tasks.yaml"


def parse_date(value: str) -> datetime:
    return datetime.strptime(value, "%Y-%m-%d")


def load_schedule(path: Path) -> dict:
    with path.open(encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def build_rows(schedule: dict) -> list[dict]:
    """Flatten phases into chart rows (phase headers + tasks)."""
    rows: list[dict] = []
    for phase in schedule["phases"]:
        rows.append(
            {
                "kind": "phase",
                "label": phase["name"],
                "color": phase["color"],
                "start": None,
                "end": None,
            }
        )
        for task in phase["tasks"]:
            rows.append(
                {
                    "kind": "task",
                    "label": task["name"],
                    "color": phase["color"],
                    "start": parse_date(task["start"]),
                    "end": parse_date(task["end"]) + timedelta(days=1),  # inclusive end
                }
            )
    return rows


def generate_pdf(schedule: dict, out_path: Path) -> None:
    rows = build_rows(schedule)
    project_start = parse_date(schedule["project_start"])
    project_end = parse_date(schedule["project_end"]) + timedelta(days=1)
    milestones = schedule["milestones"]

    n = len(rows)
    # A4 landscape inches; height scales with rows but capped to ~2 pages worth
    row_h = 0.22
    fig_h = max(8.27, min(16.5, 1.4 + n * row_h))
    fig_w = 11.69  # A4 landscape width

    fig, ax = plt.subplots(figsize=(fig_w, fig_h))
    fig.subplots_adjust(left=0.32, right=0.98, top=0.92, bottom=0.08)

    y_positions = list(range(n - 1, -1, -1))

    for y, row in zip(y_positions, rows):
        if row["kind"] == "phase":
            ax.axhspan(y - 0.45, y + 0.45, color=row["color"], alpha=0.12, zorder=0)
            ax.text(
                0.0,
                y,
                row["label"],
                transform=ax.get_yaxis_transform(),
                ha="right",
                va="center",
                fontsize=7.5,
                fontweight="bold",
                color="#1a1a1a",
                clip_on=False,
            )
            continue

        start_num = mdates.date2num(row["start"])
        end_num = mdates.date2num(row["end"])
        ax.barh(
            y,
            end_num - start_num,
            left=start_num,
            height=0.55,
            color=row["color"],
            edgecolor="white",
            linewidth=0.4,
            alpha=0.9,
            zorder=2,
        )
        ax.text(
            0.0,
            y,
            "  " + row["label"],
            transform=ax.get_yaxis_transform(),
            ha="right",
            va="center",
            fontsize=5.8,
            color="#222222",
            clip_on=False,
        )

    # Milestone markers
    for ms in milestones:
        ms_date = parse_date(ms["date"])
        x = mdates.date2num(ms_date)
        ax.axvline(x, color="#333333", linestyle="--", linewidth=0.7, alpha=0.55, zorder=1)
        ax.plot(x, n - 0.2, marker="D", markersize=5, color="#111111", zorder=3)
        ax.text(
            x,
            n + 0.15,
            ms["label"],
            ha="center",
            va="bottom",
            fontsize=5.5,
            rotation=40,
            color="#111111",
        )

    ax.set_ylim(-0.8, n + 1.2)
    ax.set_xlim(mdates.date2num(project_start), mdates.date2num(project_end))
    ax.xaxis_date()
    ax.xaxis.set_major_locator(mdates.WeekdayLocator(byweekday=mdates.MO, interval=2))
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%b %d"))
    ax.xaxis.set_minor_locator(mdates.WeekdayLocator(byweekday=mdates.MO))
    ax.tick_params(axis="x", labelsize=6.5, rotation=45)
    ax.set_yticks([])
    ax.set_ylabel("")
    ax.grid(axis="x", which="major", linestyle=":", linewidth=0.5, alpha=0.5)
    ax.spines["left"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["top"].set_visible(False)

    ax.set_title(schedule["title"], fontsize=11, fontweight="bold", pad=18)

    legend_handles = [
        Patch(facecolor=p["color"], edgecolor="none", label=p["name"])
        for p in schedule["phases"]
    ]
    ax.legend(
        handles=legend_handles,
        loc="lower center",
        bbox_to_anchor=(0.5, -0.06),
        ncol=3,
        fontsize=5.5,
        frameon=False,
    )

    index = schedule.get("index_number", "")
    fig.text(
        0.99,
        0.01,
        f"{index}GanttChart  ·  Traditional SDLC  ·  Jul–Oct 2026",
        ha="right",
        va="bottom",
        fontsize=6,
        color="#555555",
    )

    out_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out_path, format="pdf", dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"Wrote {out_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--input",
        type=Path,
        default=DEFAULT_YAML,
        help="Path to gantt-tasks.yaml",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Output PDF path (default: {index}GanttChart.pdf beside YAML)",
    )
    args = parser.parse_args()

    schedule = load_schedule(args.input)
    index = schedule.get("index_number", "schedule")
    out = args.output or (HERE / f"{index}GanttChart.pdf")
    generate_pdf(schedule, out)


if __name__ == "__main__":
    main()
