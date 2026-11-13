import type { NextRequest } from 'next/server';
import { privateApi } from '@/server/private-api';
import { json, ok, revision } from '@/server/http';
import { canonApiContext } from '@/server/canon-api';
import { RelationshipPatch } from '@inkwell/contracts';
import { updateRelationship } from '@/server/canon-relationships';
type Context = { params: Promise<{ projectId: string; canonId: string; relationshipId: string }> };
export function PATCH(request: NextRequest, context: Context) {
  return privateApi(request, async (a) => {
    const p = await context.params;
    const row = await updateRelationship(
      a,
      canonApiContext(request, p.projectId),
      p.canonId,
      p.relationshipId,
      revision(request),
      await json(request, RelationshipPatch),
    );
    return ok(row, 200, row.version);
  });
}
