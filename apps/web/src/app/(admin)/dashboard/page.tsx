import type { Metadata } from "next";

import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { loadDashboardData } from "@/lib/api/admin-data";
import { AdminDataProvider } from "@/store/admin-data-provider";

export const metadata: Metadata = { title: "Overview" };

export default async function DashboardPage() {
  const { data, overview } = await loadDashboardData();
  return <AdminDataProvider initialData={data}><DashboardOverview overview={overview} /></AdminDataProvider>;
}
