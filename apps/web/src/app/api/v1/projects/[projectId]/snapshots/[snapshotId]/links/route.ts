import type { NextRequest } from 'next/server';
import { ShareLinkInput } from '@inkwell/contracts';
import { privateApi } from '@/server/private-api';
import { json, ok } from '@/server/http';
import { listShareLinks, issueShareLink } from '@/server/snapshots';
import { limit } from '@/server/rate-limit';
type Context = { params: Promise<{ projectId: string; snapshotId: string }> };
export function GET(request: NextRequest, { params }: Context) {
  return privateApi(request, async (a) => {
    const p = await params;
    return ok(await listShareLinks(a, p.projectId, p.snapshotId, request.nextUrl.searchParams));
  });
}
export function POST(request: NextRequest, { params }: Context) {
  return privateApi(request, async (a) => {
    await limit('issue-share-link', a.id, 10);
    const p = await params;
    return ok(
      await issueShareLink(a, p.projectId, p.snapshotId, await json(request, ShareLinkInput)),
      201,
    );
  });
}
