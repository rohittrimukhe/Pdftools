import { zipSync } from 'fflate';
import { baseName } from '../../platform/save';

export const pdfBlob = (bytes: Uint8Array) => new Blob([bytes as BlobPart], { type: 'application/pdf' });

/** Several files become one ZIP, so they save in one tap. */
export function zipBlob(files: Array<{ name: string; bytes: Uint8Array }>): Blob {
  const entries: Record<string, Uint8Array> = {};
  for (const { name, bytes } of files) {
    let unique = name;
    for (let n = 2; unique in entries; n++) unique = name.replace(/(\.[^.]+)?$/, ` (${n})$1`);
    entries[unique] = bytes;
  }
  return new Blob([zipSync(entries, { level: 0 }) as BlobPart], { type: 'application/zip' });
}

/** "invoice.pdf" + "compressed" -> "invoice-compressed.pdf" */
export const outputName = (input: string, suffix: string, ext = '.pdf') => `${baseName(input)}-${suffix}${ext}`;
