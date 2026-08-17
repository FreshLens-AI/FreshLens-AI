import type { Metadata } from "next";

import { ScanActivity } from "@/components/analytics/scan-activity";

export const metadata: Metadata = { title: "Scan activity" };

export default function ScansPage() {
  return <ScanActivity />;
}
