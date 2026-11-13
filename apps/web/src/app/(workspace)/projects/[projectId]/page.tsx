import Link from 'next/link';
import { RecordEditor, RecordList } from '@/components/records';
import { requireAccount } from '@/server/page-account';
export default async function Project({ params }: { params: Promise<{ projectId: string }> }) {
  await requireAccount();
  const { projectId } = await params;
  return (
    <div className="stack">
      <Link className="button" href={`/projects/${projectId}/canon`}>
        Open project Story Bible
      </Link>
      <RecordEditor recordId={projectId} />
      <RecordList projectId={projectId} />
    </div>
  );
}
