import "server-only";

import { mapAdminData, mapAdminTenantUser, type AdminAnalyticsResponse, type AdminTenantUserResponse } from "@/lib/api/admin-map";
import { tenantApiFetch } from "@/lib/api/client";
import type { AdminDataSnapshot, TenantUser } from "@/types/domain";

export interface TenantOverview {
  tenant_name: string;
  tenant_status: "active" | "inactive";
  team_members: number;
  catalogue_products: number;
  active_batches: number;
  units_in_stock: number;
  active_alerts: number;
  scans_this_month: number;
  fresh_scans_this_month: number;
  medium_scans_this_month: number;
  spoiled_scans_this_month: number;
}

async function readJson<T>(path: string): Promise<T> {
  const response = await tenantApiFetch(path);
  if (!response.ok) throw new Error(`Tenant API request failed (${response.status}).`);
  return (await response.json()) as T;
}

export function loadTenantOverview() {
  return readJson<TenantOverview>("api/v1/tenant/overview");
}

export async function loadTenantAnalytics(days = 30): Promise<AdminDataSnapshot> {
  const response = await readJson<AdminAnalyticsResponse>(`api/v1/tenant/analytics?days=${days}`);
  return mapAdminData([], [], [], response);
}

export async function loadTenantUsers(): Promise<TenantUser[]> {
  const response = await readJson<{ items: AdminTenantUserResponse[] }>("api/v1/tenant/users");
  return response.items.map(mapAdminTenantUser);
}

export interface StockBatch {
  id: string;
  product_name: string;
  intake_date: string;
  quantity_received: number;
  quantity_remaining: number;
  current_freshness: "fresh" | "medium" | "spoiled" | null;
  fresh_to_medium_at: string | null;
  medium_to_spoiled_at: string | null;
}
export interface SalesHistory {
  items: { id: string; sale_id: string; batch_id: string; product_name: string; seller: string; source: string; quantity_sold: number; created_at: string }[];
  trend: { date: string; transactions: number; units: number }[];
  total: number;
  days: number;
  limit: number;
  offset: number;
}
export async function loadTenantStock() {
  return (await readJson<{ items: StockBatch[] }>("api/v1/batches")).items;
}
export function loadTenantSales(days: number, page: number) {
  return readJson<SalesHistory>(`api/v1/tenant/sales?days=${days}&limit=25&offset=${(page - 1) * 25}`);
}
