import { SceneEditor } from '@/components/scene-editor';
import { requireAccount } from '@/server/page-account';
export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string; storyId: string; sceneId: string }>;
}) {
  await requireAccount();
  const p = await params,
    c = { projectId: p.projectId, storyId: p.storyId };
  return <SceneEditor key={JSON.stringify([c, p.sceneId])} context={c} sceneId={p.sceneId} />;
}
