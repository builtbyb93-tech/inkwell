import { PlotPicker } from '@/components/plot-picker';
import { requireAccount } from '@/server/page-account';
export default async function Page() {
  await requireAccount();
  return <PlotPicker />;
}
