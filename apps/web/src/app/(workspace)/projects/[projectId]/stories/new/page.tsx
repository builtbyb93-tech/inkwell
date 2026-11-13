import { RecordEditor } from '@/components/records';
import { requireAccount } from '@/server/page-account';
export default async function NewStory({ params }: { params: Promise<{ projectId: string }> }) {
  await requireAccount();
  return <RecordEditor projectId={(await params).projectId} />;
}
