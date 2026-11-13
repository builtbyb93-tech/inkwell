import { IdeaTargetView } from '@/components/idea-target-view';
import { requireAccount } from '@/server/page-account';
export default async function Character({
  params,
}: {
  params: Promise<{ projectId: string; characterId: string }>;
}) {
  await requireAccount();
  const { projectId, characterId } = await params;
  return <IdeaTargetView projectId={projectId} targetId={characterId} kind="CHARACTER" />;
}
