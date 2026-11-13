import { CanonDetail } from '@/components/canon-editor';
import { requireAccount } from '@/server/page-account';
export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string; canonId: string }>;
}) {
  await requireAccount();
  const p = await params;
  const c = { projectId: p.projectId };
  return <CanonDetail key={JSON.stringify([c, p.canonId])} context={c} recordId={p.canonId} />;
}
