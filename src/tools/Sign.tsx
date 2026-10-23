import { useEffect, useRef, useState } from 'react';
import { ImageUp } from 'lucide-react';
import { Button, Chip, Note } from '../design/ui';
import { ResultCard } from '../files/ResultCard';
import { pickFiles } from '../files/pick';


import type { Tool } from '../features/tools/catalog';
import type { UploadSnapshot } from '../privacy/uploadMonitor';
import { SinglePdf } from './kit/SinglePdf';
import { RangeField, RunPanel } from './kit/parts';
import { outputName, pdfBlob } from './kit/output';
import { useRunner } from './kit/useRunner';
import type { LoadedPdf } from './kit/usePdf';
import { DrawPad, typedSignature, type Signature } from './SignaturePad';
import './sign.css';
import { loadEngine, loadRender } from '../pdf/lazy';

type Mode = 'draw' | 'type' | 'upload';

export default function Sign({ tool }: { tool: Tool }) {
  return <SinglePdf tool={tool} prompt="Choose a PDF to sign">{(pdf, since) => <Signer key={pdf.file.name + pdf.file.size} pdf={pdf} since={since} tool={tool} />}</SinglePdf>;
}

function Signer({ pdf, since, tool }: { pdf: LoadedPdf; since: UploadSnapshot; tool: Tool }) {
  const [mode, setMode] = useState<Mode>('draw');
  const [sig, setSig] = useState<Signature | null>(null);
  const [name, setName] = useState('');
  const [page, setPage] = useState(pdf.pages - 1);
  const [everyPage, setEveryPage] = useState(false);
  // Centre of the signature, as fractions of the page as seen; width as a fraction of page width.
  const [spot, setSpot] = useState({ x: 0.72, y: 0.86 });
  const [width, setWidth] = useState(0.3);
  const [preview, setPreview] = useState<{ url: string; ratio: number } | null>(null);
  const box = useRef<HTMLButtonElement>(null);
  const runner = useRunner();

  useEffect(() => {
    let url = '';
    let alive = true;
    void (async () => {
      const doc = await (await loadRender()).openForView(pdf.bytes, pdf.password);
      const p = await doc.getPage(page + 1);
      const canvas = await (await loadRender()).renderPage(p, 1.5);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
      await doc.loadingTask.destroy();
      if (!blob || !alive) return;
      url = URL.createObjectURL(blob);
      setPreview({ url, ratio: canvas.width / canvas.height });
    })().catch(() => setPreview(null));
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [pdf, page]);

  useEffect(() => {
    if (mode !== 'type') return;
    let alive = true;
    void typedSignature(name).then((s) => { if (alive) setSig(s); });
    return () => { alive = false; };
  }, [mode, name]);

  const height = sig && preview ? (width / sig.ratio) * preview.ratio : 0;
  const placeAt = (clientX: number, clientY: number) => {
    const r = box.current!.getBoundingClientRect();
    setSpot({ x: Math.min(1, Math.max(0, (clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (clientY - r.top) / r.height)) });
    runner.clear();
  };
  const nudge = (dx: number, dy: number) => { setSpot((s) => ({ x: Math.min(1, Math.max(0, s.x + dx)), y: Math.min(1, Math.max(0, s.y + dy)) })); runner.clear(); };

  return (
    <>
      <div className="hp-card options">
        <div>
          <span className="options__label" id="sig-mode">Your signature</span>
          <div className="options__chips" role="group" aria-labelledby="sig-mode">
            <Chip selected={mode === 'draw'} onClick={() => { setMode('draw'); setSig(null); }}>Draw</Chip>
            <Chip selected={mode === 'type'} onClick={() => { setMode('type'); setSig(null); }}>Type</Chip>
            <Chip selected={mode === 'upload'} onClick={() => { setMode('upload'); setSig(null); }}>Upload image</Chip>
          </div>
        </div>
        {mode === 'draw' && <DrawPad onChange={(s) => { setSig(s); runner.clear(); }} />}
        {mode === 'type' && (
          <div className="hp-field">
            <label htmlFor="sig-name">Your name</label>
            <input id="sig-name" className="hp-input" value={name} onChange={(e) => { setName(e.target.value); runner.clear(); }} autoComplete="name" />
            {sig && <img className="sign-typed" src={sig.url} alt={`Signature preview: ${name}`} />}
          </div>
        )}
        {mode === 'upload' && (
          <>
            <Button variant="tonal" icon={<ImageUp aria-hidden size={18} />} onClick={async () => {
              const [file] = await pickFiles({ accept: 'image/png,image/jpeg', multiple: false });
              if (!file) return;
              const png = new Uint8Array(await file.arrayBuffer());
              const img = new Image();
              const url = URL.createObjectURL(file);
              img.onload = () => { setSig({ png, ratio: img.naturalWidth / img.naturalHeight, url }); runner.clear(); };
              img.src = url;
            }}>Choose signature image</Button>
            <p className="options__hint">A PNG with a clear background looks best.</p>
          </>
        )}
      </div>

      {sig && (
        <div className="hp-card options">
          <div className="options__row">
            <div className="hp-field">
              <label htmlFor="sig-page">Page</label>
              <select id="sig-page" className="hp-input" value={page} onChange={(e) => { setPage(Number(e.target.value)); runner.clear(); }} disabled={everyPage}>
                {Array.from({ length: pdf.pages }, (_, i) => <option key={i} value={i}>Page {i + 1}{i === pdf.pages - 1 ? ' (last)' : ''}</option>)}
              </select>
            </div>
            <div>
              <span className="options__label" id="sig-where">Sign on</span>
              <div className="options__chips" role="group" aria-labelledby="sig-where">
                <Chip selected={!everyPage} onClick={() => { setEveryPage(false); runner.clear(); }}>This page</Chip>
                <Chip selected={everyPage} onClick={() => { setEveryPage(true); runner.clear(); }}>Every page</Chip>
              </div>
            </div>
          </div>
          <RangeField id="sig-size" label="Size" min={10} max={60} step={2} value={Math.round(width * 100)} onChange={(v) => { setWidth(v / 100); runner.clear(); }} format={(v) => `${v}% of page width`} />
          <p className="options__hint">Tap the page where the signature should go. Arrow keys move it once the page is focused.</p>
          {preview ? (
            <button
              ref={box}
              type="button"
              className="sign-page"
              style={{ aspectRatio: `${preview.ratio}` }}
              aria-label={`Page ${page + 1}. Signature at ${Math.round(spot.x * 100)}% across, ${Math.round(spot.y * 100)}% down.`}
              onClick={(e) => placeAt(e.clientX, e.clientY)}
              onKeyDown={(e) => {
                const step = e.shiftKey ? 0.05 : 0.01;
                const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
                const m = moves[e.key];
                if (m) { e.preventDefault(); nudge(m[0], m[1]); }
              }}
            >
              <img src={preview.url} alt="" draggable={false} />
              <img className="sign-page__sig" src={sig.url} alt="" draggable={false}
                style={{ left: `${(spot.x - width / 2) * 100}%`, top: `${(spot.y - height / 2) * 100}%`, width: `${width * 100}%` }} />
            </button>
          ) : <Note>Preparing a preview of the page…</Note>}
        </div>
      )}

      {!runner.output && (
        <RunPanel label="Sign PDF" busyLabel="Signing" busy={runner.busy} error={runner.error} disabled={!sig || !preview}
          onRun={() => runner.run(async () => {
            const boxFor = { x: Math.max(0, spot.x - width / 2), y: Math.max(0, spot.y - height / 2), width, height };
            const pages = everyPage ? Array.from({ length: pdf.pages }, (_, i) => i) : [page];
            const bytes = await (await loadEngine()).placeImages(pdf.bytes, pages.map((p) => ({ page: p, image: sig!.png, box: boxFor })), pdf.password);
            return { blob: pdfBlob(bytes), name: outputName(pdf.file.name, 'signed'), summary: everyPage ? `Signed on all ${pdf.pages} pages.` : `Signed on page ${page + 1}.` };
          })}>
          <Note>This adds a picture of your signature. It is not a certified digital signature.</Note>
        </RunPanel>
      )}
      {runner.output && <ResultCard {...runner.output} tool={tool.id} since={since} />}
    </>
  );
}
