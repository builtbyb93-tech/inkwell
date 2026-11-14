import type { NextRequest } from 'next/server';
import { archiveMaxBytes } from '@inkwell/contracts';
import { privateApi } from '@/server/private-api';
import { boundedText, ok } from '@/server/http';
import { readArchive, archivePreview } from '@/server/portability';
import { limit } from '@/server/rate-limit';
export function POST(request: NextRequest) {
  return privateApi(request, async (a) => {
    await limit('project-import-preview', a.id, 10);
    return ok(archivePreview(readArchive(await boundedText(request, archiveMaxBytes))));
  });
}
