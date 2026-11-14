import 'server-only';
import { isIP } from 'node:net';
import { ShareAccessInput } from '@inkwell/contracts';
import { canonicalJson } from '@inkwell/domain';
import { endpoint, sameOrigin, json, ok } from './http';
import { limit } from './rate-limit';
import { accessShared } from './snapshots';
export async function sharedApi(request: Request, download = false) {
  const response = await endpoint(async () => {
    sameOrigin(request);
    const forwarded =
        process.env.TRUST_PROXY === 'true'
          ? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
          : undefined,
      ip = forwarded && isIP(forwarded) ? forwarded : 'untrusted';
    await limit('share-global', 'all', 600);
    await limit('share-ip', ip, 60);
    const input = await json(request, ShareAccessInput),
      result = await accessShared(input.token, download);
    return download
      ? new Response(canonicalJson(result.document), {
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': 'attachment; filename="inkwell-snapshot.json"',
          },
        })
      : ok(result);
  });
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Surrogate-Control', 'no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  return response;
}
