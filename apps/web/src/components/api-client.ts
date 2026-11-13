'use client';
export class ApiClientError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; version?: number; requestKey?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.requestKey) headers['Idempotency-Key'] = options.requestKey;
  if (options.version !== undefined) headers['If-Match'] = `"${options.version}"`;
  const response = await fetch('/api/v1' + path, {
    method: options.method ?? 'GET',
    headers,
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    cache: 'no-store',
  });
  const result = await response.json();
  if (!response.ok)
    throw new ApiClientError(
      result.error?.message ?? 'Something went wrong. Please try again.',
      response.status,
    );
  return result.data as T;
}
export async function authPost(action: string, fields: Record<string, string> = {}) {
  const { csrfToken } = await api<{ csrfToken: string }>('/auth/csrf');
  const response = await fetch('/api/v1/auth/' + action, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      ...fields,
      csrfToken,
      callbackUrl: window.location.origin + '/dashboard',
      json: 'true',
    }),
    cache: 'no-store',
  });
  const result = await response.json();
  if (!response.ok)
    throw new ApiClientError(
      result.error?.message ?? 'Unable to complete this request.',
      response.status,
    );
  return result.data;
}
export function message(error: unknown) {
  return error instanceof ApiClientError ? error.message : 'Unable to connect. Please try again.';
}
