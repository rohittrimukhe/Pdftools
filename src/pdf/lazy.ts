/**
 * The PDF engines are large (pdf-lib, pdf.js). Screens load them the moment a
 * file is opened or an action runs, so a tool page opens fast and Home never
 * downloads them at all.
 */
export const loadEngine = () => import('./engine');
export const loadRender = () => import('./render');
export const loadPdfLib = () => import('@cantoo/pdf-lib');
export const loadExactPdf = () => import('../exact/pdf');
