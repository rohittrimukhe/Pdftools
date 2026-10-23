import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { detectKind } from './detect';

const bytes = (...values: number[]) => new Uint8Array([...values, ...new Array(32).fill(0)]);
const ascii = (text: string) => new TextEncoder().encode(text);
const office = (part: string) => zipSync({ '[Content_Types].xml': strToU8('<Types/>'), [part]: strToU8('<x/>') });

describe('detectKind', () => {
  it('recognises PDFs, including a header after leading junk', () => {
    expect(detectKind(ascii('%PDF-1.7\n...'))).toBe('pdf');
    expect(detectKind(ascii('\r\n\r\n%PDF-1.4'))).toBe('pdf');
  });

  it('recognises raster images by signature, whatever the name says', () => {
    expect(detectKind(bytes(0xff, 0xd8, 0xff, 0xe0), 'photo.pdf')).toBe('image');
    expect(detectKind(bytes(0x89, 0x50, 0x4e, 0x47))).toBe('image');
    expect(detectKind(ascii('GIF89a'))).toBe('image');
    expect(detectKind(ascii('RIFF\0\0\0\0WEBPVP8 '))).toBe('image');
    expect(detectKind(ascii('\0\0\0\x18ftypheic\0\0\0\0'))).toBe('image');
  });

  it('recognises SVG text, with or without an XML prolog', () => {
    expect(detectKind(ascii('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBe('svg');
    expect(detectKind(ascii('<?xml version="1.0"?>\n<!-- logo -->\n<svg viewBox="0 0 1 1"/>'))).toBe('svg');
  });

  it('tells Word, Excel and PowerPoint apart by their parts', () => {
    expect(detectKind(office('word/document.xml'), 'a.zip')).toBe('word');
    expect(detectKind(office('xl/workbook.xml'))).toBe('excel');
    expect(detectKind(office('ppt/presentation.xml'))).toBe('powerpoint');
  });

  it('calls anything else unknown', () => {
    expect(detectKind(ascii('hello world'), 'notes.txt')).toBe('unknown');
    expect(detectKind(new Uint8Array(0))).toBe('unknown');
    expect(detectKind(zipSync({ 'a.txt': strToU8('a') }), 'archive.zip')).toBe('unknown');
  });
});
