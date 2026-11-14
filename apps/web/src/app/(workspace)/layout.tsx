import { RecoveryProvider } from '@/components/recovery-provider';
import { AppFrame } from '@/components/app-frame';
import { requireAccountContext } from '@/server/page-account';
export const dynamic = 'force-dynamic';
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { account, recovery } = await requireAccountContext();
  return (
    <RecoveryProvider identity={recovery}>
      <AppFrame name={account.displayName}>{children}</AppFrame>
    </RecoveryProvider>
  );
}
