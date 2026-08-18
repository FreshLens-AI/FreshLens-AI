import { fetch as expoFetch } from 'expo/fetch';
import { File as ExpoFile } from 'expo-file-system';

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
  identity_label: string | null;
  identity_score: number | null;
  identity_model_version: string | null;
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
  const { data, error: sessionError } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (sessionError || !accessToken) {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    reportSessionExpired();
    throw new Error('A valid vendor session is required.');
  }

  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await expoFetch(`${apiUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`, {
      ...init,
      headers,
      signal: controller.signal,
    });
    if (response.status === 401) {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
      reportSessionExpired();
    }
    return response;
  } finally {
    clearTimeout(timeout);
  }
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

/** Multipart scan submit — POST /api/v1/scans. */
export async function submitScan(
  photoUri: string,
  quantity: number,
): Promise<ScanAccepted> {
  // Camera URIs are device-local files. Fetching a file:// URI on Android can
  // return a successful-looking "File not found" response, which then gets
  // uploaded as text. Expo's File implements Blob and streams the real bytes.
  const image = new ExpoFile(photoUri);
  if (!image.exists || image.size === 0) {
    throw new ApiError(422, 'Captured photo is no longer available. Please retake it.');
  }

  const form = new FormData();
  form.append('image', image, image.name || 'scan.jpg');
  form.append('quantity', String(quantity));

  console.log('[submitScan] uploading file size=', image.size, 'qty=', quantity);
  const res = await apiFetch('api/v1/scans', { method: 'POST', body: form });
  console.log('[submitScan] response status=', res.status);
  return parseJsonOrThrow<ScanAccepted>(res);
}

export async function getScan(scanId: string): Promise<Scan> {
  const res = await apiFetch(`api/v1/scans/${scanId}`);
  return parseJsonOrThrow<Scan>(res);
}

export async function listScans(
  limit: number = 20,
  offset: number = 0,
): Promise<{ items: Scan[]; total: number; limit: number; offset: number }> {
  const res = await apiFetch(`api/v1/scans?limit=${limit}&offset=${offset}`);
  return parseJsonOrThrow<{ items: Scan[]; total: number; limit: number; offset: number }>(res);
}

export function parseIdentifiedProduce(modelVersion: string | null | undefined): string {
  if (!modelVersion) return 'Standard Produce';
  const prefixMatch = modelVersion.match(/^yolo26[a-z]*-cls:\s*(.+)$/i);
  if (prefixMatch && prefixMatch[1]) {
    return prefixMatch[1].trim();
  }
  return modelVersion;
}

export function getIdentifiedProduce(
  scan: Pick<Scan, 'identity_label' | 'identity_model_version' | 'model_version'>,
): string {
  const identity = scan.identity_label?.trim();
  if (identity) return identity;
  // A populated identity model version means the new classifier ran and
  // deliberately rejected the image as unknown. Only parse model_version for
  // scans produced by the pre-identity schema.
  if (scan.identity_model_version) return 'Unknown produce';
  return parseIdentifiedProduce(scan.model_version);
}

export function getProduceEmoji(name?: string | null): string {
  if (!name) return '🥬';
  const n = name.toLowerCase();
  if (n.includes('apple')) return '🍎';
  if (n.includes('banana')) return '🍌';
  if (n.includes('tomato')) return '🍅';
  if (n.includes('strawberr')) return '🍓';
  if (n.includes('orange') || n.includes('citrus')) return '🍊';
  if (n.includes('potato')) return '🥔';
  if (n.includes('pepper')) return '🫑';
  if (n.includes('broccoli')) return '🥦';
  if (n.includes('carrot')) return '🥕';
  if (n.includes('cucumber')) return '🥒';
  if (n.includes('grape')) return '🍇';
  if (n.includes('mango')) return '🥭';
  if (n.includes('avocado')) return '🥑';
  if (n.includes('lemon')) return '🍋';
  return '🥬';
}

export function getFreshnessBadge(classification: Classification | null | undefined): {
  label: string;
  badgeBg: string;
  badgeColor: string;
} {
  switch (classification) {
    case 'fresh':
      return { label: 'Fresh', badgeBg: '#e8f5ed', badgeColor: '#196a49' };
    case 'medium':
      return { label: 'Medium', badgeBg: '#fff8e6', badgeColor: '#c47d00' };
    case 'spoiled':
      return { label: 'Spoiled', badgeBg: '#ffebe9', badgeColor: '#ba1a1a' };
    default:
      return { label: 'Pending', badgeBg: '#edf2ee', badgeColor: '#536158' };
  }
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
