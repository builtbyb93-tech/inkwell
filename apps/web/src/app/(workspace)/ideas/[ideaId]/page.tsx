import { IdeaEditor } from '@/components/idea-editor';
import { requireAccount } from '@/server/page-account';
export default async function Idea({ params }: { params: Promise<{ ideaId: string }> }) {
  await requireAccount();
  const { ideaId } = await params;
  return <IdeaEditor key={ideaId} ideaId={ideaId} />;
}
