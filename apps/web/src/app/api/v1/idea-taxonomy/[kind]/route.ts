import type { NextRequest } from 'next/server';
import { TaxonomyInput } from '@inkwell/contracts';
import { privateApi } from '@/server/private-api';
import { json, ok, notFound } from '@/server/http';
import { createTaxonomy, listTaxonomy, type TaxonomyKind } from '@/server/ideas';
type Context = { params: Promise<{ kind: string }> };
async function kind(context: Context): Promise<TaxonomyKind> {
  const { kind } = await context.params;
  if (kind !== 'categories' && kind !== 'tags') notFound();
  return kind;
}
export function GET(request: NextRequest, context: Context) {
  return privateApi(request, async (account) =>
    ok(await listTaxonomy(account, await kind(context), request.nextUrl.searchParams)),
  );
}
export function POST(request: NextRequest, context: Context) {
  return privateApi(request, async (account) =>
    ok(
      await createTaxonomy(account, await kind(context), (await json(request, TaxonomyInput)).name),
      201,
    ),
  );
}
