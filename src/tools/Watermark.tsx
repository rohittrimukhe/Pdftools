import { useState } from 'react';
import { Chip } from '../design/ui';
import { ResultCard } from '../files/ResultCard';
import { addWatermark } from '../pdf/engine';
import type { Tool } from '../features/tools/catalog';
import type { UploadSnapshot } from '../privacy/uploadMonitor';
import { SinglePdf } from './kit/SinglePdf';
import { RangeField, RunPanel } from './kit/parts';
import { outputName, pdfBlob } from './kit/output';
import { useRunner } from './kit/useRunner';
import type { LoadedPdf } from './kit/usePdf';

const SIZES = { small: 0.08, medium: 0.12, large: 0.18 } as const;
const COLORS = { grey: [0.5, 0.5, 0.5], red: [0.75, 0.1, 0.1], blue: [0.1, 0.25, 0.7] } as const;

export default function Watermark({ tool }: { tool: Tool }) {
  return <SinglePdf tool={tool} prompt="Choose a PDF to watermark">{(pdf, since) => <Options key={pdf.file.name + pdf.file.size} pdf={pdf} since={since} tool={tool} />}</SinglePdf>;
}

function Options({ pdf, since, tool }: { pdf: LoadedPdf; since: UploadSnapshot; tool: Tool }) {
  const [text, setText] = useState('CONFIDENTIAL');
  const [size, setSize] = useState<keyof typeof SIZES>('medium');
  const [color, setColor] = useState<keyof typeof COLORS>('grey');
  const [diagonal, setDiagonal] = useState(true);
  const [opacity, setOpacity] = useState(25);
  const runner = useRunner();
  const set = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); runner.clear(); };

  return (
    <>
      <div className="hp-card options">
        <div className="hp-field">
          <label htmlFor="wm-text">Watermark text</label>
          <input id="wm-text" className="hp-input" value={text} maxLength={60} onChange={(e) => set(setText)(e.target.value)} />
        </div>
        <div className="options__row">
          <div>
            <span className="options__label" id="wm-size">Size</span>
            <div className="options__chips" role="group" aria-labelledby="wm-size">
              {(Object.keys(SIZES) as Array<keyof typeof SIZES>).map((k) => <Chip key={k} selected={size === k} onClick={() => set(setSize)(k)}>{k[0]!.toUpperCase() + k.slice(1)}</Chip>)}
            </div>
          </div>
          <div>
            <span className="options__label" id="wm-color">Colour</span>
            <div className="options__chips" role="group" aria-labelledby="wm-color">
              {(Object.keys(COLORS) as Array<keyof typeof COLORS>).map((k) => <Chip key={k} selected={color === k} onClick={() => set(setColor)(k)}>{k[0]!.toUpperCase() + k.slice(1)}</Chip>)}
            </div>
          </div>
          <div>
            <span className="options__label" id="wm-layout">Direction</span>
            <div className="options__chips" role="group" aria-labelledby="wm-layout">
              <Chip selected={diagonal} onClick={() => set(setDiagonal)(true)}>Diagonal</Chip>
              <Chip selected={!diagonal} onClick={() => set(setDiagonal)(false)}>Straight</Chip>
            </div>
          </div>
        </div>
        <RangeField id="wm-opacity" label="Visibility" min={10} max={80} step={5} value={opacity} onChange={set(setOpacity)} format={(v) => `${v}%`} />
      </div>
      {!runner.output && (
        <RunPanel label="Add watermark" busyLabel="Adding watermark" busy={runner.busy} error={runner.error} disabled={!text.trim()}
          onRun={() => runner.run(async () => {
            const bytes = await addWatermark(pdf.bytes, { text, scale: SIZES[size], color: [...COLORS[color]] as [number, number, number], layout: diagonal ? 'diagonal' : 'flat', opacity: opacity / 100 }, pdf.password);
            return { blob: pdfBlob(bytes), name: outputName(pdf.file.name, 'watermarked'), summary: `“${text.trim()}” on all ${pdf.pages} pages.` };
          })} />
      )}
      {runner.output && <ResultCard {...runner.output} tool={tool.id} since={since} />}
    </>
  );
}
