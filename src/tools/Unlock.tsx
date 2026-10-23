import { Note } from '../design/ui';
import { ResultCard } from '../files/ResultCard';
import { unlockPdf } from '../pdf/engine';
import type { Tool } from '../features/tools/catalog';
import { SinglePdf } from './kit/SinglePdf';
import { RunPanel } from './kit/parts';
import { outputName, pdfBlob } from './kit/output';
import { useRunner } from './kit/useRunner';
import type { LoadedPdf } from './kit/usePdf';
import type { UploadSnapshot } from '../privacy/uploadMonitor';

export default function Unlock({ tool }: { tool: Tool }) {
  return <SinglePdf tool={tool} prompt="Choose a protected PDF">{(pdf, since) => <Options key={pdf.file.name + pdf.file.size} pdf={pdf} since={since} tool={tool} />}</SinglePdf>;
}

function Options({ pdf, since, tool }: { pdf: LoadedPdf; since: UploadSnapshot; tool: Tool }) {
  const runner = useRunner();
  return (
    <>
      {pdf.password === undefined
        ? <Note>This PDF has no open password, so there’s nothing to remove. Saving makes a clean copy.</Note>
        : <Note tone="success">Password accepted. Save a copy that opens without it.</Note>}
      {!runner.output && (
        <RunPanel label="Remove password" busyLabel="Unlocking" busy={runner.busy} error={runner.error}
          onRun={() => runner.run(async () => {
            const bytes = await unlockPdf(pdf.bytes, pdf.password ?? '');
            return { blob: pdfBlob(bytes), name: outputName(pdf.file.name, 'unlocked'), summary: 'This copy opens without a password.' };
          })} />
      )}
      {runner.output && <ResultCard {...runner.output} tool={tool.id} since={since} />}
    </>
  );
}
