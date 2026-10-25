# Step 12 — Office files

**Date:** 2026-10-25  **Result:** done; every tool in the catalogue is now built

## What was built
- **Word to PDF** (`/tools/word-to-pdf`)
  - mammoth (BSD-2) reads the document's structure; our own layout engine writes a real text PDF.
  - Kept: headings, bold, italic and underline, bullet and numbered lists, tables (full width, like Word), pictures and page breaks.
  - A4 or US Letter.
- **Excel to PDF** (`/tools/excel-to-pdf`)
  - Our own XLSX reader, with no spreadsheet library to download.
  - Each visible sheet becomes a table on its own pages, with values as Excel shows them: saved formula results, decimals, thousands separators, percentages and dates.
  - Bold header rows are kept and repeat on every page; numbers are right-aligned.
  - Orientation: automatic (sideways for wide sheets), portrait or landscape.
- **PowerPoint to PDF** (`/tools/ppt-to-pdf`)
  - Our own PPTX reader: one page per slide, at the slide's size.
  - Placeholders inherit their position, text size, bullets and alignment from the slide layout and master.
  - Also drawn: text boxes, filled shapes, pictures, grouped shapes, simple tables and solid backgrounds.
- **PDF to Word** (`/tools/pdf-to-word`)
  - The text of each page in reading order, grouped into paragraphs; larger text becomes Heading 1–3; page breaks are kept.
  - Written by our own small DOCX writer; opens in Word, Google Docs, LibreOffice and Pages.
  - A scanned PDF is sent to OCR first, with a clear message.
- **Clear about limits:** each screen says what is simplified, and the result lists anything left out (unsupported pictures, characters the standard fonts can't show).
- **Wrong files are explained:** an old `.doc`/`.xls`/`.ppt`, or a workbook given to Word to PDF.
- **Smart Drop** suggests the right tool for Word, Excel and PowerPoint files.

## Checks
| Check | Result |
|---|---|
| Unit tests | 100 of 100 passed (12 new: XML reader, Excel number formats, workbook reading, Word structure, PowerPoint slides, PDF-to-Word grouping, DOCX writer read back by mammoth, table widths) |
| Browser tests | 172 of 172 passed, phone and desktop (14 new) |
| Test files | Real Office files made with python-docx, openpyxl and python-pptx; formula results filled in by LibreOffice (`scripts/make-office-fixtures.py`) |
| Compared with LibreOffice's own PDF export | `compare-*-ours-vs-libreoffice.png` (ours on the left): same content, order and structure; fonts differ |
| Accessibility | Office screens pass the WCAG 2.1 AA scan |
| Desktop app type check | Still passes with the new files (mammoth included) |

## Bugs found and fixed
1. **Numbers wrapped inside Excel cells** ("49.5" then "0" on the next line). A column sized exactly to its widest number came out a hair narrower through floating-point rounding. Line fitting now allows 0.01 pt of tolerance, columns get 1 pt of breathing room, and a unit test covers it.
2. **Word page breaks were lost.** mammoth places a page break inside an empty paragraph; it now becomes a page break.
3. **Friendly messages were hidden.** Errors written for people ("probably a scan, use OCR first", "isn't an Excel workbook") showed as "Something went wrong". Such errors now have their own type, and their message is shown as written.

## Known limits (stated on the screens)
- Standard PDF fonts: text in scripts other than Latin (for example Hindi) inside Office files shows as "?" and is listed. Embedding a Unicode font is planned.
- Not drawn: charts, SmartArt, gradients and effects. Exact Word spacing and fonts are simplified.
