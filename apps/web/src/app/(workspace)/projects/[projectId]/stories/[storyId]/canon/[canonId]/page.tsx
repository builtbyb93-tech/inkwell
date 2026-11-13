import { CanonDetail } from '@/components/canon-editor';
import { requireAccount } from '@/server/page-account';
export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string; storyId: string; canonId: string }>;
}) {
  await requireAccount();
  const p = await params;
  const c = { projectId: p.projectId, storyId: p.storyId };
  return <CanonDetail key={JSON.stringify([c, p.canonId])} context={c} recordId={p.canonId} />;
}
