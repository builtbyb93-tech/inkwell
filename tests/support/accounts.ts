import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext, type APIResponse } from '@playwright/test';
import { setTimeout as delay } from 'node:timers/promises';
import { accountLink } from './mail';
export async function verifiedAuthor(client: APIRequestContext, origin: string) {
  // Fast CI can legitimately exhaust the shared loopback auth bucket. Honor its
  // advertised wait without disabling limits or inventing trusted proxy headers.
  test.setTimeout(Math.max(test.info().timeout, 120000));
  const email = randomUUID() + '@example.test',
    password = 'A quiet place for many ideas 49!';
  const headers = { Origin: origin };
  expect(
    (
      await publicRequest(() =>
        client.post('/api/v1/auth/register', {
          headers,
          data: { email, password, displayName: 'Idea author' },
        }),
      )
    ).status(),
  ).toBe(202);
  const link = await accountLink(email, 'verify-email');
  const token = new URLSearchParams(new URL(link).hash.slice(1)).get('token');
  expect(
    (
      await publicRequest(() =>
        client.post('/api/v1/auth/verify-email', { headers, data: { token } }),
      )
    ).status(),
  ).toBe(200);
  const csrf = (await (await publicRequest(() => client.get('/api/v1/auth/csrf'))).json()).data
    .csrfToken;
  expect(
    (
      await publicRequest(() =>
        client.post('/api/v1/auth/callback/credentials', {
          headers,
          form: {
            email,
            password,
            csrfToken: csrf,
            callbackUrl: origin + '/dashboard',
            json: 'true',
          },
        }),
      )
    ).status(),
  ).toBe(200);
  return { email, headers };
}

async function publicRequest(action: () => Promise<APIResponse>) {
  let response = await action();
  if (response.status() === 429) {
    const seconds = Number(response.headers()['retry-after']);
    expect(Number.isFinite(seconds) && seconds > 0 && seconds <= 60).toBe(true);
    await delay(seconds * 1000 + 100);
    response = await action();
  }
  expect(response.status()).not.toBe(429);
  return response;
}
