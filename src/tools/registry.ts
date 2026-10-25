import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { Tool } from '../features/tools/catalog';

type ToolScreen = LazyExoticComponent<ComponentType<{ tool: Tool }>>;

/** The screen for each built tool, loaded only when opened. */
export const TOOL_SCREENS: Record<string, ToolScreen> = {
  merge: lazy(() => import('./Merge')),
  split: lazy(() => import('./Split')),
  organise: lazy(() => import('./Organise')),
  extract: lazy(() => import('./Extract')),
  compress: lazy(() => import('./Compress')),
  sign: lazy(() => import('./Sign')),
  watermark: lazy(() => import('./Watermark')),
  'page-numbers': lazy(() => import('./PageNumbers')),
  protect: lazy(() => import('./Protect')),
  unlock: lazy(() => import('./Unlock')),
  'exact-size': lazy(() => import('./ExactSize')),
  'image-to-pdf': lazy(() => import('./ImageToPdf')),
  'pdf-to-image': lazy(() => import('./PdfToImage')),
  'convert-image': lazy(() => import('./ImageBatch').then((m) => ({ default: m.ConvertImage }))),
  'resize-image': lazy(() => import('./ImageBatch').then((m) => ({ default: m.ResizeImage }))),
  scan: lazy(() => import('./Scan')),
  ocr: lazy(() => import('./Ocr')),
  'resume-builder': lazy(() => import('./ResumeBuilder')),
  'resume-score': lazy(() => import('./ResumeScore')),
};
