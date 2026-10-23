export type FileKind = 'pdf' | 'image' | 'svg' | 'word' | 'excel' | 'powerpoint' | 'unknown';

export const KIND_LABEL: Record<FileKind, string> = {
  pdf: 'PDF', image: 'Image', svg: 'SVG image', word: 'Word document', excel: 'Excel spreadsheet', powerpoint: 'PowerPoint deck', unknown: 'Other file',
};

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) => signature.every((b, i) => bytes[offset + i] === b);

/**
 * "%PDF-" as bytes. Never write it as text in app code: the desktop shell guesses
 * a file's type from its first kilobyte and would serve that script as a PDF.
 */
export const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d];

function containsAscii(bytes: Uint8Array, text: string | number[]): boolean {
  const needle = typeof text === 'string' ? Array.from(text, (c) => c.charCodeAt(0)) : text;
  outer: for (let i = 0; i <= bytes.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) if (bytes[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
}

/**
 * What a file really is, from its first bytes rather than its name: a renamed
 * file is still recognised, and a wrong extension cannot send it to the wrong tool.
 * `head` should be at least the first 4 KB; for Office files the whole file is
 * best, since the part names live in the zip's central directory at the end.
 */
export function detectKind(head: Uint8Array, name = ''): FileKind {
  const lower = name.toLowerCase();
  // PDF: the header may follow up to 1 KB of junk, which readers tolerate.
  if (containsAscii(head.subarray(0, 1024), PDF_MAGIC)) return 'pdf';
  if (startsWith(head, [0xff, 0xd8, 0xff])) return 'image'; // JPEG
  if (startsWith(head, [0x89, 0x50, 0x4e, 0x47])) return 'image'; // PNG
  if (startsWith(head, [0x47, 0x49, 0x46, 0x38])) return 'image'; // GIF
  if (startsWith(head, [0x52, 0x49, 0x46, 0x46]) && startsWith(head, [0x57, 0x45, 0x42, 0x50], 8)) return 'image'; // WebP
  if (startsWith(head, [0x42, 0x4d])) return 'image'; // BMP
  if (startsWith(head, [0x66, 0x74, 0x79, 0x70], 4) && /^(heic|heix|hevc|mif1|msf1|avif)/.test(String.fromCharCode(...head.subarray(8, 12)))) return 'image'; // HEIC/AVIF
  if (startsWith(head, [0x50, 0x4b, 0x03, 0x04])) {
    if (containsAscii(head, 'word/')) return 'word';
    if (containsAscii(head, 'xl/')) return 'excel';
    if (containsAscii(head, 'ppt/')) return 'powerpoint';
    if (lower.endsWith('.docx')) return 'word';
    if (lower.endsWith('.xlsx')) return 'excel';
    if (lower.endsWith('.pptx')) return 'powerpoint';
    return 'unknown';
  }
  const text = new TextDecoder().decode(head.subarray(0, 1024)).trimStart();
  if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE svg[^>]*>\s*)?<svg[\s>]/i.test(text)) return 'svg';
  return 'unknown';
}

/** Reads enough of a file to detect it: all of a small Office zip, otherwise the first 64 KB. */
export async function detectFile(file: Blob & { name?: string }): Promise<FileKind> {
  const name = file.name ?? '';
  const whole = /\.(docx|xlsx|pptx)$/i.test(name) && file.size <= 20 * 1024 * 1024;
  const slice = whole ? file : file.slice(0, 64 * 1024);
  return detectKind(new Uint8Array(await slice.arrayBuffer()), name);
}
