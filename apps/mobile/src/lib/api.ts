import { File } from 'expo-file-system';
import { supabase } from './supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

if (!API_URL) {
  throw new Error(
    "Missing EXPO_PUBLIC_API_URL. Add it to apps/mobile/.env — use your " +
    "computer's LAN IP (not 'localhost'), since a physical phone/simulator " +
    "cannot reach your Mac's localhost."
  );
}

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not authenticated');
  return { Authorization: `Bearer ${token}` };
}

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

export interface SaleItemInput {
  product_id: string;
  batch_id: string;
  quantity_sold: number;
}

export interface SaleItem extends SaleItemInput {
  id: string;
  quantity_remaining: number;
}

export interface Sale {
  id: string;
  source: 'manual' | 'voice';
  items: SaleItem[];
  created_at: string;
}

export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertType = 'spoilage' | 'low_stock' | 'aging' | 'other';

export interface Alert {
  id: string;
  type: AlertType;
  message: string;
  severity: AlertSeverity;
  created_at: string;
  batch_id: string | null;
  product_id: string | null;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function parseJsonOrThrow(res: Response) {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail);
    } catch {
      // response wasn't JSON; fall back to statusText
    }
    throw new ApiError(res.status, detail);
  }
  return res.json();
}

// FR-V-04 Submit Scan
// Expo SDK 57 uses a spec-compliant FormData that requires a real File/Blob,
// not the old React Native shorthand { uri, name, type } — that shorthand
// now throws "Unsupported FormDataPart implementation".
export async function submitScan(photoUri: string, quantity: number): Promise<ScanAccepted> {
  const headers = await authHeader();
  const file = new File(photoUri);

  const form = new FormData();
  form.append('image', file, 'scan.jpg');
  form.append('quantity', String(quantity));

  const res = await fetch(`${API_URL}/api/v1/scans`, {
    method: 'POST',
    headers,
    body: form,
  });
  return parseJsonOrThrow(res);
}

// FR-V-05 View Scan Result Status
export async function getScan(scanId: string): Promise<Scan> {
  const headers = await authHeader();
  const res = await fetch(`${API_URL}/api/v1/scans/${scanId}`, { headers });
  return parseJsonOrThrow(res);
}

// FR-V-06 Dashboard support
export async function listScans(limit = 20, offset = 0) {
  const headers = await authHeader();
  const res = await fetch(`${API_URL}/api/v1/scans?limit=${limit}&offset=${offset}`, { headers });
  return parseJsonOrThrow(res);
}

// FR-V-011 support
export async function listProducts(): Promise<{ items: ProductSummary[] }> {
  const headers = await authHeader();
  const res = await fetch(`${API_URL}/api/v1/products`, { headers });
  return parseJsonOrThrow(res);
}

export async function listBatches(productId?: string): Promise<{ items: BatchSummary[] }> {
  const headers = await authHeader();
  const qs = productId ? `?product_id=${productId}` : '';
  const res = await fetch(`${API_URL}/api/v1/batches${qs}`, { headers });
  return parseJsonOrThrow(res);
}

export async function createSale(items: SaleItemInput[], idempotencyKey: string): Promise<Sale> {
  const headers = await authHeader();
  const res = await fetch(`${API_URL}/api/v1/sales`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ source: 'manual', items }),
  });
  return parseJsonOrThrow(res);
}

// FR-V-07 Alerts
export async function listAlerts(limit = 20, offset = 0) {
  const headers = await authHeader();
  const res = await fetch(`${API_URL}/api/v1/alerts?limit=${limit}&offset=${offset}`, { headers });
  return parseJsonOrThrow(res);
}
