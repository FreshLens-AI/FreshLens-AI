import type { Metadata } from "next";

import { AlertsIndex } from "@/components/alerts/alerts-index";

export const metadata: Metadata = { title: "Alerts" };

export default function AlertsPage() {
  return <AlertsIndex />;
}
