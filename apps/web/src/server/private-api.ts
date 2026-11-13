import 'server-only';
import type { NextRequest } from 'next/server';
import type { AccountRecord } from '@inkwell/contracts';
import { principal } from './auth';
import { endpoint, sameOrigin } from './http';
import { limit } from './rate-limit';
export function privateApi(
  request: NextRequest,
  action: (account: AccountRecord) => Promise<Response>,
) {
  return endpoint(async () => {
    if (!['GET', 'HEAD'].includes(request.method)) sameOrigin(request);
    const account = await principal(request);
    await limit('private-api', account.id, 180);
    return action(account);
  });
}
