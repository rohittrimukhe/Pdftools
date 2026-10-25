import { describe, expect, it } from 'vitest';
import { baseName, safeFileName, savedMessage } from './save';

describe('file names', () => {
  it('adds the extension only when missing, in any case', () => {
    expect(safeFileName('report', 'pdf')).toBe('report.pdf');
    expect(safeFileName('Report.PDF', '.pdf')).toBe('Report.PDF');
  });
  it('replaces characters no file system accepts and never returns an empty name', () => {
    expect(safeFileName('a/b:c*?', 'pdf')).toBe('a-b-c-.pdf');
    expect(safeFileName('   ', 'pdf')).toBe('document.pdf');
    expect(safeFileName('...hidden', 'pdf')).toBe('hidden.pdf');
  });
  it('strips the last extension only', () => {
    expect(baseName('my.scan.pdf')).toBe('my.scan');
    expect(baseName('noext')).toBe('noext');
  });
});

describe('savedMessage', () => {
  it('names the file and, when known, where it went', () => {
    expect(savedMessage({ status: 'saved' }, 'a.pdf')).toBe('Saved a.pdf');
    expect(savedMessage({ status: 'saved', where: 'Documents/Happy PDF' }, 'a.pdf')).toBe('Saved a.pdf to Documents/Happy PDF');
  });
  it('stays quiet when the save dialog was cancelled', () => {
    expect(savedMessage({ status: 'cancelled' }, 'a.pdf')).toBeNull();
  });
});
