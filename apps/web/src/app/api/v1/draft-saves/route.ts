import type { NextRequest } from 'next/server';
import { DraftSaveInput } from '@inkwell/contracts';
import { privateApi } from '@/server/private-api';
import { json, ok } from '@/server/http';
import { saveDraft } from '@/server/draft-saves';
export function POST(request: NextRequest) {
  return privateApi(request, async (a) => {
    const result = await saveDraft(a, await json(request, DraftSaveInput));
    return ok(result, 200, result.version);
  });
}
