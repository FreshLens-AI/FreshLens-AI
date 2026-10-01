import {
  BellRing,
  ChartNoAxesCombined,
  ClipboardList,
  Gauge,
  Leaf,
  ScanLine,
  Store,
} from "lucide-react";

export const primaryNavigation = [
  { label: "Overview", href: "/dashboard", icon: Gauge },
  { label: "Tenants", href: "/tenants", icon: Store },
  { label: "Applications", href: "/applications", icon: ClipboardList },
  { label: "Catalogue", href: "/catalogue", icon: Leaf },
];

export const insightNavigation = [
  { label: "Scan activity", href: "/scans", icon: ScanLine },
  { label: "Alerts", href: "/alerts", icon: BellRing },
  { label: "Analytics", href: "/analytics", icon: ChartNoAxesCombined },
];
