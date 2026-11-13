import 'server-only';
import { deliverMail } from '@inkwell/mail';
import { authConfig, isLoopback } from './config';

export async function sendAccountMail(
  email: string,
  token: string,
  purpose: 'VERIFY_EMAIL' | 'RESET_PASSWORD',
) {
  const host = process.env.SMTP_HOST;
  const from = process.env.SMTP_FROM;
  if (!host || !from || /[\r\n]/.test(from)) throw new Error('Email configuration unavailable.');
  const port = Number(process.env.SMTP_PORT ?? '587');
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('Email configuration unavailable.');
  const secure = process.env.SMTP_SECURE === 'true';
  const transportOptions = {
    host,
    port,
    secure,
    requireTLS: !isLoopback(host),
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 10000,
    ...(process.env.SMTP_USER && process.env.SMTP_PASSWORD
      ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } }
      : {}),
  };
  const verify = purpose === 'VERIFY_EMAIL';
  const url = `${authConfig().origin}/${verify ? 'verify-email' : 'reset-password'}#token=${token}`;
  await deliverMail(transportOptions, {
    from,
    to: email,
    subject: verify ? 'Verify your Inkwell email' : 'Reset your Inkwell password',
    text: `${verify ? 'Confirm your email address to start using Inkwell.' : 'You requested a password reset for Inkwell.'}\n\n${url}\n\nThis link expires in ${verify ? '24 hours' : '30 minutes'} and can be used once. If you did not request it, ignore this email.`,
  });
}
