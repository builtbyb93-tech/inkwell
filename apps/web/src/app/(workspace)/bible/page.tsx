import { BibleProjects } from '@/components/canon-list';
import { requireAccount } from '@/server/page-account';
export default async function Bible() {
  await requireAccount();
  return <BibleProjects />;
}
