import 'server-only';
import { reportFailure } from './observability';
import { NextResponse } from 'next/server';
import { expectedVersion } from '@inkwell/domain';
import type { ApiErrorCode } from '@inkwell/contracts';
import type { z } from 'zod';
import { authConfig } from './config';

type Code = z.infer<typeof ApiErrorCode>;
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: Code,
    message: string,
  ) {
    super(message);
  }
}
export function ok(data: unknown, status = 200, version?: number) {
  const headers: Record<string, string> = { 'Cache-Control': 'no-store' };
  if (version !== undefined) headers.ETag = `"${version}"`;
  return NextResponse.json({ data }, { status, headers });
}
export function failure(error: unknown) {
  const known = error instanceof HttpError;
  const response = NextResponse.json(
    {
      error: {
        code: known ? error.code : 'SERVICE_UNAVAILABLE',
        message: known
          ? error.message
          : 'This service is temporarily unavailable. Please try again.',
        requestId: reportFailure(
          known ? error.status : 503,
          known ? error.code : 'SERVICE_UNAVAILABLE',
        ),
      },
    },
    { status: known ? error.status : 503, headers: { 'Cache-Control': 'no-store' } },
  );
  if (known && error.status === 429) response.headers.set('Retry-After', '60');
  // Never serialize/log driver, authentication, SMTP or request bodies.
  return response;
}
export async function endpoint(action: () => Promise<Response>) {
  try {
    return await action();
  } catch (error) {
    return failure(error);
  }
}
export function sameOrigin(request: Request) {
  if (request.headers.get('origin') !== authConfig().origin)
    throw new HttpError(403, 'FORBIDDEN', 'This request could not be verified.');
}
export function revision(request: Request) {
  const header = request.headers.get('if-match');
  if (header === null)
    throw new HttpError(428, 'PRECONDITION_REQUIRED', 'Reload this record before saving.');
  const value = expectedVersion(header);
  if (value === null)
    throw new HttpError(400, 'VALIDATION_ERROR', 'If-Match must contain a quoted record version.');
  return value;
}
export async function json<T>(request: Request, schema: z.ZodType<T>, max = 32768): Promise<T> {
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json')
    throw new HttpError(415, 'VALIDATION_ERROR', 'Send JSON content.');
  const text = await boundedText(request, max);
  try {
    const result = schema.safeParse(JSON.parse(text));
    if (result.success) return result.data;
  } catch {
    /* Safe validation error below. */
  }
  throw new HttpError(400, 'VALIDATION_ERROR', 'Check the form fields and try again.');
}
export async function boundedText(request: Request, max: number) {
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'VALIDATION_ERROR', 'Request content is required.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      throw new HttpError(413, 'VALIDATION_ERROR', 'Request content is too large.');
    }
    chunks.push(value);
  }
  const buffer = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(buffer);
}
export function notFound(): never {
  throw new HttpError(404, 'NOT_FOUND', 'Record not found.');
}
export function conflict(): never {
  throw new HttpError(
    409,
    'REVISION_CONFLICT',
    'This record changed elsewhere. Your edits are still here; reload the current record before trying again.',
  );
}
