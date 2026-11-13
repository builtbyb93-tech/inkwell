export async function accountLink(email: string, path: 'verify-email' | 'reset-password') {
  const base = process.env.MAILPIT_URL ?? 'http://127.0.0.1:18025';
  if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname))
    throw new Error('Tests use local mail only.');
  for (let attempt = 0; attempt < 40; attempt++) {
    const result = (await fetch(
      `${base}/api/v1/search?query=${encodeURIComponent('to:' + email)}`,
    ).then((r) => r.json())) as { messages?: { ID: string }[] };
    for (const item of result.messages ?? []) {
      const mail = (await fetch(`${base}/api/v1/message/${item.ID}`).then((r) => r.json())) as {
        Text?: string;
      };
      const link = mail.Text?.match(
        new RegExp(`http://127\\.0\\.0\\.1:[0-9]+/${path}#token=[A-Za-z0-9_-]{43}`),
      )?.[0];
      if (link) return link;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Expected local test email did not arrive.');
}
