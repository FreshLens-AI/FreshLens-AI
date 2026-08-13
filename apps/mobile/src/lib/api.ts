import { File } from 'expo-file-system';

import { parseVendorClaims } from './auth/claims';
import { reportSessionExpired } from './auth/session-events';
import { getSupabaseClient } from './supabase';

const apiUrl = process.env.EXPO_PUBLIC_API_URL;

export type ScanStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type Classification = 'fresh' | 'medium' | 'spoiled';

export interface ScanAccepted {
  id: string;
  status: ScanStatus;
  created_at: string;
}

export interface Scan {
  id: string;
  tenant_id: string;
  status: ScanStatus;
  image_path: string;
  quantity: number;
  classification: Classification | null;
  freshness_score: number | null;
  model_version: string | null;
  product_id: string | null;
  batch_id: string | null;
  created_at: string;
  updated_at: string;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  if (!apiUrl) throw new Error('EXPO_PUBLIC_API_URL is not configured.');

  const supabase = getSupabaseClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !parseVendorClaims(claimsData?.claims)) {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    reportSessionExpired();
    throw new Error('A valid vendor session is required.');
  }

  const { data, error: sessionError } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (sessionError || !accessToken) {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    reportSessionExpired();
    throw new Error('A valid vendor session is required.');
  }

  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);
  const response = await fetch(`${apiUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`, {
    ...init,
    headers,
  });
  if (response.status === 401) {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    reportSessionExpired();
  }
  return response;
}

async function parseJsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail =
        typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail);
    } catch {
      // non-JSON error body
    }
    throw new ApiError(res.status, detail || 'Request failed.');
  }
  return res.json() as Promise<T>;
}

/** Multipart scan submit. Requires Day-2 POST /api/v1/scans. Never sends tenant_id. */
export async function submitScan(
  photoUri: string,
  quantity: number,
): Promise<ScanAccepted> {
  // Expo SDK 57 FormData needs a real File/Blob, not the old { uri, name, type } shorthand.
  const file = new File(photoUri);
  const form = new FormData();
  form.append('image', file, 'scan.jpg');
  form.append('quantity', String(quantity));

  const res = await apiFetch('api/v1/scans', { method: 'POST', body: form });
  return parseJsonOrThrow<ScanAccepted>(res);
}

export async function getScan(scanId: string): Promise<Scan> {
  const res = await apiFetch(`api/v1/scans/${scanId}`);
  return parseJsonOrThrow<Scan>(res);
}

export interface ProductSummary {
  id: string;
  name: string;
  low_stock_threshold: number;
}

export interface BatchSummary {
  id: string;
  product_id: string;
  intake_date: string;
  quantity_remaining: number;
}

export interface Sale {
  id: string;
  source: 'manual' | 'voice';
  items: {
    id: string;
    product_id: string;
    batch_id: string;
    quantity_sold: number;
    quantity_remaining: number;
  }[];
  created_at: string;
}

export interface Alert {
  id: string;
  type: 'spoilage' | 'low_stock' | 'aging' | 'other';
  message: string;
  severity: 'info' | 'warning' | 'critical';
  created_at: string;
  batch_id: string | null;
  product_id: string | null;
}

export async function listProducts(): Promise<ProductSummary[]> {
  const res = await apiFetch('api/v1/products');
  const body = await parseJsonOrThrow<{ items: ProductSummary[] }>(res);
  return body.items;
}

export async function listBatches(productId: string): Promise<BatchSummary[]> {
  const res = await apiFetch(`api/v1/batches?product_id=${productId}&active_only=true`);
  const body = await parseJsonOrThrow<{ items: BatchSummary[] }>(res);
  return body.items;
}

export async function createSale(input: {
  productId: string;
  batchId: string;
  quantitySold: number;
  idempotencyKey: string;
}): Promise<Sale> {
  const res = await apiFetch('api/v1/sales', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': input.idempotencyKey,
    },
    body: JSON.stringify({
      source: 'manual',
      items: [
        {
          product_id: input.productId,
          batch_id: input.batchId,
          quantity_sold: input.quantitySold,
        },
      ],
    }),
  });
  return parseJsonOrThrow<Sale>(res);
}

export async function listAlerts(): Promise<Alert[]> {
  const res = await apiFetch('api/v1/alerts');
  const body = await parseJsonOrThrow<{ items: Alert[] }>(res);
  return body.items;
}
