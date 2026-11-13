import { IdeaEditor } from '@/components/idea-editor';
import { requireAccount } from '@/server/page-account';
export default async function NewIdea() {
  await requireAccount();
  return <IdeaEditor />;
}
