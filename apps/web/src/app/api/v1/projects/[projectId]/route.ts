import type { NextRequest } from 'next/server';
import { ProjectPatch } from '@inkwell/contracts';
import { privateApi } from '@/server/private-api';
import { json, ok, revision } from '@/server/http';
import { getProject, updateProject } from '@/server/records';
type Context = { params: Promise<{ projectId: string }> };
export function GET(request: NextRequest, context: Context) {
  return privateApi(request, async (account) => {
    const { projectId } = await context.params;
    const row = await getProject(account, projectId);
    return ok(row, 200, row.version);
  });
}
export function PATCH(request: NextRequest, context: Context) {
  return privateApi(request, async (account) => {
    const { projectId } = await context.params;
    const version = revision(request);
    const row = await updateProject(account, projectId, version, await json(request, ProjectPatch));
    return ok(row, 200, row.version);
  });
}
export function DELETE(request: NextRequest, context: Context) {
  return privateApi(request, async (account) => {
    const { projectId } = await context.params;
    const row = await updateProject(account, projectId, revision(request), { archived: true });
    return ok(row, 200, row.version);
  });
}
