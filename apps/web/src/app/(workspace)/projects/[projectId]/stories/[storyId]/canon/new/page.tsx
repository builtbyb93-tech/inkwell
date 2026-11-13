import { CanonEditor } from '@/components/canon-editor';
import { requireAccount } from '@/server/page-account';
export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string; storyId: string }>;
}) {
  await requireAccount();
  const p = await params;
  const c = { projectId: p.projectId, storyId: p.storyId };
  return <CanonEditor key={JSON.stringify(c)} context={c} />;
}
