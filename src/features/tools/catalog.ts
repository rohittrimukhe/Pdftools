import {
  Combine, Scissors, LayoutGrid, FileOutput, Minimize2, Ruler, Images, FileImage, ImageUp, Scaling,
  Lock, LockOpen, PenLine, Stamp, ListOrdered, FileText, FileSpreadsheet, Presentation, FileType2,
  ScanLine, ScanText, BadgeCheck, FileUser, type LucideIcon,
} from 'lucide-react';

export type Category = 'Organise' | 'Optimise' | 'Convert' | 'Secure' | 'Edit' | 'Career' | 'Scan';

export const CATEGORIES: readonly Category[] = ['Organise', 'Optimise', 'Convert', 'Edit', 'Secure', 'Scan', 'Career'];

export interface Tool {
  id: string;
  name: string;
  /** One short line: what you get. */
  blurb: string;
  category: Category;
  icon: LucideIcon;
  /** Words people type when they look for this tool. */
  keywords: string[];
  /** Build step that ships it. Tools from a later step show "Soon". */
  step: number;
}

export const TOOLS: readonly Tool[] = [
  { id: 'merge', name: 'Merge PDF', blurb: 'Join several PDFs into one', category: 'Organise', icon: Combine, keywords: ['combine', 'join', 'append'], step: 4 },
  { id: 'split', name: 'Split PDF', blurb: 'Cut one PDF into several', category: 'Organise', icon: Scissors, keywords: ['separate', 'divide', 'pages'], step: 4 },
  { id: 'organise', name: 'Organise pages', blurb: 'Reorder, rotate or delete pages', category: 'Organise', icon: LayoutGrid, keywords: ['reorder', 'rotate', 'delete', 'remove', 'sort', 'arrange', 'organize'], step: 4 },
  { id: 'extract', name: 'Extract pages', blurb: 'Keep only the pages you pick', category: 'Organise', icon: FileOutput, keywords: ['select', 'pick', 'pages'], step: 4 },
  { id: 'compress', name: 'Compress PDF', blurb: 'Smaller file, same pages', category: 'Optimise', icon: Minimize2, keywords: ['reduce', 'shrink', 'size', 'smaller', 'optimize'], step: 4 },
  { id: 'exact-size', name: 'Exact-size studio', blurb: 'PDF, photo or signature under a KB limit', category: 'Optimise', icon: Ruler, keywords: ['kb', '50kb', '100kb', '200kb', 'ssc', 'upsc', 'ibps', 'neet', 'passport', 'visa', 'exam', 'form', 'signature', 'photo'], step: 5 },
  { id: 'image-to-pdf', name: 'Image to PDF', blurb: 'Photos and scans in, one PDF out', category: 'Convert', icon: Images, keywords: ['jpg', 'jpeg', 'png', 'photo', 'picture', 'heic', 'webp'], step: 6 },
  { id: 'pdf-to-image', name: 'PDF to image', blurb: 'Every page as JPG or PNG', category: 'Convert', icon: FileImage, keywords: ['jpg', 'png', 'picture', 'export'], step: 6 },
  { id: 'convert-image', name: 'Convert image', blurb: 'JPG, PNG, WebP, SVG, HEIC, GIF', category: 'Convert', icon: ImageUp, keywords: ['format', 'jpg', 'png', 'webp', 'svg', 'heic', 'gif'], step: 6 },
  { id: 'resize-image', name: 'Resize image', blurb: 'Exact pixels, centimetres or KB', category: 'Convert', icon: Scaling, keywords: ['dimensions', 'crop', 'pixels', 'smaller', 'compress'], step: 6 },
  { id: 'word-to-pdf', name: 'Word to PDF', blurb: 'DOCX to PDF on your device', category: 'Convert', icon: FileText, keywords: ['docx', 'doc', 'word'], step: 12 },
  { id: 'pdf-to-word', name: 'PDF to Word', blurb: 'Editable DOCX from a PDF', category: 'Convert', icon: FileType2, keywords: ['docx', 'doc', 'word', 'editable'], step: 12 },
  { id: 'excel-to-pdf', name: 'Excel to PDF', blurb: 'Spreadsheets as PDF', category: 'Convert', icon: FileSpreadsheet, keywords: ['xlsx', 'xls', 'sheet', 'spreadsheet'], step: 12 },
  { id: 'ppt-to-pdf', name: 'PowerPoint to PDF', blurb: 'Slides as PDF', category: 'Convert', icon: Presentation, keywords: ['pptx', 'ppt', 'slides', 'presentation'], step: 12 },
  { id: 'sign', name: 'Sign PDF', blurb: 'Draw, type or upload your signature', category: 'Edit', icon: PenLine, keywords: ['signature', 'esign', 'autograph'], step: 4 },
  { id: 'watermark', name: 'Watermark', blurb: 'Stamp text on every page', category: 'Edit', icon: Stamp, keywords: ['stamp', 'confidential', 'draft', 'mark'], step: 4 },
  { id: 'page-numbers', name: 'Page numbers', blurb: 'Number every page', category: 'Edit', icon: ListOrdered, keywords: ['numbering', 'footer', 'pagination'], step: 4 },
  { id: 'protect', name: 'Protect PDF', blurb: 'Add a password', category: 'Secure', icon: Lock, keywords: ['password', 'encrypt', 'lock'], step: 4 },
  { id: 'unlock', name: 'Unlock PDF', blurb: 'Remove a password you know', category: 'Secure', icon: LockOpen, keywords: ['password', 'decrypt', 'unlock', 'remove'], step: 4 },
  { id: 'scan', name: 'Scan document', blurb: 'Camera to clean PDF, no watermark', category: 'Scan', icon: ScanLine, keywords: ['camera', 'scanner', 'photo'], step: 11 },
  { id: 'ocr', name: 'Text from scan (OCR)', blurb: 'Copy text out of scans, including Hindi', category: 'Scan', icon: ScanText, keywords: ['ocr', 'text', 'recognise', 'hindi', 'copy'], step: 11 },
  { id: 'resume-builder', name: 'Resume builder', blurb: 'Clean, ATS-friendly resumes', category: 'Career', icon: FileUser, keywords: ['cv', 'resume', 'job'], step: 10 },
  { id: 'resume-score', name: 'Resume score', blurb: 'ATS check against a job post', category: 'Career', icon: BadgeCheck, keywords: ['ats', 'cv', 'score', 'job', 'keywords'], step: 10 },
];

/** The four jobs most people open the app for. */
export const QUICK_TOOL_IDS = ['merge', 'compress', 'exact-size', 'image-to-pdf'] as const;

/** Highest build step that has shipped. Raised as each step lands. */
export const SHIPPED_STEP = 11;

export const isReady = (tool: Tool) => tool.step <= SHIPPED_STEP;
export const toolPath = (tool: Tool) => `/tools/${tool.id}`;
export const findTool = (id: string) => TOOLS.find((tool) => tool.id === id);

const normalise = (text: string) => text.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');

/**
 * Ranks tools for a search query. Every word must match somewhere; a match at
 * the start of the name ranks highest, then the name, keywords, blurb, category.
 */
export function searchTools(query: string, tools: readonly Tool[] = TOOLS): Tool[] {
  const words = normalise(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...tools];
  const scored: Array<[Tool, number]> = [];
  for (const tool of tools) {
    const name = normalise(tool.name);
    const keys = tool.keywords.map(normalise);
    const blurb = normalise(tool.blurb);
    const category = normalise(tool.category);
    let score = 0;
    let all = true;
    for (const word of words) {
      if (name.startsWith(word)) score += 8;
      else if (name.split(/\s+/).some((part) => part.startsWith(word))) score += 6;
      else if (keys.some((key) => key.startsWith(word))) score += 4;
      else if (name.includes(word) || keys.some((key) => key.includes(word))) score += 3;
      else if (blurb.includes(word)) score += 2;
      else if (category.startsWith(word)) score += 1;
      else { all = false; break; }
    }
    if (all) scored.push([tool, score]);
  }
  return scored.sort((a, b) => b[1] - a[1] || tools.indexOf(a[0]) - tools.indexOf(b[0])).map(([tool]) => tool);
}
