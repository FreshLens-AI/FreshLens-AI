import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { Card } from "@/components/ui/card";

export function StatCard({
  label,
  value,
  helper,
  icon,
  trend,
  tone = "green",
}: {
  label: string;
  value: string;
  helper: string;
  icon: ReactNode;
  trend?: { value: string; direction: "up" | "down"; positive?: boolean };
  tone?: "green" | "blue" | "amber" | "red";
}) {
  const TrendIcon = trend?.direction === "down" ? ArrowDownRight : ArrowUpRight;
  const isPositive = trend?.positive ?? trend?.direction === "up";

  return (
    <Card className="stat-card">
      <div className={`stat-card__icon stat-card__icon--${tone}`}>{icon}</div>
      <div className="stat-card__body">
        <p className="stat-card__label">{label}</p>
        <p className="stat-card__value">{value}</p>
        <div className="stat-card__meta">
          {trend ? (
            <span className={isPositive ? "trend trend--positive" : "trend trend--negative"}>
              <TrendIcon size={14} aria-hidden="true" />
              {trend.value}
            </span>
          ) : null}
          <span>{helper}</span>
        </div>
      </div>
    </Card>
  );
}
