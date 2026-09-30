import type { Metadata } from "next";

import { ScanActivity } from "@/components/analytics/scan-activity";
import { loadAdminAnalytics } from "@/lib/api/admin-data";
import { AdminDataProvider } from "@/store/admin-data-provider";

export const metadata: Metadata = { title: "Scan activity" };

export default async function ScansPage() {
  const data = await loadAdminAnalytics();
  return <AdminDataProvider initialData={data}><ScanActivity /></AdminDataProvider>;
}
