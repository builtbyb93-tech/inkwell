import 'server-only';

export function authConfig() {
  const secret = process.env.NEXTAUTH_SECRET;
  const url = new URL(process.env.NEXTAUTH_URL ?? 'http://127.0.0.1:3000/api/v1/auth');
  if (!secret || secret.length < 32) throw new Error('Authentication configuration unavailable.');
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/api/v1/auth' ||
    url.search ||
    url.hash ||
    (!isLoopback(url.hostname) && url.protocol !== 'https:')
  )
    throw new Error('Invalid authentication origin.');
  return { secret, origin: url.origin, secure: url.protocol === 'https:' };
}

export function isLoopback(host: string) {
  return ['127.0.0.1', 'localhost', '[::1]'].includes(host);
}
export function sessionCookie() {
  return authConfig().secure ? '__Secure-inkwell.session-token' : 'inkwell.session-token';
}
