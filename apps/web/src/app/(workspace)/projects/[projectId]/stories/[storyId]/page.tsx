import Link from 'next/link';
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
      <Link className="button" href={`/projects/${projectId}/stories/${storyId}/canon`}>
        Open story Story Bible
      </Link>
      <RecordEditor key={storyId} projectId={projectId} recordId={storyId} />
      <SourceIdeas storyId={storyId} />
    </div>
  );
}
