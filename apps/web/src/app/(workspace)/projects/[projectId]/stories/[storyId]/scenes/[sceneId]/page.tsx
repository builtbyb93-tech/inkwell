import { IdeaTargetView } from '@/components/idea-target-view';
import { requireAccount } from '@/server/page-account';
export default async function Scene({
  params,
}: {
  params: Promise<{ projectId: string; storyId: string; sceneId: string }>;
}) {
  await requireAccount();
  const { projectId, storyId, sceneId } = await params;
  return <IdeaTargetView projectId={projectId} storyId={storyId} targetId={sceneId} kind="SCENE" />;
}
