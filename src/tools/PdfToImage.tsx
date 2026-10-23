import { useState } from 'react';
import { Chip } from '../design/ui';
import { ResultCard } from '../files/ResultCard';
import { encodeImage, FORMAT_EXT, type OutputFormat } from '../images/codec';
import { parsePageList } from '../pdf/ranges';
import { PdfError } from '../pdf/errors';
import { openForView, renderPage } from '../pdf/render';
import { baseName } from '../platform/save';
import type { Tool } from '../features/tools/catalog';
import type { UploadSnapshot } from '../privacy/uploadMonitor';
import { SinglePdf } from './kit/SinglePdf';
import { RunPanel } from './kit/parts';
import { zipBlob } from './kit/output';
import { useRunner } from './kit/useRunner';
import type { LoadedPdf } from './kit/usePdf';

const DPI = { screen: 96, standard: 150, print: 300 } as const;

export default function PdfToImage({ tool }: { tool: Tool }) {
  return <SinglePdf tool={tool} prompt="Choose a PDF to turn into images">{(pdf, since) => <Options key={pdf.file.name + pdf.file.size} pdf={pdf} since={since} tool={tool} />}</SinglePdf>;
}

function Options({ pdf, since, tool }: { pdf: LoadedPdf; since: UploadSnapshot; tool: Tool }) {
  const [format, setFormat] = useState<'jpeg' | 'png'>('jpeg');
  const [dpi, setDpi] = useState<keyof typeof DPI>('standard');
  const [pages, setPages] = useState('');
  const runner = useRunner();
  let chosen: number[] = [];
  let problem: string | undefined;
  try { chosen = pages.trim() ? parsePageList(pages, pdf.pages) : Array.from({ length: pdf.pages }, (_, i) => i); }
  catch (e) { problem = e instanceof PdfError ? e.message : 'Check the pages you typed.'; }

  return (
    <>
      <div className="hp-card options">
        <div>
          <span className="options__label" id="p2i-format">Format</span>
          <div className="options__chips" role="group" aria-labelledby="p2i-format">
            <Chip selected={format === 'jpeg'} onClick={() => { setFormat('jpeg'); runner.clear(); }}>JPG</Chip>
            <Chip selected={format === 'png'} onClick={() => { setFormat('png'); runner.clear(); }}>PNG</Chip>
          </div>
          <p className="options__hint">{format === 'jpeg' ? 'Smaller files, best for photos and sharing.' : 'Sharpest text and lines, larger files.'}</p>
        </div>
        <div>
          <span className="options__label" id="p2i-dpi">Quality</span>
          <div className="options__chips" role="group" aria-labelledby="p2i-dpi">
            <Chip selected={dpi === 'screen'} onClick={() => { setDpi('screen'); runner.clear(); }}>Screen (96 dpi)</Chip>
            <Chip selected={dpi === 'standard'} onClick={() => { setDpi('standard'); runner.clear(); }}>Standard (150 dpi)</Chip>
            <Chip selected={dpi === 'print'} onClick={() => { setDpi('print'); runner.clear(); }}>Print (300 dpi)</Chip>
          </div>
        </div>
        <div className="hp-field">
          <label htmlFor="p2i-pages">Pages</label>
          <input id="p2i-pages" className="hp-input" placeholder={`All ${pdf.pages} pages`} value={pages} onChange={(e) => { setPages(e.target.value); runner.clear(); }} />
        </div>
        {problem && <p className="hp-note hp-note--danger">{problem}</p>}
      </div>
      {!runner.output && (
        <RunPanel label={`Save ${chosen.length} page${chosen.length === 1 ? '' : 's'} as ${format === 'jpeg' ? 'JPG' : 'PNG'}`} busyLabel="Drawing pages" busy={runner.busy} progress={runner.progress} error={runner.error}
          disabled={Boolean(problem) || chosen.length === 0}
          onRun={() => runner.run(async (report) => {
            const doc = await openForView(pdf.bytes, pdf.password);
            const stem = baseName(pdf.file.name);
            const files: Array<{ name: string; bytes: Uint8Array; blob: Blob }> = [];
            try {
              for (const [i, index] of chosen.entries()) {
                const page = await doc.getPage(index + 1);
                const canvas = await renderPage(page, DPI[dpi] / 72);
                const blob = await encodeImage(canvas, format as OutputFormat, 0.9);
                files.push({ name: `${stem}-page-${index + 1}${FORMAT_EXT[format]}`, bytes: new Uint8Array(await blob.arrayBuffer()), blob });
                canvas.width = canvas.height = 0;
                page.cleanup();
                report((i + 1) / chosen.length);
              }
            } finally { await doc.loadingTask.destroy(); }
            if (files.length === 1) return { blob: files[0]!.blob, name: files[0]!.name };
            return { blob: zipBlob(files), name: `${stem}-images.zip`, summary: `${files.length} images in one ZIP file.` };
          })} />
      )}
      {runner.output && <ResultCard {...runner.output} tool={tool.id} since={since} />}
    </>
  );
}
