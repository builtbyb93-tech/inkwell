import type { NextRequest } from 'next/server';
import { StoryInput } from '@inkwell/contracts';
import { privateApi } from '@/server/private-api';
import { json, ok } from '@/server/http';
import { createStory, listStories } from '@/server/records';
type Context = { params: Promise<{ projectId: string }> };
export function GET(request: NextRequest, context: Context) {
  return privateApi(request, async (account) =>
    ok(await listStories(account, (await context.params).projectId, request.nextUrl.searchParams)),
  );
}
export function POST(request: NextRequest, context: Context) {
  return privateApi(request, async (account) => {
    const row = await createStory(
      account,
      (await context.params).projectId,
      await json(request, StoryInput),
    );
    return ok(row, 201, row.version);
  });
}
