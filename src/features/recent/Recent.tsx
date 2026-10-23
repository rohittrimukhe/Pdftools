import { useCallback, useEffect, useState } from 'react';
import { Clock3, Download, Share2, Trash2 } from 'lucide-react';
import { LargeTitle, Page } from '../../app/shell/AppShell';
import { Link } from '../../app/router';
import { Button, IconButton, Sheet } from '../../design/ui';
import { useToast } from '../../design/toast';
import { FileIcon, iconKindForType } from '../../files/FileIcon';
import { RETAIN_DAYS, clearRecent, keepRecent, listRecent, onRecentChange, removeRecent, type RecentFile } from '../../files/recent';
import { formatBytes } from '../../lib/format';
import { canShare, saveFile, shareFile } from '../../platform/save';
import { findTool } from '../tools/catalog';
import './recent.css';

const when = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export function Recent() {
  const toast = useToast();
  const [files, setFiles] = useState<RecentFile[] | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const load = useCallback(() => {
    listRecent().then(setFiles).catch(() => setFiles([]));
  }, []);
  useEffect(() => { load(); return onRecentChange(load); }, [load]);

  const remove = async (file: RecentFile) => {
    await removeRecent(file.id);
    toast(`Removed ${file.name} from Recent`);
  };

  return (
    <Page narrow>
      <LargeTitle
        title="Recent"
        subtitle={keepRecent() ? `Files you made, kept on this device for ${RETAIN_DAYS} days.` : 'Keeping recent files is turned off in Settings.'}
      />
      {files === null ? null : files.length === 0 ? (
        <div className="hp-card empty-state">
          <span className="empty-state__icon"><Clock3 aria-hidden size={28} /></span>
          <p className="empty-state__title">Nothing here yet</p>
          <p className="empty-state__body">Files you make with Happy PDF appear here, kept only on this device.</p>
          <Link to="/" className="hp-btn hp-btn--tonal">Browse tools</Link>
        </div>
      ) : (
        <>
          <ul className="hp-group recent" aria-label="Recent files">
            {files.map((file) => (
              <li key={file.id} className="recent__item">
                <span className="hp-row__icon"><FileIcon kind={iconKindForType(file.type, file.name)} /></span>
                <span className="hp-row__body">
                  <span className="hp-row__title recent__name">{file.name}</span>
                  <span className="hp-row__sub">{findTool(file.tool)?.name ?? 'Happy PDF'} · {formatBytes(file.size)} · {when.format(file.createdAt)}</span>
                </span>
                <span className="recent__actions">
                  <IconButton label={`Save ${file.name}`} onClick={async () => { await saveFile(file.blob, file.name); toast(`Saved ${file.name}`); }}><Download aria-hidden size={20} /></IconButton>
                  {canShare(file.blob, file.name) && (
                    <IconButton label={`Share ${file.name}`} onClick={() => void shareFile(file.blob, file.name).catch(() => toast('Sharing didn’t work here. Use Save instead.'))}><Share2 aria-hidden size={20} /></IconButton>
                  )}
                  <IconButton label={`Remove ${file.name}`} onClick={() => void remove(file)}><Trash2 aria-hidden size={20} /></IconButton>
                </span>
              </li>
            ))}
          </ul>
          <div className="recent__footer">
            <Button variant="danger" onClick={() => setConfirmClear(true)}>Clear all</Button>
          </div>
        </>
      )}
      <Sheet
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title={`Remove all ${files?.length ?? 0} recent files?`}
        actions={<>
          <Button variant="text" onClick={() => setConfirmClear(false)}>Cancel</Button>
          <Button onClick={async () => { await clearRecent(); setConfirmClear(false); toast('Recent files cleared'); }}>Remove all</Button>
        </>}
      >
        <p className="recent__warn">They are removed from this device’s Recent list. Copies you already saved stay where you saved them.</p>
      </Sheet>
    </Page>
  );
}
