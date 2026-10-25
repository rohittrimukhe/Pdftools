/**
 * Files chosen on one screen and opened on the next (Smart Drop -> a tool).
 * Held in memory only, for this visit; a reload starts clean.
 */
let pending: File[] = [];
export const handOff = (files: File[]) => { pending = files; };
export function takeHandOff(): File[] {
  const files = pending;
  pending = [];
  return files;
}
export const peekHandOff = (): readonly File[] => pending;
