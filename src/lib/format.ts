const UNITS = ['B', 'KB', 'MB', 'GB'] as const;

/**
 * File sizes the way people read them on upload limits: 1 KB = 1024 bytes,
 * whole bytes, otherwise up to one decimal place ("48 KB", "1.4 MB").
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) throw new RangeError(`Invalid byte count: ${bytes}`);
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = unit === 0 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${UNITS[unit]}`;
}
