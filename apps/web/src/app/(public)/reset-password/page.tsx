import { AuthForm } from '@/components/auth-form';
import { AppFrame } from '@/components/app-frame';
export default function Page() {
  return (
    <AppFrame>
      <AuthForm mode="reset-password" />
    </AppFrame>
  );
}
