import { fetch as expoFetch } from 'expo/fetch';

import type { TenantApplicationInput } from './tenant-application-validation';

const apiUrl = process.env.EXPO_PUBLIC_API_URL;

export interface TenantApplicationSubmitted {
  id: string;
  status: 'pending';
  message: string;
}

export async function submitTenantApplication(
  input: TenantApplicationInput,
): Promise<TenantApplicationSubmitted> {
  if (!apiUrl) throw new Error('EXPO_PUBLIC_API_URL is not configured.');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await expoFetch(
      `${apiUrl.replace(/\/$/, '')}/api/v1/tenant-applications`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Bypass-Tunnel-Reminder': 'true',
        },
        body: JSON.stringify({
          organization_name: input.organization.trim(),
          applicant_name: input.name.trim(),
          applicant_email: input.email.trim().toLowerCase(),
          phone: input.phone.trim() || null,
        }),
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      throw new Error(`Tenant application failed with status ${response.status}.`);
    }
    return response.json() as Promise<TenantApplicationSubmitted>;
  } finally {
    clearTimeout(timeout);
  }
}
