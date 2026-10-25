import { File, FileImage, FileSpreadsheet, FileText, FileType, Presentation } from 'lucide-react';
import type { FileKind } from './detect';

const ICONS = { pdf: FileType, image: FileImage, svg: FileImage, word: FileText, excel: FileSpreadsheet, powerpoint: Presentation, unknown: File } as const;

export function FileIcon({ kind, size = 22 }: { kind: FileKind; size?: number }) {
  const Icon = ICONS[kind];
  return <Icon aria-hidden size={size} />;
}

export function iconKindForType(type: string, name: string): FileKind {
  if (type === 'application/pdf' || /\.pdf$/i.test(name)) return 'pdf';
  if (type === 'image/svg+xml') return 'svg';
  if (type.startsWith('image/')) return 'image';
  if (/\.docx$/i.test(name)) return 'word';
  if (/\.xlsx$/i.test(name)) return 'excel';
  if (/\.pptx$/i.test(name)) return 'powerpoint';
  return 'unknown';
}
