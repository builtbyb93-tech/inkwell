import type { NextRequest } from 'next/server';
import { privateApi } from '@/server/private-api';
import { json, ok } from '@/server/http';
import { canonApiContext } from '@/server/canon-api';
import { RelationshipInput } from '@inkwell/contracts';
import { createRelationship, listRelationships } from '@/server/canon-relationships';
type Context = { params: Promise<{ projectId: string; canonId: string }> };
export function GET(request: NextRequest, context: Context) {
  return privateApi(request, async (a) => {
    const p = await context.params;
    return ok(
      await listRelationships(
        a,
        canonApiContext(request, p.projectId, true),
        p.canonId,
        request.nextUrl.searchParams,
      ),
    );
  });
}
export function POST(request: NextRequest, context: Context) {
  return privateApi(request, async (a) => {
    const p = await context.params;
    const row = await createRelationship(
      a,
      canonApiContext(request, p.projectId),
      p.canonId,
      await json(request, RelationshipInput),
    );
    return ok(row, 201, row.version);
  });
}
