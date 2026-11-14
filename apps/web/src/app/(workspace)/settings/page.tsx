import { RecoverySettings } from '@/components/recovery-provider';
import { AccountSettings } from '@/components/account-settings';
import { requireAccount } from '@/server/page-account';
export default async function Settings() {
  const account = await requireAccount();
  return (
    <div className="stack">
      <div>
        <p className="eyebrow">Your workspace</p>
        <h1>Account & privacy.</h1>
      </div>
      <RecoverySettings />
      <AccountSettings initial={account} />
    </div>
  );
}
