import { useState } from 'react';
import { Chip, Note, Switch } from '../design/ui';
import { ResultCard } from '../files/ResultCard';
import { formatBytes } from '../lib/format';


import type { Tool } from '../features/tools/catalog';
import { SinglePdf } from './kit/SinglePdf';
import { RunPanel } from './kit/parts';
import { outputName, pdfBlob } from './kit/output';
import { useRunner } from './kit/useRunner';
import type { LoadedPdf } from './kit/usePdf';
import type { UploadSnapshot } from '../privacy/uploadMonitor';
import { loadEngine, loadRender } from '../pdf/lazy';

export const LEVELS = {
  light: { label: 'Light', dpi: 150, quality: 0.8, hint: 'Sharp text and photos, smaller file' },
  balanced: { label: 'Balanced', dpi: 110, quality: 0.62, hint: 'Good for sharing and email' },
  strong: { label: 'Strong', dpi: 80, quality: 0.45, hint: 'Smallest file, softer images' },
} as const;
export type Level = keyof typeof LEVELS | 'lossless';

export default function Compress({ tool }: { tool: Tool }) {
  return <SinglePdf tool={tool} prompt="Choose a PDF to make smaller">{(pdf, since) => <CompressOptions key={pdf.file.name + pdf.file.size} pdf={pdf} since={since} tool={tool} />}</SinglePdf>;
}

function CompressOptions({ pdf, since, tool }: { pdf: LoadedPdf; since: UploadSnapshot; tool: Tool }) {
  const [level, setLevel] = useState<Level>('balanced');
  const [gray, setGray] = useState(false);
  const runner = useRunner();
  const choose = (next: Level) => { setLevel(next); runner.clear(); };
  const before = pdf.file.size;

  return (
    <>
      <div className="hp-card options">
        <div>
          <span className="options__label" id="level-label">How small</span>
          <div className="options__chips" role="group" aria-labelledby="level-label">
            <Chip selected={level === 'lossless'} onClick={() => choose('lossless')}>Keep everything</Chip>
            {(Object.keys(LEVELS) as Array<keyof typeof LEVELS>).map((key) => (
              <Chip key={key} selected={level === key} onClick={() => choose(key)}>{LEVELS[key].label}</Chip>
            ))}
          </div>
          <p className="options__hint">{level === 'lossless' ? 'Removes waste only. Nothing changes on the page; savings are usually small.' : LEVELS[level].hint}</p>
        </div>
        {level !== 'lossless' && (
          <>
            <label className="settings__switch-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
              <span>Black and white</span>
              <Switch checked={gray} onChange={(v) => { setGray(v); runner.clear(); }} label="Black and white" />
            </label>
            <Note>Pages are turned into images, so text can no longer be selected or searched. Choose “Keep everything” to keep text.</Note>
          </>
        )}
      </div>
      {!runner.output && (
        <RunPanel label="Compress" busyLabel="Compressing" busy={runner.busy} progress={runner.progress} error={runner.error}
          onRun={() => runner.run(async (report) => {
            const bytes = level === 'lossless'
              ? await (await loadEngine()).compressLossless(pdf.bytes, pdf.password)
              : await (await loadRender()).rasterizePdf(pdf.bytes, { ...LEVELS[level], grayscale: gray, onProgress: (d, t) => report(d / t) }, pdf.password);
            if (bytes.length >= before) {
              return { blob: pdfBlob(pdf.bytes), name: pdf.file.name, summary: `This PDF is already as small as this setting can make it (${formatBytes(before)}). Try a stronger setting.` };
            }
            const saved = Math.round((1 - bytes.length / before) * 100);
            return { blob: pdfBlob(bytes), name: outputName(pdf.file.name, 'compressed'), summary: `${formatBytes(before)} → ${formatBytes(bytes.length)}, ${saved}% smaller.` };
          })} />
      )}
      {runner.output && <ResultCard {...runner.output} tool={tool.id} since={since} />}
    </>
  );
}
