import { RecordEditor } from '@/components/records';
import { requireAccount } from '@/server/page-account';
export default async function NewProject() {
  await requireAccount();
  return <RecordEditor />;
}
