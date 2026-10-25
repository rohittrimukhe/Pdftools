import { loadRender } from '../pdf/lazy';

/** The text of a PDF, line by line, the way an ATS reads it. Empty for a scanned (image-only) PDF. */
export async function pdfText(bytes: Uint8Array, password?: string): Promise<{ text: string; pages: number }> {
  const { openForView } = await loadRender();
  const doc = await openForView(bytes, password);
  try {
    const out: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const content = await (await doc.getPage(i)).getTextContent();
      let line = '';
      for (const item of content.items) {
        if (!('str' in item)) continue;
        line += item.str;
        if (item.hasEOL) { out.push(line); line = ''; }
      }
      if (line) out.push(line);
    }
    return { text: out.map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n'), pages: doc.numPages };
  } finally {
    void doc.loadingTask.destroy();
  }
}
