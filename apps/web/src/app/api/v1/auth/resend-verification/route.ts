import { accountAction } from '@/server/auth-actions';
export const runtime = 'nodejs';
export function POST(request: Request) {
  return accountAction(request, 'resend-verification');
}
