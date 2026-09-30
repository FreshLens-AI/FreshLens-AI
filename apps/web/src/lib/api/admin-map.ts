import type {
  AdminDataSnapshot,
  Alert,
  Classification,
  PipelineSummary,
  Product,
  Tenant,
  TrendPoint,
} from "@/types/domain";

export interface AdminTenantResponse {
  id: string;
  name: string;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string | null;
  last_active_at: string | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  member_count: number;
  catalogue_coverage: number;
  scans_this_month: number;
  fresh_scans_this_month: number;
  medium_scans_this_month: number;
  spoiled_scans_this_month: number;
  active_alerts: number;
}

export interface AdminProductResponse {
  id: string;
  tenant_id: string;
  tenant_name: string;
  name: string;
  shelf_life_days: number;
  low_stock_threshold: number;
  created_at: string;
  updated_at: string;
  scans_this_month: number;
}

export interface AdminAlertResponse {
  id: string;
  tenant_id: string;
  tenant_name: string;
  type: Alert["type"];
  severity: Alert["severity"];
  message: string;
  product_id: string | null;
  product_name: string | null;
  created_at: string;
}

export interface AdminAnalyticsResponse {
  days: number;
  tenant_id: string | null;
  trend: Array<{
    date: string;
    scans: number;
    fresh: number;
    medium: number;
    spoiled: number;
  }>;
  pipeline: Array<{
    status: PipelineSummary["status"];
    count: number;
  }>;
}

function percentage(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

export function mapAdminTenant(row: AdminTenantResponse): Tenant {
  const completed =
    row.fresh_scans_this_month +
    row.medium_scans_this_month +
    row.spoiled_scans_this_month;
  const classificationMix: Record<Classification, number> = {
    fresh: percentage(row.fresh_scans_this_month, completed),
    medium: percentage(row.medium_scans_this_month, completed),
    spoiled: percentage(row.spoiled_scans_this_month, completed),
  };

  return {
    id: row.id,
    name: row.name,
    ownerName: row.primary_contact_name,
    email: row.primary_contact_email,
    status: row.status,
    createdAt: row.created_at,
    lastActiveAt: row.last_active_at,
    memberCount: row.member_count,
    catalogueCoverage: row.catalogue_coverage,
    scansThisMonth: row.scans_this_month,
    completedClassifications: completed,
    classificationCounts: {
      fresh: row.fresh_scans_this_month,
      medium: row.medium_scans_this_month,
      spoiled: row.spoiled_scans_this_month,
    },
    spoilageRate:
      completed > 0
        ? Math.round((row.spoiled_scans_this_month / completed) * 1000) / 10
        : 0,
    classificationMix,
    activeAlerts: row.active_alerts,
  };
}

export function mapAdminProduct(row: AdminProductResponse): Product {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    tenantName: row.tenant_name,
    name: row.name,
    shelfLifeDays: row.shelf_life_days,
    scansThisMonth: row.scans_this_month,
    lowStockThreshold: row.low_stock_threshold,
    updatedAt: row.updated_at,
  };
}

const alertTitles: Record<Alert["type"], string> = {
  spoilage: "Spoilage signal",
  low_stock: "Low-stock alert",
  aging: "Shelf-life alert",
  other: "Operational alert",
};

export function mapAdminAlert(row: AdminAlertResponse): Alert {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    type: row.type,
    severity: row.severity,
    title: row.product_name
      ? `${alertTitles[row.type]} · ${row.product_name}`
      : alertTitles[row.type],
    message: row.message,
    productId: row.product_id ?? undefined,
    tenantName: row.tenant_name,
    productName: row.product_name ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.created_at,
  };
}

function trendLabel(date: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

const pipelineHelpers: Record<PipelineSummary["status"], string> = {
  pending: "Accepted and waiting for a worker",
  processing: "Currently being classified",
  completed: "Classification result persisted",
  failed: "Terminal classification failures",
};

export function mapAdminData(
  tenantRows: AdminTenantResponse[],
  productRows: AdminProductResponse[],
  alertRows: AdminAlertResponse[],
  analytics: AdminAnalyticsResponse,
): AdminDataSnapshot {
  const products = productRows.map(mapAdminProduct);
  const trend: TrendPoint[] = analytics.trend.map((point) => ({
    label: trendLabel(point.date),
    scans: point.scans,
    fresh: point.fresh,
    medium: point.medium,
    spoiled: point.spoiled,
  }));

  return {
    tenants: tenantRows.map(mapAdminTenant),
    products,
    alerts: alertRows.map(mapAdminAlert),
    trend,
    pipelineSummary: analytics.pipeline.map((item) => ({
      ...item,
      helper: pipelineHelpers[item.status],
    })),
  };
}
