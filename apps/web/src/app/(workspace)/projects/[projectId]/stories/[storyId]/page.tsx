import { SourceIdeas } from '@/components/idea-target-view';
import { RecordEditor } from '@/components/records';
import { requireAccount } from '@/server/page-account';
export default async function Story({
  params,
}: {
  params: Promise<{ projectId: string; storyId: string }>;
}) {
  await requireAccount();
  const { projectId, storyId } = await params;
  return (
    <div className="stack">
      <RecordEditor key={storyId} projectId={projectId} recordId={storyId} />
      <SourceIdeas storyId={storyId} />
    </div>
  );
}
