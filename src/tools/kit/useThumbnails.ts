import { useEffect, useState } from 'react';
import { openForView, thumbnails } from '../../pdf/render';

/** Page previews for a loaded PDF, filled in one by one as they render. */
export function useThumbnails(bytes: Uint8Array | undefined, password?: string, width = 112) {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    if (!bytes) return;
    let alive = true;
    const made: string[] = [];
    void (async () => {
      try {
        const doc = await openForView(bytes, password);
        await thumbnails(doc, width, (index, url) => {
          made.push(url);
          if (alive) setUrls((list) => { const next = [...list]; next[index] = url; return next; });
          else URL.revokeObjectURL(url);
        });
        await doc.loadingTask.destroy();
      } catch {
        // Previews are optional: the tool still works without them.
      }
    })();
    return () => { alive = false; made.forEach((url) => URL.revokeObjectURL(url)); setUrls([]); };
  }, [bytes, password, width]);
  return urls;
}
