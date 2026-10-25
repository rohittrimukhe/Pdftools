import { Note } from '../design/ui';
import { ResultCard } from '../files/ResultCard';
import { Link } from '../app/router';
import type { Tool } from '../features/tools/catalog';
import type { UploadSnapshot } from '../privacy/uploadMonitor';
import { SinglePdf } from './kit/SinglePdf';
import { RunPanel } from './kit/parts';
import { outputName } from './kit/output';
import { useRunner } from './kit/useRunner';
import type { LoadedPdf } from './kit/usePdf';

export default function PdfToWord({ tool }: { tool: Tool }) {
  return <SinglePdf tool={tool} prompt="Choose a PDF to turn into Word">{(pdf, since) => <Options key={pdf.file.name + pdf.file.size} pdf={pdf} since={since} tool={tool} />}</SinglePdf>;
}

function Options({ pdf, since, tool }: { pdf: LoadedPdf; since: UploadSnapshot; tool: Tool }) {
  const runner = useRunner();
  return (
    <>
      <Note>You get the text in an editable Word file: paragraphs and headings, page by page. Pictures, tables and exact layout are not rebuilt. For a scan, run <Link to="/tools/ocr">Text from scan (OCR)</Link> first.</Note>
      {!runner.output && (
        <RunPanel label="Convert to Word" busyLabel="Reading the text" busy={runner.busy} progress={runner.progress} error={runner.error}
          onRun={() => runner.run(async (report) => {
            const { pdfToDocx } = await import('../office/pdfToDocx');
            const title = pdf.file.name.replace(/\.pdf$/i, '');
            const { docx, pages, words } = await pdfToDocx(pdf.bytes, { title, password: pdf.password, onProgress: report });
            return {
              blob: new Blob([docx as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
              name: outputName(pdf.file.name, 'editable', '.docx'),
              summary: `${words} words from ${pages} page${pages === 1 ? '' : 's'}. Opens in Word, Google Docs, LibreOffice and Pages.`,
            };
          })} />
      )}
      {runner.output && <ResultCard {...runner.output} tool={tool.id} since={since} />}
    </>
  );
}
