import { useEffect, useState } from 'react';
import { Chip, Note } from '../design/ui';
import { ResultCard } from '../files/ResultCard';
import { detectFile, type FileKind } from '../files/detect';
import { peekHandOff, takeHandOff } from '../files/handoff';
import { uploadSnapshot } from '../privacy/uploadMonitor';
import type { Tool } from '../features/tools/catalog';
import { ToolLayout } from './kit/ToolLayout';
import { DropZone } from './kit/DropZone';
import { FileHead, RunPanel } from './kit/parts';
import { outputName, pdfBlob } from './kit/output';
import { useRunner } from './kit/useRunner';

/** Word, Excel and PowerPoint to PDF: the same screen, a different reader for each. */
const KINDS = {
  'word-to-pdf': { kind: 'word', accept: '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document', noun: 'Word document', ext: '.docx', note: 'Text, headings, lists, tables and pictures are kept. Fonts and exact spacing are simplified.' },
  'excel-to-pdf': { kind: 'excel', accept: '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', noun: 'Excel workbook', ext: '.xlsx', note: 'Each sheet becomes a table, with values as Excel shows them. Charts and cell colours are not drawn.' },
  'ppt-to-pdf': { kind: 'powerpoint', accept: '.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation', noun: 'PowerPoint presentation', ext: '.pptx', note: 'One page per slide with text, pictures and shapes. Charts, SmartArt and effects are not drawn.' },
} as const satisfies Record<string, { kind: FileKind; accept: string; noun: string; ext: string; note: string }>;
type Id = keyof typeof KINDS;

const LETTER: [number, number] = [612, 792];

export default function OfficeToPdf({ tool }: { tool: Tool }) {
  const spec = KINDS[tool.id as Id];
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string>();
  const [paper, setPaper] = useState<'a4' | 'letter'>('a4');
  const [orientation, setOrientation] = useState<'auto' | 'portrait' | 'landscape'>('auto');
  const [since] = useState(uploadSnapshot);
  const runner = useRunner();

  const choose = async (f: File) => {
    setError(undefined);
    runner.clear();
    const kind = await detectFile(f);
    if (kind !== spec.kind) { setError(`That isn’t a ${spec.noun} (${spec.ext}).${/\.(doc|xls|ppt)$/i.test(f.name) ? ' Older Office files need saving in the newer format first (File › Save as).' : ''}`); return; }
    setFile(f);
  };
  useEffect(() => { const [f] = peekHandOff().length ? takeHandOff() : []; if (f) void choose(f); }, []);

  if (!file) {
    return (
      <ToolLayout tool={tool}>
        <DropZone accept={spec.accept} title={`Choose a ${spec.noun}`} hint={`Converted on this device. ${spec.ext} files.`} onFiles={([f]) => f && void choose(f)} />
        {error && <Note tone="danger">{error}</Note>}
      </ToolLayout>
    );
  }

  return (
    <ToolLayout tool={tool}>
      <FileHead file={file} onReset={() => { setFile(null); runner.clear(); }} />
      {spec.kind !== 'powerpoint' && (
        <div className="hp-card options">
          <div>
            <span className="options__label" id="office-paper">Paper</span>
            <div className="options__chips" role="group" aria-labelledby="office-paper">
              <Chip selected={paper === 'a4'} onClick={() => { setPaper('a4'); runner.clear(); }}>A4</Chip>
              <Chip selected={paper === 'letter'} onClick={() => { setPaper('letter'); runner.clear(); }}>US Letter</Chip>
            </div>
          </div>
          {spec.kind === 'excel' && (
            <div>
              <span className="options__label" id="office-orient">Orientation</span>
              <div className="options__chips" role="group" aria-labelledby="office-orient">
                <Chip selected={orientation === 'auto'} onClick={() => { setOrientation('auto'); runner.clear(); }}>Automatic</Chip>
                <Chip selected={orientation === 'portrait'} onClick={() => { setOrientation('portrait'); runner.clear(); }}>Portrait</Chip>
                <Chip selected={orientation === 'landscape'} onClick={() => { setOrientation('landscape'); runner.clear(); }}>Landscape</Chip>
              </div>
              <p className="options__hint">Automatic turns pages sideways for sheets with many columns.</p>
            </div>
          )}
        </div>
      )}
      <Note>{spec.note}</Note>
      {!runner.output && (
        <RunPanel label="Convert to PDF" busyLabel="Converting" busy={runner.busy} error={runner.error}
          onRun={() => runner.run(async () => {
            const data = new Uint8Array(await file.arrayBuffer());
            const title = file.name.replace(/\.[^.]+$/, '');
            const notes: string[] = [];
            let bytes: Uint8Array, pages: number;
            if (spec.kind === 'powerpoint') {
              const { pptxToPdf } = await import('../office/pptx');
              const r = await pptxToPdf(data);
              bytes = r.bytes; pages = r.slides;
              if (r.skipped.length) notes.push(`Not drawn: ${r.skipped.join(', ')}.`);
              if (r.dropped.length) notes.push(`Characters shown as “?”: ${r.dropped.join(' ')}`);
            } else {
              const [{ renderFlow }, reader] = await Promise.all([import('../office/flow'), spec.kind === 'word' ? import('../office/docx') : import('../office/xlsx')]);
              let blocks;
              let landscape = false;
              if ('readDocx' in reader) {
                const r = await reader.readDocx(data);
                blocks = r.blocks;
              } else {
                const sheets = reader.readXlsx(data);
                blocks = reader.sheetsToBlocks(sheets);
                landscape = orientation === 'landscape' || (orientation === 'auto' && sheets.some((s) => s.rows[0] && s.rows[0].length > 7));
              }
              const r = await renderFlow(blocks, { paper: paper === 'letter' ? LETTER : undefined, landscape, title, fontSize: spec.kind === 'excel' ? 9 : 11 });
              bytes = r.bytes; pages = r.pages;
              if (r.skippedImages) notes.push(`${r.skippedImages} picture${r.skippedImages > 1 ? 's' : ''} in an unsupported format left out.`);
              if (r.dropped.length) notes.push(`Characters the standard PDF fonts can’t show appear as “?”: ${r.dropped.join(' ')}`);
            }
            return { blob: pdfBlob(bytes), name: outputName(file.name, 'converted'), summary: [`${pages} page${pages === 1 ? '' : 's'}.`, ...notes].join(' ') };
          })} />
      )}
      {runner.output && <ResultCard {...runner.output} tool={tool.id} since={since} />}
    </ToolLayout>
  );
}
