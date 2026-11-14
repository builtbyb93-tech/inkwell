import { SnapshotManager } from '@/components/snapshot-manager';
import { requireAccount } from '@/server/page-account';
export default async function Sharing({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ storyId?: string }>;
}) {
  await requireAccount();
  return (
    <SnapshotManager
      projectId={(await params).projectId}
      initialStoryId={(await searchParams).storyId ?? ''}
    />
  );
}
