import type { NextRequest } from 'next/server';
import { privateApi } from '@/server/private-api';
import { ok, revision } from '@/server/http';
import { revokeShareLink } from '@/server/snapshots';
export function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; snapshotId: string; linkId: string }> },
) {
  return privateApi(request, async (a) => {
    const p = await params;
    const row = await revokeShareLink(a, p.projectId, p.snapshotId, p.linkId, revision(request));
    return ok(row, 200, row.version);
  });
}
