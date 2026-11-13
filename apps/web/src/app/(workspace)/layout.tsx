import { AppFrame } from '@/components/app-frame';
import { requireAccount } from '@/server/page-account';
export const dynamic = 'force-dynamic';
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const account = await requireAccount();
  return <AppFrame name={account.displayName}>{children}</AppFrame>;
}
