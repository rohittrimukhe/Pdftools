import { useState } from 'react';
import { Chip, Note } from '../design/ui';
import './exact.css';
import { ResultCard } from '../files/ResultCard';
import { decodeImage, drawImage, encodeImage, FORMAT_EXT, FORMAT_LABEL, resizedSize, type OutputFormat, type Resize } from '../images/codec';
import { formatBytes } from '../lib/format';
import { PdfError } from '../pdf/errors';
import { baseName } from '../platform/save';
import { uploadSnapshot } from '../privacy/uploadMonitor';
import type { Tool } from '../features/tools/catalog';
import { ImageList, useImageList } from './kit/ImageList';
import { RangeField, RunPanel } from './kit/parts';
import { ToolLayout } from './kit/ToolLayout';
import { zipBlob } from './kit/output';
import { useRunner } from './kit/useRunner';

const FORMATS: OutputFormat[] = ['jpeg', 'png', 'webp', 'gif'];
type Target = OutputFormat | 'same';

/** Keeps the file's own format when the browser can write it; otherwise PNG. */
function sameFormat(file: File): OutputFormat {
  if (/jpe?g/.test(file.type) || /\.jpe?g$/i.test(file.name)) return 'jpeg';
  if (file.type === 'image/webp') return 'webp';
  if (file.type === 'image/gif') return 'gif';
  return 'png';
}

function Batch({ tool, mode }: { tool: Tool; mode: 'convert' | 'resize' }) {
  const list = useImageList();
  const [target, setTarget] = useState<Target>(mode === 'convert' ? 'jpeg' : 'same');
  const [quality, setQuality] = useState(85);
  const [how, setHow] = useState<'percent' | 'pixels' | 'longest'>('percent');
  const [percent, setPercent] = useState(50);
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [keepShape, setKeepShape] = useState(true);
  const [longest, setLongest] = useState('1600');
  const [since] = useState(uploadSnapshot);
  const runner = useRunner();
  const n = list.items.length;
  const lossy = target === 'jpeg' || target === 'webp' || (target === 'same' && list.items.some((i) => ['jpeg', 'webp'].includes(sameFormat(i.file))));
  const clear = runner.clear;

  const resize: Resize | null = mode === 'convert' ? null
    : how === 'percent' ? { by: 'percent', percent }
    : how === 'longest' ? { by: 'longest', pixels: Number(longest) || 0 }
    : { by: 'pixels', width: Number(width) || undefined, height: Number(height) || undefined, keepShape };
  const problem = resize?.by === 'pixels' && !resize.width && !resize.height ? 'Enter a width, a height, or both.'
    : resize?.by === 'longest' && !(resize.pixels > 0) ? 'Enter the size of the longest side.' : undefined;
  const num = (set: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => { set(e.target.value.replace(/[^\d]/g, '')); clear(); };

  return (
    <ToolLayout tool={tool}>
      <ImageList list={list} title={mode === 'convert' ? 'Choose images to convert' : 'Choose images to resize'} onChange={clear} />
      {n > 0 && (
        <div className="hp-card options">
          {mode === 'resize' && (
            <>
              <div>
                <span className="options__label" id="rs-how">Resize by</span>
                <div className="options__chips" role="group" aria-labelledby="rs-how">
                  <Chip selected={how === 'percent'} onClick={() => { setHow('percent'); clear(); }}>Percentage</Chip>
                  <Chip selected={how === 'pixels'} onClick={() => { setHow('pixels'); clear(); }}>Exact pixels</Chip>
                  <Chip selected={how === 'longest'} onClick={() => { setHow('longest'); clear(); }}>Longest side</Chip>
                </div>
              </div>
              {how === 'percent' && <RangeField id="rs-percent" label="Size" min={5} max={200} step={5} value={percent} onChange={(v) => { setPercent(v); clear(); }} format={(v) => `${v}%`} />}
              {how === 'pixels' && (
                <>
                  <div className="exact__grid">
                    <div className="hp-field"><label htmlFor="rs-w">Width (px)</label><input id="rs-w" className="hp-input" inputMode="numeric" value={width} onChange={num(setWidth)} /></div>
                    <div className="hp-field"><label htmlFor="rs-h">Height (px)</label><input id="rs-h" className="hp-input" inputMode="numeric" value={height} onChange={num(setHeight)} /></div>
                  </div>
                  <div className="options__chips" role="group" aria-label="Shape">
                    <Chip selected={keepShape} onClick={() => { setKeepShape(true); clear(); }}>Keep shape</Chip>
                    <Chip selected={!keepShape} onClick={() => { setKeepShape(false); clear(); }}>Stretch to fit</Chip>
                  </div>
                </>
              )}
              {how === 'longest' && <div className="hp-field"><label htmlFor="rs-long">Longest side (px)</label><input id="rs-long" className="hp-input" inputMode="numeric" value={longest} onChange={num(setLongest)} /></div>}
            </>
          )}
          <div>
            <span className="options__label" id="cv-format">Save as</span>
            <div className="options__chips" role="group" aria-labelledby="cv-format">
              {mode === 'resize' && <Chip selected={target === 'same'} onClick={() => { setTarget('same'); clear(); }}>Same format</Chip>}
              {FORMATS.map((f) => <Chip key={f} selected={target === f} onClick={() => { setTarget(f); clear(); }}>{FORMAT_LABEL[f]}</Chip>)}
            </div>
            {target === 'jpeg' && <p className="options__hint">JPG has no transparency: clear areas become white.</p>}
            {target === 'gif' && <p className="options__hint">GIF uses up to 256 colours. Animated GIFs keep their first frame.</p>}
          </div>
          {lossy && <RangeField id="cv-quality" label="Quality" min={40} max={100} step={5} value={quality} onChange={(v) => { setQuality(v); clear(); }} format={(v) => `${v}%`} />}
          {problem && <Note tone="danger">{problem}</Note>}
        </div>
      )}
      {n > 0 && !runner.output && (
        <RunPanel label={`${mode === 'convert' ? 'Convert' : 'Resize'} ${n} image${n === 1 ? '' : 's'}`} busyLabel={mode === 'convert' ? 'Converting' : 'Resizing'} busy={runner.busy} progress={runner.progress} error={runner.error} disabled={Boolean(problem)}
          onRun={() => runner.run(async (report) => {
            const out: Array<{ name: string; bytes: Uint8Array; blob: Blob }> = [];
            let before = 0;
            for (const [i, { file }] of list.items.entries()) {
              before += file.size;
              let image;
              try { image = await decodeImage(file); } catch (e) { throw new PdfError('not-pdf', `${file.name}: ${(e as Error).message}`); }
              const format = target === 'same' ? sameFormat(file) : target;
              const size = resize ? resizedSize(image.width, image.height, resize) : { width: image.width, height: image.height };
              const canvas = drawImage(image, size.width, size.height, format === 'jpeg' ? '#ffffff' : undefined);
              image.close();
              const blob = await encodeImage(canvas, format, quality / 100);
              canvas.width = canvas.height = 0;
              const suffix = mode === 'resize' ? `-${size.width}x${size.height}` : '';
              out.push({ name: `${baseName(file.name)}${suffix}${FORMAT_EXT[format]}`, bytes: new Uint8Array(await blob.arrayBuffer()), blob });
              report((i + 1) / n);
            }
            const after = out.reduce((s, f) => s + f.blob.size, 0);
            const summary = `${formatBytes(before)} → ${formatBytes(after)}`;
            if (out.length === 1) return { blob: out[0]!.blob, name: out[0]!.name, summary };
            return { blob: zipBlob(out), name: `images-${mode === 'convert' ? 'converted' : 'resized'}.zip`, summary: `${out.length} images in one ZIP file. ${summary}.` };
          })} />
      )}
      {runner.output && <ResultCard {...runner.output} tool={tool.id} since={since} />}
    </ToolLayout>
  );
}

export const ConvertImage = ({ tool }: { tool: Tool }) => <Batch tool={tool} mode="convert" />;
export const ResizeImage = ({ tool }: { tool: Tool }) => <Batch tool={tool} mode="resize" />;
