import { useEffect, useState } from 'react';
import { Copy, FileText, Trash2 } from 'lucide-react';
import { Button, Chip, IconButton, Note, Switch } from '../design/ui';
import { useToast } from '../design/toast';
import { ResultCard } from '../files/ResultCard';
import { FileIcon, iconKindForType } from '../files/FileIcon';
import { formatBytes } from '../lib/format';
import { baseName, saveFile } from '../platform/save';
import { uploadSnapshot } from '../privacy/uploadMonitor';
import { takeHandOff } from '../files/handoff';
import type { Tool } from '../features/tools/catalog';
import { LANGUAGES, type OcrLanguage } from '../ocr/engine';
import { IMAGE_ACCEPT } from '../images/codec';
import { ToolLayout } from './kit/ToolLayout';
import './ocr.css';
import { DropZone } from './kit/DropZone';
import { RunPanel } from './kit/parts';
import { pdfBlob } from './kit/output';
import { useRunner } from './kit/useRunner';
import { pickFiles } from '../files/pick';

const loadOcr = () => Promise.all([import('../ocr/engine'), import('../ocr/pages'), import('../ocr/searchable')]);
const ACCEPT = `application/pdf,.pdf,${IMAGE_ACCEPT}`;

const defaultLanguages = (): OcrLanguage[] => (typeof navigator !== 'undefined' && navigator.language?.startsWith('hi') ? ['hin', 'eng'] : ['eng']);

interface Read { text: string; lowConfidence: string[] }

export default function Ocr({ tool }: { tool: Tool }) {
  const [files, setFiles] = useState<File[]>(takeHandOff);
  const [languages, setLanguages] = useState<OcrLanguage[]>(defaultLanguages);
  const [searchable, setSearchable] = useState(false);
  const [read, setRead] = useState<Read | null>(null);
  const [since] = useState(uploadSnapshot);
  const runner = useRunner();
  const toast = useToast();

  // The engine holds about 100 MB while warm; let it go when leaving the screen.
  useEffect(() => () => { void import('../ocr/engine').then((m) => m.stopOcr()); }, []);

  const reset = () => { runner.clear(); setRead(null); };
  const toggle = (id: OcrLanguage) => {
    setLanguages((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
    reset();
  };

  if (!files.length) {
    return (
      <ToolLayout tool={tool}>
        <DropZone accept={ACCEPT} multiple title="Choose scans, photos or PDFs" hint="Reads English and Hindi. Works offline once used." onFiles={(f) => { setFiles(f); reset(); }} />
      </ToolLayout>
    );
  }

  const name = files.length === 1 ? baseName(files[0]!.name) : 'scans';
  return (
    <ToolLayout tool={tool}>
      <ul className="hp-group ocr-files" aria-label="Files to read">
        {files.map((f, i) => (
          <li key={`${f.name}-${i}`} className="file-head">
            <span className="hp-row__icon"><FileIcon kind={iconKindForType(f.type, f.name)} /></span>
            <span className="file-head__body"><span className="file-head__name">{f.name}</span><span className="file-head__meta">{formatBytes(f.size)}</span></span>
            <IconButton label={`Remove ${f.name}`} onClick={() => { setFiles(files.filter((_, j) => j !== i)); reset(); }}><Trash2 aria-hidden size={20} /></IconButton>
          </li>
        ))}
      </ul>
      <Button variant="tonal" onClick={async () => { const more = await pickFiles({ accept: ACCEPT, multiple: true }); if (more.length) { setFiles([...files, ...more]); reset(); } }}>Add more files</Button>

      <div className="hp-card options">
        <div>
          <span className="options__label" id="ocr-lang">Language of the text</span>
          <div className="options__chips" role="group" aria-labelledby="ocr-lang">
            {LANGUAGES.map((l) => <Chip key={l.id} selected={languages.includes(l.id)} onClick={() => toggle(l.id)}>{l.name}</Chip>)}
          </div>
          <p className="options__hint">{languages.length > 1 ? 'Both: for pages that mix languages. A little slower.' : 'Choose both if pages mix English and Hindi.'}</p>
        </div>
        <div className="ocr-switch">
          <span>
            <span className="options__label">Also make a searchable PDF</span>
            <span className="options__hint">{searchable ? 'Each page keeps its picture, with invisible text on top that you can search, select and copy.' : 'Text only. Turn on to also get a PDF you can search.'}</span>
          </span>
          <Switch checked={searchable} onChange={(v) => { setSearchable(v); reset(); }} label="Also make a searchable PDF" />
        </div>
      </div>

      {!read && (
        <RunPanel label="Read text" busyLabel="Reading text" busy={runner.busy} progress={runner.progress} error={runner.error} disabled={!languages.length}
          onRun={() => runner.run(async (report) => {
            const [{ recognize }, { pageImages, countPages }, { searchablePdf }] = await loadOcr();
            const total = await countPages(files);
            const texts: string[] = [];
            const pages: Array<{ jpeg: Uint8Array; points: [number, number]; textLayer?: Uint8Array }> = [];
            const low: string[] = [];
            let done = 0;
            for await (const page of pageImages(files)) {
              const result = await recognize(page.image, languages, { textLayer: searchable, onProgress: (p) => report((done + p) / total) });
              texts.push(total > 1 ? `— ${page.label} —\n${result.text}` : result.text);
              if (searchable) pages.push({ jpeg: new Uint8Array(await page.image.arrayBuffer()), points: page.points, textLayer: result.textLayer });
              if (result.confidence < 60 && result.text) low.push(page.label);
              done++;
              report(done / total);
            }
            const text = texts.join('\n\n').trim();
            setRead({ text, lowConfidence: low });
            const words = text.split(/\s+/).filter(Boolean).length;
            const summary = `${words} word${words === 1 ? '' : 's'} from ${total} page${total === 1 ? '' : 's'}.`;
            if (searchable) {
              return { blob: pdfBlob(await searchablePdf(pages, name)), name: `${name}-searchable.pdf`, summary: `${summary} Searchable PDF ready.` };
            }
            return { blob: new Blob([text], { type: 'text/plain;charset=utf-8' }), name: `${name}-text.txt`, summary };
          })} />
      )}

      {read && (
        <section className="hp-card options" aria-labelledby="ocr-text-title">
          <h2 id="ocr-text-title" className="tool-card__title">Text found</h2>
          {!read.text && <Note tone="warn">No text was found. Check the language, or use a sharper, straighter photo.</Note>}
          {read.lowConfidence.length > 0 && <Note tone="warn">Some words may be wrong on {read.lowConfidence.join(', ')}: the picture is blurry, small or tilted.</Note>}
          {read.text && (
            <>
              <label className="hp-sr-only" htmlFor="ocr-text">Recognised text (you can edit it)</label>
              <textarea id="ocr-text" className="hp-input ocr-text" rows={12} value={read.text} onChange={(e) => setRead({ ...read, text: e.target.value })} lang={languages.includes('hin') ? 'hi' : 'en'} />
              <div className="tool-actions">
                <Button variant="tonal" icon={<Copy aria-hidden size={18} />} onClick={async () => {
                  try { await navigator.clipboard.writeText(read.text); toast('Text copied'); } catch { toast('Copying isn’t allowed here. Select the text and copy it.'); }
                }}>Copy text</Button>
                {searchable && <Button variant="text" icon={<FileText aria-hidden size={18} />} onClick={() => void saveFile(new Blob([read.text], { type: 'text/plain;charset=utf-8' }), `${name}-text.txt`)}>Save as text file</Button>}
              </div>
            </>
          )}
        </section>
      )}
      {runner.output && <ResultCard {...runner.output} tool={tool.id} since={since} />}
    </ToolLayout>
  );
}
