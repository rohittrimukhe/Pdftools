import { useEffect, useMemo, useState } from 'react';
import { Chip, Note, Switch } from '../design/ui';
import { ResultCard } from '../files/ResultCard';
import { peekHandOff, takeHandOff } from '../files/handoff';
import { formatBytes } from '../lib/format';
import { openPdf } from '../pdf/engine';
import { PdfError } from '../pdf/errors';
import { baseName } from '../platform/save';
import { uploadSnapshot } from '../privacy/uploadMonitor';
import type { Tool } from '../features/tools/catalog';
import { IMAGE_PRESETS, PDF_TARGETS_KB, type ImagePreset } from '../exact/presets';
import { fitImage, FitError } from '../exact/image';
import { fitPdf } from '../exact/pdf';
import { DropZone } from './kit/DropZone';
import { FileHead, RunPanel, UnlockPrompt } from './kit/parts';
import { ToolLayout } from './kit/ToolLayout';
import { pdfBlob } from './kit/output';
import { useRunner } from './kit/useRunner';
import './exact.css';

type Mode = 'pdf' | 'photo' | 'signature';
const isPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
const kbLabel = (n: number) => (n >= 1024 ? `${n / 1024} MB` : `${n} KB`);

export default function ExactSize({ tool }: { tool: Tool }) {
  const [mode, setMode] = useState<Mode>('photo');
  const [file, setFile] = useState<File | null>(null);
  const [since, setSince] = useState(uploadSnapshot);
  const runner = useRunner();

  useEffect(() => {
    const first = peekHandOff()[0];
    if (!first) return;
    takeHandOff();
    setMode(isPdf(first) ? 'pdf' : 'photo');
    setFile(first);
  }, []);

  const choose = (next: Mode) => { setMode(next); setFile(null); runner.clear(); };
  const accept = mode === 'pdf' ? 'application/pdf,.pdf' : 'image/jpeg,image/png,image/webp,image/gif,image/bmp';

  return (
    <ToolLayout tool={tool}>
      <div className="options__chips" role="group" aria-label="What to resize">
        <Chip selected={mode === 'photo'} onClick={() => choose('photo')}>Photo</Chip>
        <Chip selected={mode === 'signature'} onClick={() => choose('signature')}>Signature</Chip>
        <Chip selected={mode === 'pdf'} onClick={() => choose('pdf')}>PDF</Chip>
      </div>
      {!file ? (
        <DropZone accept={accept} title={mode === 'pdf' ? 'Choose a PDF' : mode === 'signature' ? 'Choose a photo or scan of your signature' : 'Choose a photo'}
          hint={mode === 'pdf' ? undefined : 'JPG, PNG or WebP'} onFiles={([f]) => { if (f) { setFile(f); setSince(uploadSnapshot()); runner.clear(); } }} />
      ) : mode === 'pdf' ? (
        <PdfFit key={file.name + file.size} file={file} onReset={() => setFile(null)} tool={tool} since={since} />
      ) : (
        <ImageFit key={file.name + file.size + mode} file={file} kind={mode} onReset={() => setFile(null)} tool={tool} since={since} />
      )}
    </ToolLayout>
  );
}

function ImageFit({ file, kind, onReset, tool, since }: { file: File; kind: 'photo' | 'signature'; onReset: () => void; tool: Tool; since: ReturnType<typeof uploadSnapshot> }) {
  const presets = useMemo(() => IMAGE_PRESETS.filter((p) => p.kind === kind), [kind]);
  const [preset, setPreset] = useState<ImagePreset | null>(presets[0] ?? null);
  const [width, setWidth] = useState<string>(String(presets[0]?.width ?? ''));
  const [height, setHeight] = useState<string>(String(presets[0]?.height ?? ''));
  const [minKb, setMinKb] = useState<string>(String(presets[0]?.minKb ?? ''));
  const [maxKb, setMaxKb] = useState<string>(String(presets[0]?.maxKb ?? 50));
  const [whiten, setWhiten] = useState(kind === 'signature');
  const runner = useRunner();
  const [previewUrl, setPreviewUrl] = useState<string>();

  const usePreset = (p: ImagePreset | null) => {
    setPreset(p);
    if (p) { setWidth(String(p.width ?? '')); setHeight(String(p.height ?? '')); setMinKb(String(p.minKb ?? '')); setMaxKb(String(p.maxKb)); }
    runner.clear();
  };
  const num = (v: string) => (v.trim() === '' ? undefined : Number(v));
  const w = num(width), h = num(height), lo = num(minKb), hi = num(maxKb);
  const problem =
    hi === undefined || !(hi > 0) ? 'Enter the largest size allowed, in KB.'
    : lo !== undefined && lo >= hi ? 'The smallest size must be less than the largest.'
    : (w === undefined) !== (h === undefined) ? 'Enter both width and height, or leave both empty.'
    : (w !== undefined && (w < 10 || w > 6000)) || (h !== undefined && (h < 10 || h > 6000)) ? 'Width and height must be between 10 and 6000 pixels.'
    : undefined;

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const field = (id: string, label: string, value: string, set: (v: string) => void, unit: string) => (
    <div className="hp-field">
      <label htmlFor={id}>{label}</label>
      <div className="exact__unit"><input id={id} className="hp-input" inputMode="numeric" value={value} onChange={(e) => { set(e.target.value.replace(/[^\d]/g, '')); setPreset(null); runner.clear(); }} /><span>{unit}</span></div>
    </div>
  );

  return (
    <>
      <FileHead file={file} onReset={onReset} />
      <div className="hp-card options">
        <div>
          <span className="options__label" id="exact-preset">Form or document</span>
          <div className="options__chips" role="group" aria-labelledby="exact-preset">
            {presets.map((p) => <Chip key={p.id} selected={preset?.id === p.id} onClick={() => usePreset(p)}>{p.label}</Chip>)}
            <Chip selected={preset === null} onClick={() => usePreset(null)}>Custom</Chip>
          </div>
          {preset?.note && <p className="options__hint">{preset.note}</p>}
        </div>
        <div className="exact__grid">
          {field('exact-w', 'Width', width, setWidth, 'px')}
          {field('exact-h', 'Height', height, setHeight, 'px')}
          {field('exact-min', 'Smallest allowed', minKb, setMinKb, 'KB')}
          {field('exact-max', 'Largest allowed', maxKb, setMaxKb, 'KB')}
        </div>
        <label className="settings__switch-row exact__switch">
          <span><span className="settings__label">Clean background</span><span className="settings__hint">Makes paper pure white and ink solid. Best for signatures.</span></span>
          <Switch checked={whiten} onChange={(v) => { setWhiten(v); runner.clear(); }} label="Clean background" />
        </label>
        <Note>These are common limits. Always check the size rules in your official notice; you can change any value.</Note>
        {problem && <Note tone="danger">{problem}</Note>}
      </div>
      {!runner.output && (
        <RunPanel label={hi ? `Make it under ${hi} KB` : 'Resize'} busyLabel="Finding the best quality" busy={runner.busy} error={runner.error} disabled={Boolean(problem)}
          onRun={() => runner.run(async () => {
            try {
              const fitted = await fitImage(file, { width: w, height: h, minKb: lo, maxKb: hi!, whiten });
              setPreviewUrl(URL.createObjectURL(fitted.blob));
              const size = formatBytes(fitted.blob.size);
              const summary = `${size} · ${fitted.width} × ${fitted.height} px · JPEG${fitted.underMin ? ` — under the ${lo} KB minimum even at full quality; some forms may refuse it` : ''}`;
              return { blob: fitted.blob, name: `${baseName(file.name)}-${hi}kb.jpg`, summary };
            } catch (e) {
              if (e instanceof FitError) throw new PdfError('bad-range', e.message);
              throw e;
            }
          })} />
      )}
      {runner.output && previewUrl && <img className="exact__preview" src={previewUrl} alt="The resized picture" />}
      {runner.output && <ResultCard {...runner.output} tool={tool.id} since={since} />}
    </>
  );
}

function PdfFit({ file, onReset, tool, since }: { file: File; onReset: () => void; tool: Tool; since: ReturnType<typeof uploadSnapshot> }) {
  const [target, setTarget] = useState(200);
  const [custom, setCustom] = useState('');
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [password, setPassword] = useState<string | undefined>();
  const [locked, setLocked] = useState<{ error?: string } | null>(null);
  const [note, setNote] = useState('');
  const runner = useRunner();
  const limit = custom ? Number(custom) : target;

  useEffect(() => {
    void file.arrayBuffer().then(async (b) => {
      const data = new Uint8Array(b);
      try { await openPdf(data); setBytes(data); } catch (e) {
        if (e instanceof PdfError && e.code === 'password-required') { setLocked({}); setBytes(data); } else runner.run(async () => { throw e; });
      }
    });
  }, [file]);

  if (locked && bytes) {
    return <><FileHead file={file} onReset={onReset} /><UnlockPrompt error={locked.error} onUnlock={async (pw) => {
      try { await openPdf(bytes, pw); setPassword(pw); setLocked(null); } catch (e) { setLocked({ error: e instanceof PdfError ? e.message : undefined }); }
    }} /></>;
  }

  return (
    <>
      <FileHead file={file} onReset={onReset} />
      <div className="hp-card options">
        <div>
          <span className="options__label" id="pdf-target">Largest size allowed</span>
          <div className="options__chips" role="group" aria-labelledby="pdf-target">
            {PDF_TARGETS_KB.map((n) => <Chip key={n} selected={!custom && target === n} onClick={() => { setTarget(n); setCustom(''); runner.clear(); }}>{kbLabel(n)}</Chip>)}
          </div>
        </div>
        <div className="hp-field">
          <label htmlFor="pdf-custom">Or type a limit</label>
          <div className="exact__unit"><input id="pdf-custom" className="hp-input" inputMode="numeric" placeholder="For example 150" value={custom} onChange={(e) => { setCustom(e.target.value.replace(/[^\d]/g, '')); runner.clear(); }} /><span>KB</span></div>
        </div>
        {file.size <= limit * 1024 && <Note tone="success">This PDF is already {formatBytes(file.size)}, under {kbLabel(limit)}.</Note>}
        <Note>If the pages must become images to fit, text can no longer be selected. Tiny limits for many pages make pages blurry.</Note>
      </div>
      {!runner.output && (
        <RunPanel label={`Make it under ${kbLabel(limit)}`} busyLabel={note || 'Working'} busy={runner.busy} progress={runner.progress} error={runner.error}
          disabled={!bytes || !(limit > 0)}
          onRun={() => runner.run(async (report) => {
            const fitted = await fitPdf(bytes!, limit, password, (f, n) => { report(f); setNote(n); });
            if (!fitted) throw new PdfError('bad-range', `This PDF can’t get under ${kbLabel(limit)} while staying readable. Try a larger limit, or split it into smaller parts.`);
            const how = fitted.lossless ? 'pages unchanged' : `pages as images at ${fitted.dpi} dpi`;
            return { blob: pdfBlob(fitted.bytes), name: `${baseName(file.name)}-under-${limit}kb.pdf`, summary: `${formatBytes(file.size)} → ${formatBytes(fitted.bytes.length)} (${how}).` };
          })} />
      )}
      {runner.output && <ResultCard {...runner.output} tool={tool.id} since={since} />}
    </>
  );
}
