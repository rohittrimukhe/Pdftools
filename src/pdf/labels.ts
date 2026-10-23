export type NumberPosition = 'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-center' | 'top-right' | 'top-left';
export type NumberStyle = 'n' | 'page-n' | 'n-of-total';

export function pageLabel(style: NumberStyle, n: number, total: number): string {
  if (style === 'page-n') return `Page ${n}`;
  if (style === 'n-of-total') return `${n} of ${total}`;
  return String(n);
}
