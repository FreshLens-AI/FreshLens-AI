import type { Metadata } from "next";

import { AlertsIndex } from "@/components/alerts/alerts-index";
import { loadAdminOverview, loadAlertPage } from "@/lib/api/admin-data";

export const metadata: Metadata = { title: "Alerts" };

export default async function AlertsPage({ searchParams }: {
  searchParams: Promise<{ q?: string; type?: string; severity?: string; page?: string }>;
}) {
  const params = await searchParams;
  const search = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const type = params.type === "spoilage" || params.type === "low_stock" || params.type === "aging" || params.type === "other" ? params.type : undefined;
  const severity = params.severity === "info" || params.severity === "warning" || params.severity === "critical" ? params.severity : undefined;
  const [result, overview] = await Promise.all([
    loadAlertPage(Number(params.page) || 1, search, type, severity),
    loadAdminOverview(),
  ]);
  return <AlertsIndex result={result} overview={overview} search={search} type={type ?? "all"} severity={severity ?? "all"} />;
}
