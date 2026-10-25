import { useState } from 'react';
import { ArrowLeft, ArrowRight, RotateCcw, RotateCw, Trash2, Undo2 } from 'lucide-react';
import { Button, IconButton } from '../design/ui';
import { ResultCard } from '../files/ResultCard';

import type { Tool } from '../features/tools/catalog';
import type { UploadSnapshot } from '../privacy/uploadMonitor';
import { SinglePdf } from './kit/SinglePdf';
import { RunPanel } from './kit/parts';
import { outputName, pdfBlob } from './kit/output';
import { useRunner } from './kit/useRunner';
import { useThumbnails } from './kit/useThumbnails';
import type { LoadedPdf } from './kit/usePdf';
import { loadEngine } from '../pdf/lazy';

interface Slot { index: number; rotate: number; removed: boolean }

export default function Organise({ tool }: { tool: Tool }) {
  return <SinglePdf tool={tool} prompt="Choose a PDF to organise">{(pdf, since) => <Board key={pdf.file.name + pdf.file.size} pdf={pdf} since={since} tool={tool} />}</SinglePdf>;
}

const fresh = (pages: number): Slot[] => Array.from({ length: pages }, (_, index) => ({ index, rotate: 0, removed: false }));

function Board({ pdf, since, tool }: { pdf: LoadedPdf; since: UploadSnapshot; tool: Tool }) {
  const thumbs = useThumbnails(pdf.bytes, pdf.password);
  const [slots, setSlots] = useState<Slot[]>(() => fresh(pdf.pages));
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const runner = useRunner();
  const change = (fn: (list: Slot[]) => Slot[]) => { setSlots(fn); runner.clear(); };
  const move = (from: number, to: number) => change((list) => {
    if (to < 0 || to >= list.length || from === to) return list;
    const next = [...list];
    const [slot] = next.splice(from, 1);
    next.splice(to, 0, slot!);
    return next;
  });
  const update = (at: number, patch: Partial<Slot>) => change((list) => list.map((s, i) => (i === at ? { ...s, ...patch } : s)));
  const kept = slots.filter((s) => !s.removed);
  const changed = slots.some((s, i) => s.index !== i || s.rotate % 360 !== 0 || s.removed);

  return (
    <>
      <p className="options__hint">Drag pages to reorder them, or use the arrows. Rotate or remove any page.</p>
      <ol className="thumbs" aria-label="Pages">
        {slots.map((slot, at) => (
          <li
            key={slot.index}
            className={`thumb${slot.removed ? ' thumb--removed' : ''}`}
            draggable
            onDragStart={(e) => { setDragFrom(at); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(at)); }}
            onDragOver={(e) => { if (dragFrom !== null) e.preventDefault(); }}
            onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (dragFrom !== null) move(dragFrom, at); setDragFrom(null); }}
            onDragEnd={() => setDragFrom(null)}
          >
            <span className="thumb__img">
              {thumbs[slot.index]
                ? <img src={thumbs[slot.index]} alt="" style={{ transform: `rotate(${slot.rotate}deg)${slot.rotate % 180 ? ' scale(0.77)' : ''}` }} draggable={false} />
                : <span className="thumb__img thumb__img--empty" />}
            </span>
            <span className="thumb__label">Page {slot.index + 1}{slot.removed ? ' · removed' : ''}</span>
            <span className="thumb__tools thumb__tools--organise">
              <IconButton label={`Rotate page ${slot.index + 1} left`} onClick={() => update(at, { rotate: (slot.rotate + 270) % 360 })}><RotateCcw aria-hidden size={18} /></IconButton>
              <IconButton label={`Rotate page ${slot.index + 1} right`} onClick={() => update(at, { rotate: (slot.rotate + 90) % 360 })}><RotateCw aria-hidden size={18} /></IconButton>
              <IconButton label={slot.removed ? `Keep page ${slot.index + 1}` : `Remove page ${slot.index + 1}`} onClick={() => update(at, { removed: !slot.removed })}>
                {slot.removed ? <Undo2 aria-hidden size={18} /> : <Trash2 aria-hidden size={18} />}
              </IconButton>
              <IconButton label={`Move page ${slot.index + 1} earlier`} disabled={at === 0} onClick={() => move(at, at - 1)}><ArrowLeft aria-hidden size={18} /></IconButton>
              <IconButton label={`Move page ${slot.index + 1} later`} disabled={at === slots.length - 1} onClick={() => move(at, at + 1)}><ArrowRight aria-hidden size={18} /></IconButton>
            </span>
          </li>
        ))}
      </ol>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Button variant="outlined" onClick={() => change((list) => list.map((s) => ({ ...s, rotate: (s.rotate + 90) % 360 })))}>Rotate all right</Button>
        <Button variant="text" disabled={!changed} onClick={() => change(() => fresh(pdf.pages))}>Undo all changes</Button>
      </div>
      {!runner.output && (
        <RunPanel label={`Save ${kept.length} page${kept.length === 1 ? '' : 's'}`} busyLabel="Saving" busy={runner.busy} error={runner.error}
          disabled={!changed || kept.length === 0}
          onRun={() => runner.run(async () => {
            const bytes = await (await loadEngine()).rebuildPdf(pdf.bytes, kept.map((s) => ({ index: s.index, rotate: s.rotate })), pdf.password);
            const removed = slots.length - kept.length;
            return { blob: pdfBlob(bytes), name: outputName(pdf.file.name, 'organised'), summary: `${kept.length} pages${removed ? `, ${removed} removed` : ''}.` };
          })}>
          {kept.length === 0 && <p className="hp-note hp-note--warn">Keep at least one page.</p>}
          {!changed && <p className="options__hint">Make a change to save a new PDF.</p>}
        </RunPanel>
      )}
      {runner.output && <ResultCard {...runner.output} tool={tool.id} since={since} />}
    </>
  );
}
