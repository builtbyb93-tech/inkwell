import type { NextRequest } from 'next/server';
import { CanonContextQuery } from '@inkwell/contracts';
import { HttpError } from './http';
export function canonApiContext(request: NextRequest, projectId: string, list = false) {
  const raw = list
    ? {
        ...(request.nextUrl.searchParams.has('storyId')
          ? { storyId: request.nextUrl.searchParams.get('storyId') }
          : {}),
      }
    : Object.fromEntries(request.nextUrl.searchParams);
  const result = CanonContextQuery.safeParse(raw);
  if (!result.success) throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid canon context.');
  return { projectId, ...(result.data.storyId ? { storyId: result.data.storyId } : {}) };
}
