import { CanonEditor } from '@/components/canon-editor';
import { requireAccount } from '@/server/page-account';
export default async function Page({ params }: { params: Promise<{ projectId: string }> }) {
  await requireAccount();
  const p = await params;
  const c = { projectId: p.projectId };
  return <CanonEditor key={JSON.stringify(c)} context={c} />;
}
