import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from '@cantoo/pdf-lib';
import { dateRange, isBlank, lines, skillList, type Entry, type Paper, type Resume, type TemplateId } from './model';

/**
 * Draws a resume as a real text PDF: one column, standard fonts, no tables or
 * images, so applicant tracking systems read every word in order.
 */

export const PAPER: Record<Paper, readonly [number, number]> = { a4: [595.28, 841.89], letter: [612, 792] };

interface Style {
  fonts: { regular: StandardFonts; bold: StandardFonts; italic: StandardFonts };
  margin: number;
  name: number;
  headline: number;
  contact: number;
  heading: number;
  body: number;
  leading: number;
  gap: number;
  center: boolean;
  accent: RGB;
}

const INK = rgb(0.1, 0.1, 0.1);
const MUTED = rgb(0.33, 0.33, 0.33);

const STYLES: Record<TemplateId, Style> = {
  classic: {
    fonts: { regular: StandardFonts.TimesRoman, bold: StandardFonts.TimesRomanBold, italic: StandardFonts.TimesRomanItalic },
    margin: 54, name: 20, headline: 11.5, contact: 10, heading: 11.5, body: 10.5, leading: 1.25, gap: 10, center: true, accent: INK,
  },
  modern: {
    fonts: { regular: StandardFonts.Helvetica, bold: StandardFonts.HelveticaBold, italic: StandardFonts.HelveticaOblique },
    margin: 50, name: 22, headline: 11.5, contact: 9.5, heading: 10.5, body: 10, leading: 1.3, gap: 10, center: false, accent: rgb(0.62, 0.34, 0),
  },
  compact: {
    fonts: { regular: StandardFonts.Helvetica, bold: StandardFonts.HelveticaBold, italic: StandardFonts.HelveticaOblique },
    margin: 40, name: 16, headline: 10, contact: 8.5, heading: 9.5, body: 9, leading: 1.22, gap: 6, center: false, accent: rgb(0.2, 0.2, 0.2),
  },
};

/** Characters the standard PDF fonts can't draw, swapped for close equivalents. */
const SWAPS: Record<string, string> = { '₹': 'Rs.', '→': '->', '←': '<-', '✓': '-', '✔': '-', '★': '*', '·': '·', ' ': ' ', ' ': ' ', '​': '', '\t': ' ' };

/** Makes text drawable with a standard font. Returns what couldn't be kept, so the screen can say so. */
export function drawable(text: string, supported: ReadonlySet<number>): { text: string; dropped: string[] } {
  const dropped = new Set<string>();
  let out = '';
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (supported.has(cp)) { out += ch; continue; }
    const swap = SWAPS[ch];
    if (swap !== undefined) { out += swap; continue; }
    // Letters with accents the font lacks: keep the base letter (ő -> o).
    const base = ch.normalize('NFKD').replace(/[̀-ͯ]/g, '');
    if (base && [...base].every((c) => supported.has(c.codePointAt(0)!))) { out += base; continue; }
    dropped.add(ch);
    out += '?';
  }
  return { text: out, dropped: [...dropped] };
}

export interface RenderResult { bytes: Uint8Array; pages: number; dropped: string[] }

export async function renderResume(resume: Resume): Promise<RenderResult> {
  const style = STYLES[resume.template];
  const doc = await PDFDocument.create();
  const [regular, bold, italic] = await Promise.all([doc.embedFont(style.fonts.regular), doc.embedFont(style.fonts.bold), doc.embedFont(style.fonts.italic)]);
  const supported = new Set(regular.getCharacterSet());
  const dropped = new Set<string>();
  const clean = (t: string) => {
    const r = drawable(t, supported);
    r.dropped.forEach((d) => dropped.add(d));
    return r.text;
  };

  const [width, height] = PAPER[resume.paper];
  const left = style.margin;
  const right = width - style.margin;
  const contentWidth = right - left;
  let page: PDFPage = doc.addPage([width, height]);
  let y = height - style.margin;

  const ensure = (needed: number) => {
    if (y - needed >= style.margin) return;
    page = doc.addPage([width, height]);
    y = height - style.margin;
  };

  const wrap = (text: string, font: PDFFont, size: number, maxWidth: number): string[] => {
    const out: string[] = [];
    for (const para of text.split('\n')) {
      let line = '';
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const candidate = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) <= maxWidth) { line = candidate; continue; }
        if (line) out.push(line);
        // A single word wider than the line (a long URL): break it by characters.
        let rest = word;
        while (font.widthOfTextAtSize(rest, size) > maxWidth) {
          let cut = rest.length - 1;
          while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > maxWidth) cut--;
          out.push(rest.slice(0, cut));
          rest = rest.slice(cut);
        }
        line = rest;
      }
      if (line) out.push(line);
    }
    return out;
  };

  const text = (t: string, opts: { font: PDFFont; size: number; x?: number; color?: RGB; align?: 'left' | 'center' | 'right' }) => {
    const w = opts.font.widthOfTextAtSize(t, opts.size);
    const x = opts.align === 'center' ? left + (contentWidth - w) / 2 : opts.align === 'right' ? right - w : (opts.x ?? left);
    page.drawText(t, { x, y, size: opts.size, font: opts.font, color: opts.color ?? INK });
  };

  const paragraph = (t: string, font: PDFFont, size: number, { indent = 0, color = INK, align = 'left' as 'left' | 'center' } = {}) => {
    for (const l of wrap(clean(t), font, size, contentWidth - indent)) {
      ensure(size * style.leading);
      y -= size;
      text(l, { font, size, x: left + indent, color, align });
      y -= size * (style.leading - 1);
    }
  };

  const bullet = (t: string) => {
    const size = style.body;
    const indent = size * 1.1;
    const wrapped = wrap(clean(t), regular, size, contentWidth - indent);
    wrapped.forEach((l, i) => {
      ensure(size * style.leading);
      y -= size;
      if (i === 0) text('•', { font: regular, size, x: left + size * 0.15 });
      text(l, { font: regular, size, x: left + indent });
      y -= size * (style.leading - 1);
    });
  };

  const heading = (label: string) => {
    // Keep a heading with at least two lines of what follows.
    ensure(style.heading * 1.6 + style.body * style.leading * 2);
    y -= style.gap;
    y -= style.heading;
    text(label.toUpperCase(), { font: bold, size: style.heading, color: style.accent, align: style.center ? 'center' : 'left' });
    y -= style.heading * 0.35;
    page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 0.6, color: style.accent });
    y -= style.heading * 0.55;
  };

  const entry = (e: Entry) => {
    const size = style.body;
    ensure(size * style.leading * 3);
    const dates = clean(dateRange(e.start, e.end));
    const datesWidth = dates ? regular.widthOfTextAtSize(dates, size) + 12 : 0;
    const titleLines = wrap(clean(e.title.trim() || e.org.trim()), bold, size, contentWidth - datesWidth);
    titleLines.forEach((l, i) => {
      y -= size;
      text(l, { font: bold, size });
      if (i === 0 && dates) text(dates, { font: regular, size, align: 'right' });
      y -= size * (style.leading - 1);
    });
    const sub = [e.title.trim() ? e.org.trim() : '', e.location.trim()].filter(Boolean).join(' · ');
    if (sub) paragraph(sub, italic, size, { color: MUTED });
    lines(e.bullets).forEach(bullet);
    y -= style.gap * 0.5;
  };

  // Header
  if (resume.name.trim()) {
    y -= style.name;
    text(clean(resume.name.trim()), { font: bold, size: style.name, align: style.center ? 'center' : 'left' });
    y -= style.name * 0.3;
  }
  if (resume.headline.trim()) paragraph(resume.headline.trim(), style.center ? italic : regular, style.headline, { color: style.center ? INK : style.accent, align: style.center ? 'center' : 'left' });
  const contact = [resume.email, resume.phone, resume.location, ...lines(resume.links)].map((s) => s.trim()).filter(Boolean).join('  |  ');
  if (contact) {
    y -= 2;
    paragraph(contact, regular, style.contact, { color: MUTED, align: style.center ? 'center' : 'left' });
  }

  if (resume.summary.trim()) {
    heading('Summary');
    paragraph(resume.summary.trim(), regular, style.body);
  }
  const sections: Array<[string, Entry[]]> = [['Experience', resume.experience], ['Projects', resume.projects], ['Education', resume.education]];
  for (const [label, list] of sections) {
    const filled = list.filter((e) => !isBlank(e));
    if (!filled.length) continue;
    heading(label);
    filled.forEach(entry);
  }
  const skills = skillList(resume.skills);
  if (skills.length) {
    heading('Skills');
    paragraph(skills.join(', '), regular, style.body);
  }
  const certs = lines(resume.certifications);
  if (certs.length) {
    heading('Certifications');
    certs.forEach(bullet);
  }

  const who = resume.name.trim();
  doc.setTitle(who ? `${who} – Resume` : 'Resume');
  if (who) doc.setAuthor(who);
  doc.setSubject(resume.headline.trim() || 'Resume');
  doc.setCreator('Happy PDF');
  doc.setProducer('Happy PDF');
  return { bytes: await doc.save(), pages: doc.getPageCount(), dropped: [...dropped] };
}
