// Draws the source images for the Android and iOS icons and splash screens
// from public/icons/logo.svg, then lets @capacitor/assets cut every size.
// Run after changing the logo: npm run app:assets
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';

const logo = readFileSync('public/icons/logo.svg', 'utf8');
// The page alone, without the sunny tile, for Android's adaptive-icon foreground.
const page = logo.replace(/<rect[^>]*\/>/, '').replace('viewBox="0 0 512 512"', 'viewBox="-128 -128 768 768"');
const tile = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd25e"/><stop offset="1" stop-color="#ff9a1f"/></linearGradient></defs><rect width="512" height="512" fill="url(#s)"/></svg>`;
const square = logo.replace(/rx="\d+"/, 'rx="0"');

const shots = [
  { file: 'icon-only.png', size: 1024, svg: square },
  { file: 'icon-foreground.png', size: 1024, svg: page, transparent: true },
  { file: 'icon-background.png', size: 1024, svg: tile },
  { file: 'splash.png', size: 2732, svg: logo, splash: '#f8f6f1' },
  { file: 'splash-dark.png', size: 2732, svg: logo, splash: '#12110e' },
];

mkdirSync('assets', { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
for (const shot of shots) {
  const tab = await browser.newPage({ viewport: { width: shot.size, height: shot.size } });
  const inner = shot.splash ? Math.round(shot.size * 0.22) : shot.size;
  await tab.setContent(`<body style="margin:0;display:grid;place-items:center;height:100vh;background:${shot.splash ?? 'transparent'}">
    <div style="width:${inner}px;height:${inner}px">${shot.svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div></body>`);
  await tab.screenshot({ path: `assets/${shot.file}`, omitBackground: Boolean(shot.transparent) });
  await tab.close();
}
await browser.close();
console.log(`Drew ${shots.length} source images in assets/`);
