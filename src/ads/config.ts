/**
 * Advertising is off unless the site is built with an AdSense publisher ID
 * (VITE_ADSENSE_CLIENT, e.g. "ca-pub-1234567890123456"). Each placement also needs
 * its own ad unit ID. See docs/sop/ads.md.
 */
import { isNative } from '../platform/runtime';

export type Placement = 'home' | 'result' | 'recent';

export interface AdsConfig {
  client?: string;
  slots: Partial<Record<Placement, string>>;
}

export const adsConfig: AdsConfig = {
  client: import.meta.env.VITE_ADSENSE_CLIENT || undefined,
  slots: {
    home: import.meta.env.VITE_ADSENSE_SLOT_HOME || undefined,
    result: import.meta.env.VITE_ADSENSE_SLOT_RESULT || undefined,
    recent: import.meta.env.VITE_ADSENSE_SLOT_RECENT || undefined,
  },
};

const CLIENT_ID = /^ca-pub-\d{10,20}$/;
const SLOT_ID = /^\d{6,20}$/;

/** Is this placement allowed to show an ad right now? */
export function adAllowed(config: AdsConfig, placement: Placement, { native = false } = {}): boolean {
  if (native) return false; // Web ads never run inside the Android, iOS and desktop apps.
  if (!config.client || !CLIENT_ID.test(config.client)) return false;
  const slot = config.slots[placement];
  return Boolean(slot && SLOT_ID.test(slot));
}

export const adsOn = (config: AdsConfig = adsConfig, { native = isNative } = {}) =>
  (['home', 'result', 'recent'] as const).some((p) => adAllowed(config, p, { native }));

// Ad-serving hosts only. Kept narrow on purpose: anything else the page sends still counts on the badge.
const AD_HOSTS = /(^|\.)(googlesyndication\.com|doubleclick\.net|googleadservices\.com|adtrafficquality\.google)$/;
/** Requests from the ad network: counted apart from your files. */
export function isAdRequest(url: string, base = 'https://happypdf.invalid/'): boolean {
  try { return AD_HOSTS.test(new URL(url, base).hostname); } catch { return false; }
}

const NPA_KEY = 'hp.ads.nonPersonalised';
export function nonPersonalisedOnly(): boolean {
  try { return localStorage.getItem(NPA_KEY) === 'on'; } catch { return false; }
}
export function setNonPersonalisedOnly(on: boolean) {
  try { if (on) localStorage.setItem(NPA_KEY, 'on'); else localStorage.removeItem(NPA_KEY); } catch { /* storage unavailable */ }
}
