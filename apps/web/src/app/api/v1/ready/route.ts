import { randomUUID } from 'node:crypto';
import type { ApiError, HealthResponse } from '@inkwell/contracts';
import { isReady } from '@/server/readiness';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const headers = { 'Cache-Control': 'no-store' };
  if (await isReady()) {
    return Response.json({ data: { status: 'ready', version: '0.6.0' } } satisfies HealthResponse, {
      headers,
    });
  }
  return Response.json(
    {
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Service is not ready.',
        requestId: randomUUID(),
      },
    } satisfies ApiError,
    { status: 503, headers },
  );
}
