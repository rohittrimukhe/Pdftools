import { useState } from 'react';
import { Chip } from '../design/ui';
import { ResultCard } from '../files/ResultCard';

import { chunkPages, parsePageGroups } from '../pdf/ranges';
import { PdfError } from '../pdf/errors';
import type { Tool } from '../features/tools/catalog';
import { DropZone } from './kit/DropZone';
import { FileHead, Loading, RunPanel, UnlockPrompt } from './kit/parts';
import { ToolLayout } from './kit/ToolLayout';
import { outputName, pdfBlob, zipBlob } from './kit/output';
import { usePdf } from './kit/usePdf';
import { useRunner } from './kit/useRunner';
import { baseName } from '../platform/save';
import { loadEngine } from '../pdf/lazy';

type Mode = 'each' | 'every' | 'ranges';

export default function Split({ tool }: { tool: Tool }) {
  const { state, since, load, unlock, reset } = usePdf();
  const [mode, setMode] = useState<Mode>('every');
  const [every, setEvery] = useState(2);
  const [ranges, setRanges] = useState('');
  const runner = useRunner();

  if (state.status === 'empty') return <ToolLayout tool={tool}><DropZone accept="application/pdf,.pdf" title="Choose a PDF to split" onFiles={([f]) => f && load(f)} /></ToolLayout>;
  if (state.status === 'loading') return <ToolLayout tool={tool}><Loading label="Reading your PDF" /></ToolLayout>;
  if (state.status === 'locked') return <ToolLayout tool={tool}><FileHead file={state.file} onReset={reset} /><UnlockPrompt error={state.error} onUnlock={unlock} /></ToolLayout>;
  if (state.status === 'error') return <ToolLayout tool={tool}><FileHead file={state.file} onReset={reset} /><p className="hp-note hp-note--danger">{state.message}</p></ToolLayout>;

  const { pdf } = state;
  let groups: number[][] = [];
  let problem: string | undefined;
  try {
    groups = mode === 'each' ? chunkPages(pdf.pages, 1) : mode === 'every' ? chunkPages(pdf.pages, every) : ranges.trim() ? parsePageGroups(ranges, pdf.pages) : [];
  } catch (error) {
    problem = error instanceof PdfError ? error.message : 'Check the pages you typed.';
  }
  const describe = (group: number[]) => (group.length === 1 ? `${group[0]! + 1}` : `${group[0]! + 1}-${group[group.length - 1]! + 1}`);

  return (
    <ToolLayout tool={tool}>
      <FileHead file={pdf.file} detail={`${pdf.pages} pages`} onReset={() => { reset(); runner.clear(); }} />
      <div className="hp-card options">
        <div>
          <span className="options__label" id="split-mode">How to split</span>
          <div className="options__chips" role="group" aria-labelledby="split-mode">
            <Chip selected={mode === 'every'} onClick={() => { setMode('every'); runner.clear(); }}>Every few pages</Chip>
            <Chip selected={mode === 'each'} onClick={() => { setMode('each'); runner.clear(); }}>Every page</Chip>
            <Chip selected={mode === 'ranges'} onClick={() => { setMode('ranges'); runner.clear(); }}>Custom ranges</Chip>
          </div>
        </div>
        {mode === 'every' && (
          <div className="hp-field">
            <label htmlFor="split-every">Pages in each file</label>
            <input id="split-every" className="hp-input" type="number" inputMode="numeric" min={1} max={pdf.pages} value={every}
              onChange={(e) => { setEvery(Math.max(1, Math.floor(Number(e.target.value) || 1))); runner.clear(); }} />
          </div>
        )}
        {mode === 'ranges' && (
          <div className="hp-field">
            <label htmlFor="split-ranges">Pages for each file</label>
            <input id="split-ranges" className="hp-input" placeholder="1-3, 4-6, 7-last" value={ranges} onChange={(e) => { setRanges(e.target.value); runner.clear(); }} />
            <p className="options__hint">Each comma makes a new file. “7-” or “7-last” runs to the end.</p>
          </div>
        )}
        {problem ? <p className="hp-note hp-note--danger">{problem}</p> : groups.length > 0 && (
          <p className="options__hint" role="status">Makes {groups.length} file{groups.length === 1 ? '' : 's'}: pages {groups.slice(0, 6).map(describe).join(', ')}{groups.length > 6 ? '…' : ''}</p>
        )}
      </div>
      {!runner.output && (
        <RunPanel label={groups.length > 1 ? `Split into ${groups.length} files` : 'Split'} busyLabel="Splitting" busy={runner.busy} progress={runner.progress} error={runner.error}
          disabled={Boolean(problem) || groups.length === 0}
          onRun={() => runner.run(async () => {
            const parts = await (await loadEngine()).splitPdf(pdf.bytes, groups, pdf.password);
            const stem = baseName(pdf.file.name);
            if (parts.length === 1) return { blob: pdfBlob(parts[0]!), name: outputName(pdf.file.name, `pages-${describe(groups[0]!)}`) };
            const blob = zipBlob(parts.map((bytes, i) => ({ name: `${stem}-pages-${describe(groups[i]!)}.pdf`, bytes })));
            return { blob, name: `${stem}-split.zip`, summary: `${parts.length} PDFs in one ZIP file.` };
          })} />
      )}
      {runner.output && <ResultCard {...runner.output} tool={tool.id} since={since} />}
    </ToolLayout>
  );
}
