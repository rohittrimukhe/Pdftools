import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { ArrowLeft, ArrowRight, Camera, Crop, ImagePlus, RotateCw, ScanSearch, Trash2, Maximize } from 'lucide-react';
import { Button, Chip, IconButton, Note, Switch } from '../design/ui';
import { ResultCard } from '../files/ResultCard';
import { pickFiles } from '../files/pick';
import { peekHandOff, takeHandOff } from '../files/handoff';
import { uploadSnapshot } from '../privacy/uploadMonitor';
import type { Tool } from '../features/tools/catalog';
import { IMAGE_ACCEPT } from '../images/codec';
import { ENHANCE_LABEL, type Enhance } from '../scan/filters';
import { insetQuad, type Point, type Quad } from '../scan/geometry';
import type { ScanPage } from '../scan/process';
import { LANGUAGES, type OcrLanguage } from '../ocr/engine';
import { ToolLayout } from './kit/ToolLayout';
import { RunPanel } from './kit/parts';
import { pdfBlob } from './kit/output';
import { useRunner } from './kit/useRunner';
import { messageOf } from './kit/usePdf';
import './ocr.css';
import './scan.css';

const loadScan = () => import('../scan/process');
const A4: [number, number] = [595.28, 841.89];
const MODES: Enhance[] = ['document', 'colour', 'bw', 'original'];
let nextId = 0;

export default function Scan({ tool }: { tool: Tool }) {
  const [pages, setPages] = useState<ScanPage[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string>();
  const [size, setSize] = useState<'a4' | 'fit'>('a4');
  const [searchable, setSearchable] = useState(false);
  const [languages, setLanguages] = useState<OcrLanguage[]>(['eng']);
  const [since] = useState(uploadSnapshot);
  const runner = useRunner();
  const urls = useRef(thumbs);
  urls.current = thumbs;

  useEffect(() => () => Object.values(urls.current).forEach((u) => URL.revokeObjectURL(u)), []);
  useEffect(() => { if (peekHandOff().length) void add(takeHandOff()); }, []);

  const refreshThumb = async (page: ScanPage) => {
    const { renderScan, canvasJpeg } = await loadScan();
    const url = URL.createObjectURL(await canvasJpeg(await renderScan(page, 480), 0.8));
    setThumbs((t) => { if (t[page.id]) URL.revokeObjectURL(t[page.id]!); return { ...t, [page.id]: url }; });
  };

  async function add(files: File[]) {
    setAdding(true);
    setAddError(undefined);
    runner.clear();
    try {
      const { findPage } = await loadScan();
      for (const file of files) {
        const { quad, found } = await findPage(file);
        const page: ScanPage = { id: `p${nextId++}`, file, quad, found, turns: 0, mode: 'document' };
        setPages((p) => [...p, page]);
        void refreshThumb(page);
      }
    } catch (e) {
      setAddError(messageOf(e));
    } finally {
      setAdding(false);
    }
  }

  const update = (page: ScanPage) => {
    setPages((p) => p.map((x) => (x.id === page.id ? page : x)));
    void refreshThumb(page);
    runner.clear();
  };
  const move = (i: number, by: number) => {
    const next = [...pages];
    const [item] = next.splice(i, 1);
    next.splice(i + by, 0, item!);
    setPages(next);
    runner.clear();
  };

  const editPage = pages.find((p) => p.id === editing);
  if (editPage) {
    return (
      <ToolLayout tool={tool}>
        <CropEditor page={editPage} number={pages.indexOf(editPage) + 1} onDone={(page) => { update(page); setEditing(null); }} onCancel={() => setEditing(null)} />
      </ToolLayout>
    );
  }

  const n = pages.length;
  return (
    <ToolLayout tool={tool}>
      <div className={n ? 'scan-add scan-add--compact' : 'scan-add hp-card'}>
        {!n && <p className="scan-add__lead">Photograph each page on a darker surface, from straight above. Happy PDF finds the edges, straightens and cleans it up.</p>}
        <div className="tool-actions">
          <Button size={n ? 'md' : 'lg'} icon={<Camera aria-hidden size={20} />} onClick={async () => { const f = await pickFiles({ accept: 'image/*', multiple: false, capture: 'environment' }); if (f.length) void add(f); }}>{n ? 'Take another photo' : 'Take a photo'}</Button>
          <Button size={n ? 'md' : 'lg'} variant="tonal" icon={<ImagePlus aria-hidden size={20} />} onClick={async () => { const f = await pickFiles({ accept: IMAGE_ACCEPT, multiple: true }); if (f.length) void add(f); }}>Choose photos</Button>
        </div>
        {!n && <p className="drop__hint">Stays on your device. Nothing is uploaded.</p>}
      </div>
      {adding && <p className="run__status" role="status">Finding the page…</p>}
      {addError && <Note tone="danger">{addError}</Note>}

      {n > 0 && (
        <ol className="thumbs scan-pages" aria-label="Scanned pages">
          {pages.map((p, i) => (
            <li key={p.id} className="thumb">
              <button type="button" className="thumb__button" onClick={() => setEditing(p.id)} aria-label={`Page ${i + 1}: adjust corners and clean-up`}>
                <span className="thumb__img">{thumbs[p.id] ? <img src={thumbs[p.id]} alt="" /> : <span className="thumb__img--empty" />}</span>
                <span className="thumb__label">Page {i + 1}{p.found ? '' : ' · check edges'}</span>
              </button>
              <span className="thumb__tools">
                <IconButton label={`Move page ${i + 1} earlier`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowLeft aria-hidden size={18} /></IconButton>
                <IconButton label={`Adjust page ${i + 1}`} onClick={() => setEditing(p.id)}><Crop aria-hidden size={18} /></IconButton>
                <IconButton label={`Remove page ${i + 1}`} onClick={() => { setPages(pages.filter((x) => x.id !== p.id)); runner.clear(); }}><Trash2 aria-hidden size={18} /></IconButton>
                <IconButton label={`Move page ${i + 1} later`} disabled={i === n - 1} onClick={() => move(i, 1)}><ArrowRight aria-hidden size={18} /></IconButton>
              </span>
            </li>
          ))}
        </ol>
      )}

      {n > 0 && (
        <div className="hp-card options">
          <div>
            <span className="options__label" id="scan-size">Page size</span>
            <div className="options__chips" role="group" aria-labelledby="scan-size">
              <Chip selected={size === 'a4'} onClick={() => { setSize('a4'); runner.clear(); }}>A4</Chip>
              <Chip selected={size === 'fit'} onClick={() => { setSize('fit'); runner.clear(); }}>Same as page</Chip>
            </div>
          </div>
          <div className="ocr-switch">
            <span>
              <span className="options__label">Make text searchable</span>
              <span className="options__hint">Reads the words on this device, so you can search and copy them in the PDF.</span>
            </span>
            <Switch checked={searchable} onChange={(v) => { setSearchable(v); runner.clear(); }} label="Make text searchable" />
          </div>
          {searchable && (
            <div>
              <span className="options__label" id="scan-lang">Language of the text</span>
              <div className="options__chips" role="group" aria-labelledby="scan-lang">
                {LANGUAGES.map((l) => <Chip key={l.id} selected={languages.includes(l.id)} onClick={() => { setLanguages((x) => (x.includes(l.id) ? x.filter((y) => y !== l.id) : [...x, l.id])); runner.clear(); }}>{l.name}</Chip>)}
              </div>
            </div>
          )}
        </div>
      )}

      {n > 0 && !runner.output && (
        <RunPanel label={`Make PDF of ${n} page${n === 1 ? '' : 's'}`} busyLabel={searchable ? 'Cleaning up and reading pages' : 'Cleaning up pages'} busy={runner.busy} progress={runner.progress} error={runner.error}
          disabled={searchable && !languages.length}
          onRun={() => runner.run(async (report) => {
            const [{ renderScan, canvasJpeg }, { searchablePdf }] = await Promise.all([loadScan(), import('../ocr/searchable')]);
            const ocr = searchable ? await import('../ocr/engine') : null;
            const out = [];
            try {
              for (const [i, page] of pages.entries()) {
                const canvas = await renderScan(page, 2400);
                const jpeg = await canvasJpeg(canvas, page.mode === 'bw' ? 0.75 : 0.82);
                const textLayer = ocr ? (await ocr.recognize(jpeg, languages, { textLayer: true, onProgress: (p) => report((i + 0.3 + p * 0.7) / n) })).textLayer : undefined;
                const shape: [number, number] = canvas.width > canvas.height ? [A4[1], A4[0]] : A4;
                let points: [number, number];
                let imageRect;
                if (size === 'a4') {
                  points = shape;
                  const k = Math.min(shape[0] / canvas.width, shape[1] / canvas.height);
                  const w = canvas.width * k, h = canvas.height * k;
                  imageRect = { x: (shape[0] - w) / 2, y: (shape[1] - h) / 2, width: w, height: h };
                } else {
                  const k = 841.89 / Math.max(canvas.width, canvas.height);
                  points = [canvas.width * k, canvas.height * k];
                }
                out.push({ jpeg: new Uint8Array(await jpeg.arrayBuffer()), points, imageRect, textLayer });
                report((i + 1) / n);
              }
            } finally {
              if (ocr) void ocr.stopOcr();
            }
            const bytes = await searchablePdf(out, 'Scanned document');
            const stamp = new Date().toISOString().slice(0, 10);
            return { blob: pdfBlob(bytes), name: `scan-${stamp}.pdf`, summary: `${n} page${n === 1 ? '' : 's'}${searchable ? ', searchable' : ''}. No watermark.` };
          })} />
      )}
      {runner.output && <ResultCard {...runner.output} tool={tool.id} since={since} />}
    </ToolLayout>
  );
}

/** Drag the four corners onto the page's corners; arrow keys move a focused corner. */
function CropEditor({ page, number, onDone, onCancel }: { page: ScanPage; number: number; onDone: (page: ScanPage) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState(page);
  const [photo, setPhoto] = useState<{ url: string; width: number; height: number } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<number | null>(null);

  useEffect(() => {
    let url = '';
    void loadScan().then(async ({ photoCanvas }) => {
      const canvas = await photoCanvas(page.file, 1400);
      url = URL.createObjectURL(await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), 'image/jpeg', 0.85)));
      setPhoto({ url, width: canvas.width, height: canvas.height });
    });
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [page.file]);

  // Small live result of the current corners and clean-up.
  useEffect(() => {
    let url = '';
    let cancelled = false;
    const t = window.setTimeout(async () => {
      const { renderScan, canvasJpeg } = await loadScan();
      const blob = await canvasJpeg(await renderScan(draft, 520), 0.8);
      if (cancelled) return;
      url = URL.createObjectURL(blob);
      setPreview(url);
    }, 250);
    return () => { cancelled = true; window.clearTimeout(t); if (url) URL.revokeObjectURL(url); };
  }, [draft]);

  const set = (patch: Partial<ScanPage>) => setDraft((d) => ({ ...d, ...patch }));
  const moveCorner = (i: number, p: Point) => {
    const quad = [...draft.quad] as Quad;
    quad[i] = { x: Math.min(1, Math.max(0, p.x)), y: Math.min(1, Math.max(0, p.y)) };
    set({ quad });
  };
  const toPhoto = (e: PointerEvent): Point | null => {
    const el = svg.current;
    const ctm = el?.getScreenCTM();
    if (!el || !ctm || !photo) return null;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return { x: pt.x / photo.width, y: pt.y / photo.height };
  };
  const onKey = (i: number) => (e: KeyboardEvent) => {
    const step = e.shiftKey ? 0.05 : 0.01;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!d) return;
    e.preventDefault();
    moveCorner(i, { x: draft.quad[i]!.x + d[0]!, y: draft.quad[i]!.y + d[1]! });
  };
  const names = ['Top-left', 'Top-right', 'Bottom-right', 'Bottom-left'];

  return (
    <>
      <p className="tool__blurb">Page {number}: drag the corners onto the page’s corners.</p>
      <div className="scan-editor">
        <div className="scan-editor__photo">
          {photo ? (
            <svg ref={svg} viewBox={`0 0 ${photo.width} ${photo.height}`} className="scan-crop" role="group" aria-label="Page corners"
              onPointerMove={(e) => { if (drag.current === null) return; const p = toPhoto(e); if (p) moveCorner(drag.current, p); }}
              onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
              <image href={photo.url} width={photo.width} height={photo.height} />
              <polygon className="scan-crop__shade" fillRule="evenodd"
                points={`0,0 ${photo.width},0 ${photo.width},${photo.height} 0,${photo.height} 0,0 ${draft.quad.map((p) => `${p.x * photo.width},${p.y * photo.height}`).join(' ')} ${draft.quad[0].x * photo.width},${draft.quad[0].y * photo.height}`} />
              <polygon className="scan-crop__edge" points={draft.quad.map((p) => `${p.x * photo.width},${p.y * photo.height}`).join(' ')} />
              {draft.quad.map((p, i) => {
                const r = Math.max(photo.width, photo.height) * 0.025;
                return (
                  <g key={i} className="scan-crop__handle" tabIndex={0} role="button" aria-label={`${names[i]} corner. Drag, or use the arrow keys.`} onKeyDown={onKey(i)}
                    onPointerDown={(e) => { e.preventDefault(); (e.currentTarget as Element).setPointerCapture?.(e.pointerId); drag.current = i; svg.current?.setPointerCapture(e.pointerId); }}>
                    <circle cx={p.x * photo.width} cy={p.y * photo.height} r={r * 2.2} className="scan-crop__hit" />
                    <circle cx={p.x * photo.width} cy={p.y * photo.height} r={r} className="scan-crop__dot" />
                  </g>
                );
              })}
            </svg>
          ) : <div className="scan-empty scan-editor__loading">Opening photo…</div>}
        </div>
        <div className="scan-editor__side">
          <div className="tool-actions">
            <Button variant="tonal" icon={<ScanSearch aria-hidden size={18} />} onClick={async () => { const { findPage } = await loadScan(); const r = await findPage(page.file); set({ quad: r.quad, found: r.found }); }}>Find edges</Button>
            <Button variant="text" icon={<Maximize aria-hidden size={18} />} onClick={() => set({ quad: insetQuad(1, 1, 0), found: true })}>Whole photo</Button>
            <Button variant="text" icon={<RotateCw aria-hidden size={18} />} onClick={() => set({ turns: ((draft.turns + 1) % 4) as ScanPage['turns'] })}>Rotate</Button>
          </div>
          <div>
            <span className="options__label" id="scan-mode">Clean-up</span>
            <div className="options__chips" role="group" aria-labelledby="scan-mode">
              {MODES.map((m) => <Chip key={m} selected={draft.mode === m} onClick={() => set({ mode: m })}>{ENHANCE_LABEL[m]}</Chip>)}
            </div>
          </div>
          <div className="scan-editor__result">
            <span className="options__label">Result</span>
            {preview ? <img src={preview} alt={`Page ${number} after straightening and clean-up`} /> : <div className="scan-empty">…</div>}
          </div>
          <div className="tool-actions">
            <Button onClick={() => onDone({ ...draft, found: true })}>Done</Button>
            <Button variant="text" onClick={onCancel}>Cancel</Button>
          </div>
        </div>
      </div>
    </>
  );
}
