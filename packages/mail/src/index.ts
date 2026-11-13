import 'server-only';
import nodemailer from 'nodemailer';

// Only SMTP text messages are exposed. No raw messages, attachments, file or URL sources.
export async function deliverMail(
  config: {
    host: string;
    port: number;
    secure: boolean;
    requireTLS: boolean;
    connectionTimeout: number;
    greetingTimeout: number;
    socketTimeout: number;
    auth?: { user: string; pass: string };
  },
  message: { from: string; to: string; subject: string; text: string },
) {
  const transport = nodemailer.createTransport({
    ...config,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  try {
    await transport.sendMail(message);
  } finally {
    transport.close();
  }
}
