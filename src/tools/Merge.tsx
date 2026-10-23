import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, FilePlus2, FileType, X } from 'lucide-react';
import { Button, IconButton, Note } from '../design/ui';
import { pickFiles } from '../files/pick';
import { ResultCard } from '../files/ResultCard';
import { formatBytes } from '../lib/format';

import { uploadSnapshot } from '../privacy/uploadMonitor';
import type { Tool } from '../features/tools/catalog';
import { DropZone } from './kit/DropZone';
import { RunPanel } from './kit/parts';
import { ToolLayout } from './kit/ToolLayout';
import { pdfBlob, outputName } from './kit/output';
import { messageOf, takePdfHandOff } from './kit/usePdf';
import { useRunner } from './kit/useRunner';
import { loadEngine } from '../pdf/lazy';

interface Item { id: number; file: File; pages?: number; problem?: string }
let nextId = 1;

export default function Merge({ tool }: { tool: Tool }) {
  const [items, setItems] = useState<Item[]>([]);
  const [since] = useState(uploadSnapshot);
  const runner = useRunner();

  const add = (files: File[]) => {
    const added = files.map((file) => ({ id: nextId++, file }));
    setItems((list) => [...list, ...added]);
    runner.clear();
    for (const item of added) {
      void item.file.arrayBuffer().then(async (b) => (await loadEngine()).pageCount(new Uint8Array(b))).then(
        (pages) => setItems((list) => list.map((i) => (i.id === item.id ? { ...i, pages } : i))),
        (error) => setItems((list) => list.map((i) => (i.id === item.id ? { ...i, problem: messageOf(error) } : i))),
      );
    }
  };
  useEffect(() => { const files = takePdfHandOff(); if (files.length) add(files); }, []);

  const move = (index: number, by: number) => setItems((list) => {
    const next = [...list];
    const [item] = next.splice(index, 1);
    if (item) next.splice(index + by, 0, item);
    return next;
  });
  const ready = items.filter((i) => !i.problem);
  const totalPages = ready.reduce((n, i) => n + (i.pages ?? 0), 0);

  return (
    <ToolLayout tool={tool}>
      {items.length === 0 ? (
        <DropZone accept="application/pdf,.pdf" multiple title="Choose the PDFs to join" hint="Add two or more. You can change the order next." onFiles={add} />
      ) : (
        <>
          <ol className="hp-group merge-list" aria-label="Files to merge, in order">
            {items.map((item, index) => (
              <li key={item.id} className="file-head">
                <span className="hp-row__icon"><FileType aria-hidden size={22} /></span>
                <span className="file-head__body">
                  <span className="file-head__name">{index + 1}. {item.file.name}</span>
                  <span className="file-head__meta">{formatBytes(item.file.size)}{item.pages !== undefined ? ` · ${item.pages} page${item.pages === 1 ? '' : 's'}` : ''}</span>
                  {item.problem && <span className="file-head__meta" style={{ color: 'var(--hp-danger)' }}>{item.problem} It will be left out.</span>}
                </span>
                <IconButton label={`Move ${item.file.name} up`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp aria-hidden size={20} /></IconButton>
                <IconButton label={`Move ${item.file.name} down`} disabled={index === items.length - 1} onClick={() => move(index, 1)}><ArrowDown aria-hidden size={20} /></IconButton>
                <IconButton label={`Remove ${item.file.name}`} onClick={() => { setItems((l) => l.filter((i) => i.id !== item.id)); runner.clear(); }}><X aria-hidden size={20} /></IconButton>
              </li>
            ))}
          </ol>
          <Button variant="tonal" icon={<FilePlus2 aria-hidden size={18} />} onClick={async () => add(await pickFiles({ accept: 'application/pdf,.pdf' }))}>Add more PDFs</Button>
          {ready.length < 2 && <Note>Add at least two PDFs to merge.</Note>}
          {!runner.output && (
            <RunPanel
              label={`Merge ${ready.length} PDFs`}
              busyLabel="Merging"
              disabled={ready.length < 2 || ready.some((i) => i.pages === undefined)}
              busy={runner.busy}
              error={runner.error}
              onRun={() => runner.run(async () => {
                const bytes = await (await loadEngine()).mergePdfs(await Promise.all(ready.map(async (i) => new Uint8Array(await i.file.arrayBuffer()))));
                return { blob: pdfBlob(bytes), name: outputName(ready[0]!.file.name, 'merged'), summary: `${ready.length} files merged into ${totalPages} pages.` };
              })}
            />
          )}
          {runner.output && <ResultCard {...runner.output} tool={tool.id} since={since} />}
        </>
      )}
    </ToolLayout>
  );
}
