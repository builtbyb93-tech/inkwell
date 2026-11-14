import type { NextRequest } from 'next/server';
import { archiveMaxBytes } from '@inkwell/contracts';
import { privateApi } from '@/server/private-api';
import { boundedText, ok } from '@/server/http';
import { readArchive, importProject } from '@/server/portability';
import { limit } from '@/server/rate-limit';
export function POST(request: NextRequest) {
  return privateApi(request, async (a) => {
    await limit('project-import', a.id, 5);
    return ok(
      await importProject(a, readArchive(await boundedText(request, archiveMaxBytes))),
      201,
    );
  });
}
