import NextAuth from 'next-auth';
import { NextRequest } from 'next/server';
import { LoginInput } from '@inkwell/contracts';
import { authOptions, principal } from '@/server/auth';
import { authConfig } from '@/server/config';
import { endpoint, HttpError, ok, sameOrigin, boundedText } from '@/server/http';
import { publicLimit } from '@/server/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ nextauth: string[] }> };

async function handler(request: NextRequest, context: Context) {
  return endpoint(async () => {
    let forwarded = request;
    const { nextauth } = await context.params;
    const action = nextauth.join('/');
    if (request.method === 'GET' && action === 'session') return ok(await principal(request));
    if (!(
      (request.method === 'GET' && action === 'csrf') ||
      (request.method === 'POST' && ['callback/credentials', 'signout'].includes(action))
    ))
      throw new HttpError(404, 'NOT_FOUND', 'Endpoint not found.');
    if (request.method === 'POST') {
      sameOrigin(request);
      // Limit all auth transport bodies, including CSRF and callback fields.
      const length = request.headers.get('content-length');
      if (length && Number(length) > 8192)
        throw new HttpError(413, 'VALIDATION_ERROR', 'Request content is too large.');
      if (
        request.headers.get('content-type')?.split(';')[0] !== 'application/x-www-form-urlencoded'
      )
        throw new HttpError(415, 'VALIDATION_ERROR', 'Send form content.');
      const text = await boundedText(request, 8192);
      const form = new URLSearchParams(text);
      if (!/^[a-f0-9]{64}$/.test(form.get('csrfToken') ?? ''))
        throw new HttpError(
          400,
          'VALIDATION_ERROR',
          'This request could not be verified. Refresh and try again.',
        );
      forwarded = new NextRequest(request.url, {
        method: 'POST',
        headers: request.headers,
        body: text,
      });
      if (action === 'callback/credentials') {
        const form = new URLSearchParams(text);
        const parsed = LoginInput.safeParse(Object.fromEntries(form));
        if (!parsed.success)
          throw new HttpError(400, 'VALIDATION_ERROR', 'Check your email and password.');
        await publicLimit(request, 'login', parsed.data.email);
      }
    } else await publicLimit(request, 'csrf');
    const response = (await NextAuth(authOptions())(forwarded, {
      params: { nextauth },
    })) as Response;
    const headers = new Headers(response.headers);
    const type = headers.get('content-type') ?? '';
    if (!type.includes('application/json'))
      throw new HttpError(
        400,
        'VALIDATION_ERROR',
        'This request could not be verified. Refresh and try again.',
      );
    const payload = (await response.json()) as { url?: string; csrfToken?: string };
    if (payload.url && new URL(payload.url, request.url).searchParams.has('csrf'))
      throw new HttpError(
        400,
        'VALIDATION_ERROR',
        'This request could not be verified. Refresh and try again.',
      );
    if (payload.url && new URL(payload.url, request.url).searchParams.has('error')) {
      const error = new HttpError(
        401,
        'UNAUTHENTICATED',
        'Unable to sign in. Check your details and verify your email.',
      );
      throw error;
    }
    if (response.status >= 400)
      throw new HttpError(
        503,
        'SERVICE_UNAVAILABLE',
        'Authentication is temporarily unavailable. Please try again.',
      );
    const data = action === 'csrf' ? { csrfToken: payload.csrfToken } : { url: payload.url };
    if (action === 'csrf' && !/^[a-f0-9]{64}$/.test(payload.csrfToken ?? ''))
      throw new HttpError(
        503,
        'SERVICE_UNAVAILABLE',
        'Authentication is temporarily unavailable. Please try again.',
      );
    if (
      action !== 'csrf' &&
      (!payload.url || new URL(payload.url, authConfig().origin).origin !== authConfig().origin)
    )
      throw new HttpError(400, 'VALIDATION_ERROR', 'This request could not be verified.');
    headers.set('Cache-Control', 'no-store');
    headers.delete('content-length');
    // Preserve separate Set-Cookie headers from Auth.js, including chunked tokens.
    headers.delete('set-cookie');
    for (const cookie of response.headers.getSetCookie()) headers.append('set-cookie', cookie);
    return new Response(JSON.stringify({ data }), { status: response.status, headers });
  });
}
export { handler as GET, handler as POST };
