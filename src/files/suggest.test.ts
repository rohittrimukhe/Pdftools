import { describe, expect, it } from 'vitest';
import { suggestTools } from './suggest';
import { findTool } from '../features/tools/catalog';

describe('suggestTools', () => {
  it('offers merge first for several PDFs and compress first for one', () => {
    expect(suggestTools(['pdf', 'pdf'])[0]).toBe('merge');
    expect(suggestTools(['pdf'])[0]).toBe('compress');
  });
  it('offers image tools for photos and the right converter for Office files', () => {
    expect(suggestTools(['image'])[0]).toBe('image-to-pdf');
    expect(suggestTools(['word'])).toEqual(['word-to-pdf']);
    expect(suggestTools(['powerpoint'])).toEqual(['ppt-to-pdf']);
  });
  it('offers nothing for unknown files and only ids that exist', () => {
    expect(suggestTools(['unknown'])).toEqual([]);
    for (const id of suggestTools(['pdf', 'image', 'word', 'excel', 'powerpoint', 'svg'])) expect(findTool(id), id).toBeDefined();
  });
});
