import "server-only";

import { adminApiFetch } from "@/lib/api/client";
import {
  mapAdminAlert,
  mapAdminData,
  mapAdminProduct,
  mapAdminTenant,
  type AdminAlertResponse,
  type AdminAnalyticsResponse,
  type AdminProductResponse,
  type AdminTenantResponse,
} from "@/lib/api/admin-map";
import type { Alert, AdminDataSnapshot, Product, Tenant } from "@/types/domain";

interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdminOverview {
  total_tenants: number;
  active_tenants: number;
  total_products: number;
  active_alerts: number;
  critical_alerts: number;
  affected_tenants: number;
  monthly_scans: number;
  monthly_fresh: number;
  monthly_medium: number;
  monthly_spoiled: number;
}

export interface ListPage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

async function readJson<T>(path: string): Promise<T> {
  const response = await adminApiFetch(path);
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Admin API route /${path.split("?")[0]} was not found. Restart FastAPI on the current branch.`);
    }
    let detail = `Admin API request failed (${response.status}).`;
    try {
      const body = (await response.json()) as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {
      // Preserve the status-based message when the API did not return JSON.
    }
    throw new Error(`GET /${path.split("?")[0]} failed: ${detail}`);
  }
  return (await response.json()) as T;
}

function listPath(resource: string, options: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(options)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return `api/v1/admin/${resource}?${params}`;
}

async function loadPage<TResponse, TDomain>(
  resource: string,
  page: number,
  pageSize: number,
  options: Record<string, string | number | undefined>,
  map: (item: TResponse) => TDomain,
): Promise<ListPage<TDomain>> {
  const safePage = Number.isSafeInteger(page) && page > 0 ? Math.min(page, 100000) : 1;
  let response = await readJson<Page<TResponse>>(listPath(resource, {
    ...options, limit: pageSize, offset: (safePage - 1) * pageSize,
  }));
  if (safePage > 1 && response.items.length === 0) {
    response = await readJson<Page<TResponse>>(listPath(resource, {
      ...options, limit: pageSize, offset: 0,
    }));
    return { items: response.items.map(map), total: response.total, page: 1, pageSize };
  }
  return { items: response.items.map(map), total: response.total, page: safePage, pageSize };
}

export function loadTenantPage(page = 1, search = "", status?: string, tenantId?: string, pageSize = 8) {
  return loadPage<AdminTenantResponse, Tenant>(
    "tenants", page, pageSize, { search, status, tenant_id: tenantId }, mapAdminTenant,
  );
}

export function loadProductPage(page = 1, search = "", tenantId?: string, productId?: string, pageSize = 12) {
  return loadPage<AdminProductResponse, Product>(
    "products", page, pageSize, { search, tenant_id: tenantId, product_id: productId }, mapAdminProduct,
  );
}

export function loadAlertPage(page = 1, search = "", alertType?: string, severity?: string) {
  return loadPage<AdminAlertResponse, Alert>(
    "alerts", page, 12, { search, alert_type: alertType, severity }, mapAdminAlert,
  );
}

export async function loadAdminOverview() {
  return readJson<AdminOverview>("api/v1/admin/overview");
}

export async function loadAdminAnalytics(days = 90, tenantId?: string): Promise<AdminDataSnapshot> {
  const response = await readJson<AdminAnalyticsResponse>(listPath("analytics", {
    days, tenant_id: tenantId,
  }));
  return mapAdminData([], [], [], response);
}

export async function loadDashboardData() {
  const [tenants, alerts, analytics, overview] = await Promise.all([
    loadTenantPage(1),
    loadAlertPage(1),
    loadAdminAnalytics(),
    loadAdminOverview(),
  ]);
  return {
    data: { ...analytics, tenants: tenants.items.slice(0, 4), alerts: alerts.items.slice(0, 3) },
    overview,
  };
}
