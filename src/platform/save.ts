/**
 * Getting a finished file off the page. On the web this is a download or the
 * system share sheet; the Android, iOS and desktop apps plug in their own
 * native save in step 9 through `setSaveAdapter`.
 */
export interface SaveAdapter {
  save(blob: Blob, name: string): Promise<void>;
  share?(blob: Blob, name: string): Promise<'shared' | 'cancelled'>;
}

const webAdapter: SaveAdapter = {
  async save(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.rel = 'noopener';
    document.body.append(a);
    a.click();
    a.remove();
    // Some browsers read the URL after click returns; give them a moment before releasing it.
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  },
  async share(blob, name) {
    const file = new File([blob], name, { type: blob.type });
    try {
      await navigator.share({ files: [file], title: name });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      throw error;
    }
  },
};

let adapter: SaveAdapter = webAdapter;
export const setSaveAdapter = (next: SaveAdapter) => { adapter = next; };

export const saveFile = (blob: Blob, name: string) => adapter.save(blob, name);

export function canShare(blob: Blob, name: string): boolean {
  if (adapter !== webAdapter) return Boolean(adapter.share);
  if (typeof navigator === 'undefined' || !navigator.canShare) return false;
  try { return navigator.canShare({ files: [new File([blob], name, { type: blob.type })] }); } catch { return false; }
}

export async function shareFile(blob: Blob, name: string) {
  if (!adapter.share) throw new Error('Sharing is not available here');
  return adapter.share(blob, name);
}

/** "Report.PDF" + ".pdf" stays as is; "report" gets the extension; illegal characters become "-". */
export function safeFileName(name: string, extension: string): string {
  const ext = extension.startsWith('.') ? extension : `.${extension}`;
  const cleaned = name.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-').replace(/\s+/g, ' ').trim().replace(/^\.+/, '') || 'document';
  return cleaned.toLowerCase().endsWith(ext.toLowerCase()) ? cleaned : `${cleaned}${ext}`;
}

/** "invoice.pdf" -> "invoice" */
export const baseName = (name: string) => name.replace(/\.[^.]+$/, '') || name;
