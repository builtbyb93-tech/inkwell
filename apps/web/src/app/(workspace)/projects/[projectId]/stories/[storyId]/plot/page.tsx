import { PlotBoard } from '@/components/plot-board';
import { requireAccount } from '@/server/page-account';
export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string; storyId: string }>;
}) {
  await requireAccount();
  const p = await params,
    c = { projectId: p.projectId, storyId: p.storyId };
  return <PlotBoard key={JSON.stringify([c, 'new'])} context={c} />;
}
