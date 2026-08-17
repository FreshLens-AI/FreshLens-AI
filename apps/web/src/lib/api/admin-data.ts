import "server-only";

import { adminApiFetch } from "@/lib/api/client";
import {
  mapAdminData,
  type AdminAlertResponse,
  type AdminAnalyticsResponse,
  type AdminProductResponse,
  type AdminTenantResponse,
} from "@/lib/api/admin-map";
import type { AdminDataSnapshot } from "@/types/domain";

interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

async function readJson<T>(path: string): Promise<T> {
  const response = await adminApiFetch(path);
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        `Admin API route /${path.replace(/^\/+/, "")} was not found. Restart FastAPI on the current branch.`,
      );
    }
    let detail = `Admin API request failed (${response.status}).`;
    try {
      const body = (await response.json()) as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {
      // Preserve the status-based message when the API did not return JSON.
    }
    throw new Error(`GET /${path.replace(/^\/+/, "")} failed: ${detail}`);
  }
  return (await response.json()) as T;
}

async function readAll<T>(path: string): Promise<T[]> {
  const items: T[] = [];
  let offset = 0;
  const limit = 100;

  do {
    const separator = path.includes("?") ? "&" : "?";
    const page = await readJson<Page<T>>(
      `${path}${separator}limit=${limit}&offset=${offset}`,
    );
    items.push(...page.items);
    offset += page.items.length;
    if (page.items.length === 0 || items.length >= page.total) break;
  } while (true);

  return items;
}

export async function loadAdminData(): Promise<AdminDataSnapshot> {
  const [tenants, products, alerts, analytics] = await Promise.all([
    readAll<AdminTenantResponse>("api/v1/admin/tenants"),
    readAll<AdminProductResponse>("api/v1/admin/products"),
    readAll<AdminAlertResponse>("api/v1/admin/alerts"),
    readJson<AdminAnalyticsResponse>("api/v1/admin/analytics?days=90"),
  ]);

  return mapAdminData(tenants, products, alerts, analytics);
}
