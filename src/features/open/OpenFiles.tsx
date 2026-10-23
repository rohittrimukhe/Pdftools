import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, FilePlus2 } from 'lucide-react';
import { Page, TopBar } from '../../app/shell/AppShell';
import { navigate } from '../../app/router';
import { Button, Note } from '../../design/ui';
import { detectFile, KIND_LABEL, type FileKind } from '../../files/detect';
import { FileIcon } from '../../files/FileIcon';
import { handOff, takeHandOff } from '../../files/handoff';
import { pickFiles } from '../../files/pick';
import { suggestTools } from '../../files/suggest';
import { formatBytes } from '../../lib/format';
import { uploadSnapshot } from '../../privacy/uploadMonitor';
import { UploadBadge } from '../../privacy/UploadBadge';
import { findTool, isReady, toolPath } from '../tools/catalog';
import './open.css';

interface Opened { file: File; kind: FileKind }

/** Suggestions shown before "Show all": enough to cover what most people came for. */
const TOP = 6;

/** Smart Drop's result: what the files are, and what you can do with them. */
export function OpenFiles() {
  const [items, setItems] = useState<Opened[] | null>(null);
  const [since] = useState(uploadSnapshot);
  const [showAll, setShowAll] = useState(false);

  const add = async (files: File[]) => {
    const detected = await Promise.all(files.map(async (file) => ({ file, kind: await detectFile(file) })));
    setItems((current) => [...(current ?? []), ...detected]);
  };

  useEffect(() => {
    const files = takeHandOff();
    if (files.length === 0) setItems([]);
    else void add(files);
  }, []);

  const suggestions = useMemo(
    () => suggestTools((items ?? []).map((item) => item.kind)).map(findTool).filter((t) => t !== undefined),
    [items],
  );

  const open = (path: string) => {
    handOff((items ?? []).map((item) => item.file));
    navigate(path);
  };

  if (items === null) return <Page narrow><TopBar title="Your files" /></Page>;

  return (
    <Page narrow>
      <TopBar title="Your files" />
      <div className="open__badge"><UploadBadge since={since} /><span>Read on your device only</span></div>

      {items.length === 0 ? (
        <div className="hp-card empty-state">
          <p className="empty-state__title">No files open</p>
          <p className="empty-state__body">Choose files to see what Happy PDF can do with them.</p>
          <Button onClick={async () => add(await pickFiles())}>Choose files</Button>
        </div>
      ) : (
        <>
          <ul className="hp-group open__files" aria-label="Opened files">
            {items.map(({ file, kind }, index) => (
              <li key={`${file.name}-${index}`} className="open__file">
                <span className="hp-row__icon"><FileIcon kind={kind} /></span>
                <span className="hp-row__body">
                  <span className="hp-row__title open__name">{file.name || 'Pasted file'}</span>
                  <span className="hp-row__sub">{KIND_LABEL[kind]} · {formatBytes(file.size)}</span>
                </span>
              </li>
            ))}
          </ul>
          <Button variant="text" icon={<FilePlus2 aria-hidden size={18} />} onClick={async () => add(await pickFiles())}>Add more files</Button>

          <h2 className="hp-group__title">What you can do</h2>
          {suggestions.length === 0 ? (
            <Note>Happy PDF doesn’t have a tool for this kind of file yet. It works with PDFs, images, and Word, Excel and PowerPoint files.</Note>
          ) : (
            <ul className="hp-group open__actions">
              {(showAll ? suggestions : suggestions.slice(0, TOP)).map((tool) => (
                <li key={tool.id}>
                  <button type="button" className="hp-row" onClick={() => open(toolPath(tool))}>
                    <span className="hp-row__icon"><tool.icon aria-hidden size={22} /></span>
                    <span className="hp-row__body">
                      <span className="hp-row__title">{tool.name}{!isReady(tool) && <span className="hp-badge open__soon">Soon</span>}</span>
                      <span className="hp-row__sub">{tool.blurb}</span>
                    </span>
                    <ChevronRight aria-hidden className="hp-row__end" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!showAll && suggestions.length > TOP && (
            <Button variant="text" onClick={() => setShowAll(true)}>Show all {suggestions.length} tools</Button>
          )}
        </>
      )}
    </Page>
  );
}
