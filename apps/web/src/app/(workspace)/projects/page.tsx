import { RecordList } from '@/components/records';
import { requireAccount } from '@/server/page-account';
export default async function Projects() {
  await requireAccount();
  return (
    <>
      <p className="eyebrow">Develop</p>
      <h1>Projects & stories.</h1>
      <p className="intro">A home for every story that belongs together.</p>
      <RecordList />
    </>
  );
}
