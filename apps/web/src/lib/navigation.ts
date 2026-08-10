import {
  BellRing,
  ChartNoAxesCombined,
  Gauge,
  Leaf,
  ScanLine,
  Settings2,
  Store,
} from "lucide-react";

export const primaryNavigation = [
  { label: "Overview", href: "/dashboard", icon: Gauge },
  { label: "Tenants", href: "/tenants", icon: Store },
  { label: "Catalogue", href: "/catalogue", icon: Leaf },
  { label: "Shelf-life rules", href: "/shelf-life", icon: Settings2 },
];

export const insightNavigation = [
  { label: "Scan activity", href: "/scans", icon: ScanLine },
  { label: "Alerts", href: "/alerts", icon: BellRing },
  { label: "Analytics", href: "/analytics", icon: ChartNoAxesCombined },
];
