import type { Metadata } from 'next';
import { AppFrame } from '@/components/app-frame';
import { SharedViewer } from '@/components/shared-viewer';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Shared copy · Inkwell',
  robots: { index: false, follow: false, noarchive: true },
  referrer: 'no-referrer',
};
export default function Share() {
  return (
    <AppFrame>
      <SharedViewer />
    </AppFrame>
  );
}
