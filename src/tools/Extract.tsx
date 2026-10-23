import { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '../design/ui';
import { ResultCard } from '../files/ResultCard';

import { parsePageList } from '../pdf/ranges';
import { PdfError } from '../pdf/errors';
import type { Tool } from '../features/tools/catalog';
import type { UploadSnapshot } from '../privacy/uploadMonitor';
import { SinglePdf } from './kit/SinglePdf';
import { RunPanel } from './kit/parts';
import { outputName, pdfBlob } from './kit/output';
import { useRunner } from './kit/useRunner';
import { useThumbnails } from './kit/useThumbnails';
import type { LoadedPdf } from './kit/usePdf';
import { loadEngine } from '../pdf/lazy';

export default function Extract({ tool }: { tool: Tool }) {
  return <SinglePdf tool={tool} prompt="Choose a PDF to take pages from">{(pdf, since) => <Picker key={pdf.file.name + pdf.file.size} pdf={pdf} since={since} tool={tool} />}</SinglePdf>;
}

/** "0,1,2,4" -> "1-3, 5" */
export function describePages(indices: number[]): string {
  const sorted = [...indices].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[i]!;
    let end = start;
    while (sorted[i + 1] === end + 1) end = sorted[++i]!;
    parts.push(start === end ? `${start + 1}` : `${start + 1}-${end + 1}`);
  }
  return parts.join(', ');
}

function Picker({ pdf, since, tool }: { pdf: LoadedPdf; since: UploadSnapshot; tool: Tool }) {
  const thumbs = useThumbnails(pdf.bytes, pdf.password);
  const [picked, setPicked] = useState<number[]>([]);
  const [text, setText] = useState('');
  const runner = useRunner();
  const typedError = useMemo(() => {
    if (!text.trim()) return undefined;
    try { parsePageList(text, pdf.pages); return undefined; } catch (e) { return e instanceof PdfError ? e.message : 'Check the pages you typed.'; }
  }, [text, pdf.pages]);

  const setFromTaps = (next: number[]) => { setPicked(next); setText(describePages(next)); runner.clear(); };
  const toggle = (i: number) => setFromTaps(picked.includes(i) ? picked.filter((p) => p !== i) : [...picked, i].sort((a, b) => a - b));
  const onType = (value: string) => {
    setText(value);
    runner.clear();
    try { setPicked(value.trim() ? parsePageList(value, pdf.pages) : []); } catch { /* shown as typedError */ }
  };

  return (
    <>
      <div className="hp-card options">
        <div className="hp-field">
          <label htmlFor="extract-pages">Pages to keep</label>
          <input id="extract-pages" className="hp-input" placeholder="For example 1-3, 5" value={text} onChange={(e) => onType(e.target.value)} />
          <p className="options__hint">Type pages, or tap them below.</p>
        </div>
        {typedError && <p className="hp-note hp-note--danger">{typedError}</p>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Button variant="outlined" onClick={() => setFromTaps(Array.from({ length: pdf.pages }, (_, i) => i))}>Select all</Button>
          <Button variant="text" disabled={picked.length === 0} onClick={() => setFromTaps([])}>Clear</Button>
        </div>
      </div>
      <ul className="thumbs" aria-label="Pages">
        {Array.from({ length: pdf.pages }, (_, i) => {
          const on = picked.includes(i);
          return (
            <li key={i} className={`thumb${on ? ' thumb--selected' : ''}`}>
              <button type="button" className="thumb__button" aria-pressed={on} aria-label={`Page ${i + 1}`} onClick={() => toggle(i)}>
                <span className="thumb__img">{thumbs[i] ? <img src={thumbs[i]} alt="" /> : <span className="thumb__img thumb__img--empty" />}</span>
                <span className="thumb__label">Page {i + 1}</span>
              </button>
              {on && <span className="thumb__check" aria-hidden><Check size={16} strokeWidth={3} /></span>}
            </li>
          );
        })}
      </ul>
      {!runner.output && (
        <RunPanel label={picked.length ? `Extract ${picked.length} page${picked.length === 1 ? '' : 's'}` : 'Extract pages'} busyLabel="Extracting" busy={runner.busy} error={runner.error}
          disabled={picked.length === 0 || Boolean(typedError)}
          onRun={() => runner.run(async () => {
            const bytes = await (await loadEngine()).rebuildPdf(pdf.bytes, picked.map((index) => ({ index })), pdf.password);
            return { blob: pdfBlob(bytes), name: outputName(pdf.file.name, `pages-${describePages(picked).replace(/,\s*/g, '_')}`), summary: `Pages ${describePages(picked)}.` };
          })} />
      )}
      {runner.output && <ResultCard {...runner.output} tool={tool.id} since={since} />}
    </>
  );
}
