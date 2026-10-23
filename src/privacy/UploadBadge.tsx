import { ShieldCheck, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatBytes } from '../lib/format';
import { uploadedSince, type UploadSnapshot } from './uploadMonitor';

/** Live measurement since `since`: what this page has sent anywhere. Normally "0 bytes uploaded". */
export function UploadBadge({ since }: { since: UploadSnapshot }) {
  const [sent, setSent] = useState(() => uploadedSince(since));
  useEffect(() => {
    const timer = window.setInterval(() => setSent(uploadedSince(since)), 1000);
    return () => window.clearInterval(timer);
  }, [since]);
  const clean = sent.bytes === 0;
  return (
    <span
      className={clean ? 'hp-badge hp-badge--privacy' : 'hp-badge hp-badge--alert'}
      title="Measured on this page: bytes sent to any server since you opened these files"
    >
      {clean ? <ShieldCheck aria-hidden size={14} /> : <ShieldAlert aria-hidden size={14} />}
      {clean ? '0 bytes uploaded' : `${formatBytes(sent.bytes)} sent`}
    </span>
  );
}
