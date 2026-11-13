import { PlotGroupEditor } from '@/components/plot-groups';
import { requireAccount } from '@/server/page-account';
export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string; storyId: string; groupId: string }>;
}) {
  await requireAccount();
  const p = await params,
    c = { projectId: p.projectId, storyId: p.storyId };
  return <PlotGroupEditor key={JSON.stringify([c, p.groupId])} context={c} groupId={p.groupId} />;
}
