import { useState } from 'react';
import { Chip } from '../design/ui';
import { ResultCard } from '../files/ResultCard';
import { pageLabel, type NumberPosition, type NumberStyle } from '../pdf/labels';
import type { Tool } from '../features/tools/catalog';
import type { UploadSnapshot } from '../privacy/uploadMonitor';
import { SinglePdf } from './kit/SinglePdf';
import { RunPanel } from './kit/parts';
import { outputName, pdfBlob } from './kit/output';
import { useRunner } from './kit/useRunner';
import type { LoadedPdf } from './kit/usePdf';
import { loadEngine } from '../pdf/lazy';

const POSITIONS: Array<[NumberPosition, string]> = [['bottom-center', 'Bottom centre'], ['bottom-right', 'Bottom right'], ['bottom-left', 'Bottom left'], ['top-center', 'Top centre'], ['top-right', 'Top right'], ['top-left', 'Top left']];
const STYLES: NumberStyle[] = ['n', 'page-n', 'n-of-total'];

export default function PageNumbers({ tool }: { tool: Tool }) {
  return <SinglePdf tool={tool} prompt="Choose a PDF to number">{(pdf, since) => <Options key={pdf.file.name + pdf.file.size} pdf={pdf} since={since} tool={tool} />}</SinglePdf>;
}

function Options({ pdf, since, tool }: { pdf: LoadedPdf; since: UploadSnapshot; tool: Tool }) {
  const [position, setPosition] = useState<NumberPosition>('bottom-center');
  const [style, setStyle] = useState<NumberStyle>('n');
  const [startAt, setStartAt] = useState(1);
  const [skipCover, setSkipCover] = useState(false);
  const runner = useRunner();
  const total = startAt + pdf.pages - (skipCover ? 1 : 0) - 1;

  return (
    <>
      <div className="hp-card options">
        <div>
          <span className="options__label" id="pn-pos">Where</span>
          <div className="options__chips" role="group" aria-labelledby="pn-pos">
            {POSITIONS.map(([value, label]) => <Chip key={value} selected={position === value} onClick={() => { setPosition(value); runner.clear(); }}>{label}</Chip>)}
          </div>
        </div>
        <div>
          <span className="options__label" id="pn-style">Style</span>
          <div className="options__chips" role="group" aria-labelledby="pn-style">
            {STYLES.map((value) => <Chip key={value} selected={style === value} onClick={() => { setStyle(value); runner.clear(); }}>{pageLabel(value, startAt, total)}</Chip>)}
          </div>
        </div>
        <div className="options__row">
          <div className="hp-field">
            <label htmlFor="pn-start">First number</label>
            <input id="pn-start" className="hp-input" type="number" inputMode="numeric" min={0} value={startAt} onChange={(e) => { setStartAt(Math.max(0, Math.floor(Number(e.target.value) || 0))); runner.clear(); }} />
          </div>
          <div>
            <span className="options__label" id="pn-cover">Cover page</span>
            <div className="options__chips" role="group" aria-labelledby="pn-cover">
              <Chip selected={!skipCover} onClick={() => { setSkipCover(false); runner.clear(); }}>Number it</Chip>
              <Chip selected={skipCover} onClick={() => { setSkipCover(true); runner.clear(); }}>Leave it blank</Chip>
            </div>
          </div>
        </div>
      </div>
      {!runner.output && (
        <RunPanel label="Add page numbers" busyLabel="Numbering" busy={runner.busy} error={runner.error} disabled={skipCover && pdf.pages < 2}
          onRun={() => runner.run(async () => {
            const bytes = await (await loadEngine()).addPageNumbers(pdf.bytes, { position, style, startAt, skipFirst: skipCover ? 1 : 0 }, pdf.password);
            return { blob: pdfBlob(bytes), name: outputName(pdf.file.name, 'numbered'), summary: `Numbered ${pageLabel(style, startAt, total)} onwards.` };
          })} />
      )}
      {runner.output && <ResultCard {...runner.output} tool={tool.id} since={since} />}
    </>
  );
}
