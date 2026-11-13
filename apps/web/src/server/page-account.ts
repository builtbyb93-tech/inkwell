import 'server-only';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextRequest } from 'next/server';
import { principal } from './auth';
import { authConfig } from './config';
import { HttpError } from './http';
export async function requireAccount() {
  const incoming = await headers();
  try {
    return await principal(
      new NextRequest(authConfig().origin, { headers: { cookie: incoming.get('cookie') ?? '' } }),
    );
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) redirect('/sign-in');
    // eslint-disable-next-line preserve-caught-error -- Do not attach private driver/configuration details to Next logs.
    throw new Error('Account service is temporarily unavailable. Please try again.');
  }
}
