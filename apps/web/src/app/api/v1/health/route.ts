import type { HealthResponse } from '@inkwell/contracts';

export function GET() {
  return Response.json({ data: { status: 'ok', version: '0.6.0' } } satisfies HealthResponse, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
