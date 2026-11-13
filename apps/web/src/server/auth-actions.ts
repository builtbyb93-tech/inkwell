import 'server-only';
import { after } from 'next/server';
import { RegisterInput, EmailInput, TokenInput, ResetInput } from '@inkwell/contracts';
import { register, requestAccountToken, consumeAccountToken } from './accounts';
import { endpoint, json, ok, sameOrigin } from './http';
import { publicLimit } from './rate-limit';

const generic = {
  message:
    'If this address is eligible, an email will arrive shortly. Check your inbox and spam folder, or request a new link.',
};
export function accountAction(
  request: Request,
  action:
    'register' | 'resend-verification' | 'verify-email' | 'forgot-password' | 'reset-password',
) {
  return endpoint(async () => {
    sameOrigin(request);
    await publicLimit(request, action);
    if (action === 'register') {
      const input = await json(request, RegisterInput);
      await publicLimit(request, 'registration-address', input.email);
      await register(input);
      scheduleMail(input.email, 'VERIFY_EMAIL');
      return ok(generic, 202);
    }
    if (action === 'resend-verification' || action === 'forgot-password') {
      const { email } = await json(request, EmailInput);
      await publicLimit(request, action + '-address', email);
      scheduleMail(email, action === 'forgot-password' ? 'RESET_PASSWORD' : 'VERIFY_EMAIL');
      return ok(generic, 202);
    }
    if (action === 'verify-email') {
      const { token } = await json(request, TokenInput);
      await consumeAccountToken(token, 'VERIFY_EMAIL');
      return ok({ message: 'Email verified. You can now sign in.' });
    }
    const { token, password } = await json(request, ResetInput);
    await consumeAccountToken(token, 'RESET_PASSWORD', password);
    return ok({
      message:
        'Password changed. Sign in with your new password. All previous sessions have ended.',
    });
  });
}
function scheduleMail(email: string, purpose: 'VERIFY_EMAIL' | 'RESET_PASSWORD') {
  // Keep account-existence queries and SMTP latency out of the recovery response path.
  after(async () => {
    try {
      await requestAccountToken(email, purpose);
    } catch {
      console.warn('inkwell.auth.mail_setup_failed');
    }
  });
}
