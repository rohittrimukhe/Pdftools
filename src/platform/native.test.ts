import { describe, expect, it } from 'vitest';
import { nextFreeName } from './native';

describe('nextFreeName', () => {
  it('keeps a name nobody has used', () => {
    expect(nextFreeName('a.pdf', new Set(['b.pdf']))).toBe('a.pdf');
  });
  it('numbers a repeat before the extension', () => {
    expect(nextFreeName('a.pdf', new Set(['a.pdf']))).toBe('a (2).pdf');
    expect(nextFreeName('a.pdf', new Set(['a.pdf', 'a (2).pdf']))).toBe('a (3).pdf');
  });
  it('handles names without an extension', () => {
    expect(nextFreeName('notes', new Set(['notes']))).toBe('notes (2)');
  });
});
