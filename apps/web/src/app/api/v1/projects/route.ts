import type { NextRequest } from 'next/server';
import { ProjectInput } from '@inkwell/contracts';
import { privateApi } from '@/server/private-api';
import { json, ok } from '@/server/http';
import { createProject, listProjects } from '@/server/records';
export function GET(request: NextRequest) {
  return privateApi(request, async (account) =>
    ok(await listProjects(account, request.nextUrl.searchParams)),
  );
}
export function POST(request: NextRequest) {
  return privateApi(request, async (account) => {
    const row = await createProject(account, await json(request, ProjectInput));
    return ok(row, 201, row.version);
  });
}
