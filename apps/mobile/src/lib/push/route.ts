// Pure helpers for push payloads sent by the worker (packages/ml/worker/push.py).
// Kept free of React Native imports so they run under the Node test runner.

export type PushRoute = 'Alerts' | 'History';

export type PushPayload =
  | { type: 'scan'; scanId: string; status: string | null }
  | { type: 'alert'; alertId: string };

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

export function parsePushPayload(data: unknown): PushPayload | null {
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  if (record.type === 'scan') {
    const scanId = asString(record.scan_id);
    return scanId ? { type: 'scan', scanId, status: asString(record.status) } : null;
  }
  if (record.type === 'alert') {
    const alertId = asString(record.alert_id);
    return alertId ? { type: 'alert', alertId } : null;
  }
  return null;
}

// The payload is only a wake-up; the target screen refetches from the API.
export function routeForNotification(data: unknown): PushRoute | null {
  const payload = parsePushPayload(data);
  if (!payload) return null;
  return payload.type === 'alert' ? 'Alerts' : 'History';
}
