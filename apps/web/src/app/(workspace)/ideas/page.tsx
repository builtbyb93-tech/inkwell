import { IdeaVault } from '@/components/idea-vault';
import { requireAccount } from '@/server/page-account';
export default async function Ideas({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAccount();
  const params = await searchParams;
  return (
    <IdeaVault
      key={JSON.stringify([params.storyId ?? '', params.sceneId ?? '', params.archived === 'true'])}
      storyId={typeof params.storyId === 'string' ? params.storyId : ''}
      sceneId={typeof params.sceneId === 'string' ? params.sceneId : ''}
      initialArchived={params.archived === 'true'}
    />
  );
}
