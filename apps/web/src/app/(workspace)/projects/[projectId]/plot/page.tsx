import { PlotPicker } from '@/components/plot-picker';
import { requireAccount } from '@/server/page-account';
export default async function Page({ params }: { params: Promise<{ projectId: string }> }) {
  await requireAccount();
  const p = await params;
  return <PlotPicker key={p.projectId} projectId={p.projectId} />;
}
