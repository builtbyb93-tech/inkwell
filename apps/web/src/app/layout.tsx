import type { Metadata, Viewport } from 'next';
import './globals.css';
import { PwaRegistration } from '@/components/pwa-registration';
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Inkwell — Every great story starts somewhere.',
  description: 'A calm home for your ideas, worlds, and stories.',
  applicationName: 'Inkwell',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f6f2' },
    { media: '(prefers-color-scheme: dark)', color: '#191c1b' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PwaRegistration />
        {children}
      </body>
    </html>
  );
}
