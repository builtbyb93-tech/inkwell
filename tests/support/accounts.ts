import { randomUUID } from 'node:crypto';
import { expect, type APIRequestContext } from '@playwright/test';
import { accountLink } from './mail';
export async function verifiedAuthor(client: APIRequestContext, origin: string) {
  const email = randomUUID() + '@example.test',
    password = 'A quiet place for many ideas 49!';
  const headers = { Origin: origin };
  expect(
    (
      await client.post('/api/v1/auth/register', {
        headers,
        data: { email, password, displayName: 'Idea author' },
      })
    ).status(),
  ).toBe(202);
  const link = await accountLink(email, 'verify-email');
  const token = new URLSearchParams(new URL(link).hash.slice(1)).get('token');
  expect(
    (await client.post('/api/v1/auth/verify-email', { headers, data: { token } })).status(),
  ).toBe(200);
  const csrf = (await (await client.get('/api/v1/auth/csrf')).json()).data.csrfToken;
  expect(
    (
      await client.post('/api/v1/auth/callback/credentials', {
        headers,
        form: {
          email,
          password,
          csrfToken: csrf,
          callbackUrl: origin + '/dashboard',
          json: 'true',
        },
      })
    ).status(),
  ).toBe(200);
  return { email, headers };
}
