import type { NextRequest } from 'next/server';
import { StoryPatch } from '@inkwell/contracts';
import { privateApi } from '@/server/private-api';
import { json, ok, revision } from '@/server/http';
import { getStory, updateStory } from '@/server/records';
type Context = { params: Promise<{ projectId: string; storyId: string }> };
export function GET(request: NextRequest, context: Context) {
  return privateApi(request, async (account) => {
    const { projectId, storyId } = await context.params;
    const row = await getStory(account, projectId, storyId);
    return ok(row, 200, row.version);
  });
}
export function PATCH(request: NextRequest, context: Context) {
  return privateApi(request, async (account) => {
    const { projectId, storyId } = await context.params;
    const row = await updateStory(
      account,
      projectId,
      storyId,
      revision(request),
      await json(request, StoryPatch),
    );
    return ok(row, 200, row.version);
  });
}
export function DELETE(request: NextRequest, context: Context) {
  return privateApi(request, async (account) => {
    const { projectId, storyId } = await context.params;
    const row = await updateStory(account, projectId, storyId, revision(request), {
      archived: true,
    });
    return ok(row, 200, row.version);
  });
}
