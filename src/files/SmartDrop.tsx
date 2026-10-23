import { useEffect, useState } from 'react';
import { FolderOpen, Sparkles } from 'lucide-react';
import { Button } from '../design/ui';
import { navigate } from '../app/router';
import { handOff } from './handoff';
import { pickFiles } from './pick';
import './smart-drop.css';

/** Hand files to the Open screen, which works out what they are and what to do with them. */
export function openFiles(files: File[]) {
  if (files.length === 0) return;
  handOff(files);
  navigate('/open');
}

/** The card on Home: tap to choose, or drop files on it. */
export function SmartDropCard() {
  const [over, setOver] = useState(false);
  return (
    <section
      className={over ? 'smart-drop smart-drop--over' : 'smart-drop'}
      aria-labelledby="smart-drop-title"
      onDragOver={(event) => { event.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => { event.preventDefault(); event.stopPropagation(); setOver(false); openFiles(Array.from(event.dataTransfer.files)); }}
    >
      <span className="smart-drop__icon"><Sparkles aria-hidden size={26} /></span>
      <div className="smart-drop__text">
        <h2 id="smart-drop-title">Smart Drop</h2>
        <p>Drop any file here, or paste it. We’ll show what you can do with it.</p>
      </div>
      <Button variant="filled" icon={<FolderOpen aria-hidden size={18} />} onClick={async () => openFiles(await pickFiles())}>
        Choose files
      </Button>
    </section>
  );
}

/**
 * Drop or paste files anywhere in the app. A tool screen that takes files
 * handles its own drops first (it calls preventDefault), so this only catches
 * drops on screens that don't.
 */
export function GlobalDrop() {
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    let depth = 0;
    const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes('Files');
    const enter = (event: DragEvent) => { if (hasFiles(event)) { depth += 1; setDragging(true); } };
    const leave = () => { depth = Math.max(0, depth - 1); if (depth === 0) setDragging(false); };
    const over = (event: DragEvent) => { if (hasFiles(event)) event.preventDefault(); };
    const drop = (event: DragEvent) => {
      depth = 0;
      setDragging(false);
      if (event.defaultPrevented || !hasFiles(event)) return;
      event.preventDefault();
      openFiles(Array.from(event.dataTransfer?.files ?? []));
    };
    const paste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, [contenteditable="true"]')) return;
      const files = Array.from(event.clipboardData?.files ?? []);
      if (files.length) { event.preventDefault(); openFiles(files); }
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    window.addEventListener('paste', paste);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
      window.removeEventListener('paste', paste);
    };
  }, []);
  if (!dragging) return null;
  return (
    <div className="global-drop" aria-hidden>
      <div className="global-drop__card"><Sparkles size={32} /><p>Drop to open in Happy PDF</p><p className="global-drop__sub">Nothing is uploaded</p></div>
    </div>
  );
}
