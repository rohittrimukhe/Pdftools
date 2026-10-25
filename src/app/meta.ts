import { TOOLS, isReady, toolPath } from '../features/tools/catalog';

export const APP_NAME = 'Happy PDF';
export const TAGLINE = 'Every document tool. Free. Private. Nothing uploaded.';

/** `index: false` keeps a page out of the sitemap and asks search engines not to list it (tools not built yet). */
export interface RouteMeta { path: string; title: string; description: string; index?: boolean }

const STATIC_ROUTES: RouteMeta[] = [
  { path: '/', title: `${APP_NAME}: free PDF and document tools that run on your device`, description: `${TAGLINE} Merge, compress, sign and convert PDFs, Word, Excel and PowerPoint; scan documents, read text with OCR and build resumes. No sign-up, no limits, no uploads.` },
  { path: '/recent', title: `Recent files · ${APP_NAME}`, description: 'Files you made with Happy PDF, kept only on this device.' },
  { path: '/settings', title: `Settings · ${APP_NAME}`, description: 'Theme, privacy and recent-file settings for Happy PDF.' },
  { path: '/about', title: `About · ${APP_NAME}`, description: `${TAGLINE} Free, no sign-up, works offline.` },
  { path: '/privacy', title: `Privacy policy · ${APP_NAME}`, description: 'Happy PDF processes your files on your device. Nothing is uploaded and no account is needed.' },
  { path: '/terms', title: `Terms of use · ${APP_NAME}`, description: 'Happy PDF is free to use, with no account. The terms in plain language.' },
  { path: '/licenses', title: `Open-source licenses · ${APP_NAME}`, description: 'The open-source libraries Happy PDF is built with.' },
];

/** Title and description for every public route: used for the pre-rendered pages and the browser tab. */
export const ROUTE_META: RouteMeta[] = [
  ...STATIC_ROUTES,
  ...TOOLS.map((tool) => ({
    path: toolPath(tool),
    title: `${tool.name}: free, private, nothing uploaded · ${APP_NAME}`,
    description: `${tool.blurb}. ${tool.name} runs on your device: free, no sign-up, no limits, and your files are never uploaded.`,
    index: isReady(tool),
  })),
];

export const metaFor = (path: string): RouteMeta => ROUTE_META.find((m) => m.path === path) ?? STATIC_ROUTES[0]!;
