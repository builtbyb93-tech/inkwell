import { RecordEditor, RecordList } from '@/components/records';
import { requireAccount } from '@/server/page-account';
export default async function Project({ params }: { params: Promise<{ projectId: string }> }) {
  await requireAccount();
  const { projectId } = await params;
  return (
    <div className="stack">
      <RecordEditor recordId={projectId} />
      <RecordList projectId={projectId} />
    </div>
  );
}
