import { RecordEditor } from '@/components/records';
import { requireAccount } from '@/server/page-account';
export default async function Story({
  params,
}: {
  params: Promise<{ projectId: string; storyId: string }>;
}) {
  await requireAccount();
  const { projectId, storyId } = await params;
  return <RecordEditor projectId={projectId} recordId={storyId} />;
}
