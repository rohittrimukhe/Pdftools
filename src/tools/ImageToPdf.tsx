import { useState } from 'react';
import { PDFDocument } from '@cantoo/pdf-lib';
import { Chip } from '../design/ui';
import { ResultCard } from '../files/ResultCard';
import { decodeImage, drawImage, encodeImage } from '../images/codec';
import { PdfError } from '../pdf/errors';
import { baseName } from '../platform/save';
import { uploadSnapshot } from '../privacy/uploadMonitor';
import type { Tool } from '../features/tools/catalog';
import { ImageList, useImageList } from './kit/ImageList';
import { RunPanel } from './kit/parts';
import { ToolLayout } from './kit/ToolLayout';
import { pdfBlob } from './kit/output';
import { useRunner } from './kit/useRunner';

type PageSize = 'fit' | 'a4' | 'letter';
const SIZES: Record<Exclude<PageSize, 'fit'>, [number, number]> = { a4: [595.28, 841.89], letter: [612, 792] };
const MARGINS = { none: 0, small: 18, large: 42 } as const;

export default function ImageToPdf({ tool }: { tool: Tool }) {
  const list = useImageList();
  const [size, setSize] = useState<PageSize>('a4');
  const [margin, setMargin] = useState<keyof typeof MARGINS>('small');
  const [since] = useState(uploadSnapshot);
  const runner = useRunner();
  const n = list.items.length;

  return (
    <ToolLayout tool={tool}>
      <ImageList list={list} ordered title="Choose photos or scans" onChange={runner.clear} />
      {n > 0 && (
        <div className="hp-card options">
          <div>
            <span className="options__label" id="i2p-size">Page size</span>
            <div className="options__chips" role="group" aria-labelledby="i2p-size">
              <Chip selected={size === 'a4'} onClick={() => { setSize('a4'); runner.clear(); }}>A4</Chip>
              <Chip selected={size === 'letter'} onClick={() => { setSize('letter'); runner.clear(); }}>US Letter</Chip>
              <Chip selected={size === 'fit'} onClick={() => { setSize('fit'); runner.clear(); }}>Same as image</Chip>
            </div>
            <p className="options__hint">{size === 'fit' ? 'Each page is the size of its image.' : 'Each image is fitted on the page, turned sideways when it’s wider than tall.'}</p>
          </div>
          {size !== 'fit' && (
            <div>
              <span className="options__label" id="i2p-margin">Margin</span>
              <div className="options__chips" role="group" aria-labelledby="i2p-margin">
                {(Object.keys(MARGINS) as Array<keyof typeof MARGINS>).map((m) => <Chip key={m} selected={margin === m} onClick={() => { setMargin(m); runner.clear(); }}>{m[0]!.toUpperCase() + m.slice(1)}</Chip>)}
              </div>
            </div>
          )}
        </div>
      )}
      {n > 0 && !runner.output && (
        <RunPanel label={`Make a PDF of ${n} image${n === 1 ? '' : 's'}`} busyLabel="Making your PDF" busy={runner.busy} progress={runner.progress} error={runner.error}
          onRun={() => runner.run(async (report) => {
            const out = await PDFDocument.create();
            for (const [i, { file }] of list.items.entries()) {
              let image;
              try { image = await decodeImage(file); } catch (e) { throw new PdfError('not-pdf', `${file.name}: ${(e as Error).message}`); }
              // Big phone photos are scaled to 3000 px on the long side: sharp in print, far smaller.
              const k = Math.min(1, 3000 / Math.max(image.width, image.height));
              const canvas = drawImage(image, image.width * k, image.height * k, '#ffffff');
              image.close();
              const jpg = await out.embedJpg(new Uint8Array(await (await encodeImage(canvas, 'jpeg', 0.88)).arrayBuffer()));
              const pxToPt = 0.75;
              if (size === 'fit') {
                out.addPage([canvas.width * pxToPt, canvas.height * pxToPt]).drawImage(jpg, { x: 0, y: 0, width: canvas.width * pxToPt, height: canvas.height * pxToPt });
              } else {
                const [w0, h0] = SIZES[size];
                const landscape = canvas.width > canvas.height;
                const [pw, ph] = landscape ? [h0, w0] : [w0, h0];
                const m = MARGINS[margin];
                const scale = Math.min((pw - 2 * m) / canvas.width, (ph - 2 * m) / canvas.height);
                const w = canvas.width * scale, h = canvas.height * scale;
                out.addPage([pw, ph]).drawImage(jpg, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
              }
              canvas.width = canvas.height = 0;
              report((i + 1) / n);
            }
            const bytes = await out.save({ useObjectStreams: true });
            return { blob: pdfBlob(bytes), name: `${baseName(list.items[0]!.file.name)}${n > 1 ? '-and-more' : ''}.pdf`, summary: `${n} page${n === 1 ? '' : 's'}.` };
          })} />
      )}
      {runner.output && <ResultCard {...runner.output} tool={tool.id} since={since} />}
    </ToolLayout>
  );
}
