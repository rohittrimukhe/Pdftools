import type { FileKind } from './detect';

/** What a dropped file can become, best first. Ids are tool ids from the catalogue. */
export function suggestTools(kinds: FileKind[]): string[] {
  const set = new Set(kinds);
  const many = kinds.length > 1;
  const out: string[] = [];
  const add = (...ids: string[]) => ids.forEach((id) => { if (!out.includes(id)) out.push(id); });
  if (set.has('pdf')) {
    if (many) add('merge');
    add('compress', 'exact-size', 'organise', 'split', 'extract', 'sign', 'watermark', 'page-numbers', 'protect', 'unlock', 'pdf-to-image', 'pdf-to-word', 'ocr');
  }
  if (set.has('image')) add('image-to-pdf', 'scan', 'ocr', 'exact-size', 'resize-image', 'convert-image');
  if (set.has('svg')) add('image-to-pdf', 'convert-image', 'resize-image');
  if (set.has('word')) add('word-to-pdf');
  if (set.has('excel')) add('excel-to-pdf');
  if (set.has('powerpoint')) add('ppt-to-pdf');
  if (set.has('pdf') && (set.has('image') || set.has('svg'))) out.unshift('merge');
  return [...new Set(out)];
}
