import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Download, Share2 } from 'lucide-react';
import { Button } from '../design/ui';
import { useToast } from '../design/toast';
import { formatBytes } from '../lib/format';
import { baseName, canShare, safeFileName, saveFile, shareFile } from '../platform/save';
import { UploadBadge } from '../privacy/UploadBadge';
import type { UploadSnapshot } from '../privacy/uploadMonitor';
import { addRecent } from './recent';
import { AdSlot } from '../ads/AdSlot';
import './result.css';

export interface ResultCardProps {
  blob: Blob;
  /** Suggested name, extension included. */
  name: string;
  /** Tool that made the file (for Recent). Leave out to keep it out of Recent. */
  tool?: string;
  since: UploadSnapshot;
  /** One line about the outcome, e.g. "3 files merged into 12 pages". */
  summary?: string;
}

/** The finished file: rename it, then save or share it. Added to Recent once. */
export function ResultCard({ blob, name, tool, since, summary }: ResultCardProps) {
  const toast = useToast();
  const extension = /\.[^.]+$/.exec(name)?.[0] ?? '';
  const [stem, setStem] = useState(baseName(name));
  const finalName = safeFileName(stem, extension || '.bin');
  const recorded = useRef(false);

  useEffect(() => {
    if (!tool || recorded.current) return;
    recorded.current = true;
    void addRecent({ name: finalName, type: blob.type, size: blob.size, tool, blob }).catch(() => {});
    // Recorded once, under the name it had when it was made.
  }, [blob, tool]);

  const save = async () => {
    await saveFile(blob, finalName);
    toast(`Saved ${finalName}`);
  };
  const share = async () => {
    try {
      if ((await shareFile(blob, finalName)) === 'shared') toast('Shared');
    } catch {
      toast('Sharing didn’t work here. Use Save instead.');
    }
  };

  return (
    <>
    <section className="hp-card result" aria-labelledby="result-title" aria-live="polite">
      <div className="result__head">
        <CheckCircle2 aria-hidden size={28} className="result__ok" />
        <div>
          <h2 id="result-title">Your file is ready</h2>
          {summary && <p className="result__summary">{summary}</p>}
        </div>
      </div>
      <div className="hp-field">
        <label htmlFor="result-name">File name</label>
        <div className="result__name">
          <input id="result-name" className="hp-input" value={stem} onChange={(e) => setStem(e.target.value)} spellCheck={false} />
          <span className="result__ext">{extension}</span>
        </div>
      </div>
      <div className="result__meta">
        <span>{formatBytes(blob.size)}</span>
        <UploadBadge since={since} />
      </div>
      <div className="result__actions">
        <Button size="lg" icon={<Download aria-hidden size={20} />} onClick={save}>Save</Button>
        {canShare(blob, finalName) && <Button size="lg" variant="outlined" icon={<Share2 aria-hidden size={20} />} onClick={share}>Share</Button>}
      </div>
    </section>
    {tool && <AdSlot placement="result" />}
    </>
  );
}
