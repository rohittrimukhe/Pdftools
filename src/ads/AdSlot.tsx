import { useEffect, useRef } from 'react';
import { adAllowed, adsConfig, nonPersonalisedOnly, type Placement } from './config';
import { isNative } from '../platform/runtime';
import './ads.css';

declare global {
  interface Window { adsbygoogle?: Array<Record<string, unknown>> & { requestNonPersonalizedAds?: number } }
}

let scriptAdded = false;
function loadAdScript(client: string) {
  if (scriptAdded) return;
  scriptAdded = true;
  window.adsbygoogle = window.adsbygoogle ?? ([] as unknown as NonNullable<Window['adsbygoogle']>);
  if (nonPersonalisedOnly()) window.adsbygoogle.requestNonPersonalizedAds = 1;
  const script = document.createElement('script');
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
  document.head.append(script);
}

/**
 * One ad, clearly labelled, in a reserved box so the page doesn't jump when it
 * loads. Renders nothing at all while ads are off, which is the default.
 */
export function AdSlot({ placement }: { placement: Placement }) {
  const ref = useRef<HTMLModElement>(null);
  const allowed = adAllowed(adsConfig, placement, { native: isNative });
  useEffect(() => {
    if (!allowed || !adsConfig.client) return;
    loadAdScript(adsConfig.client);
    try { (window.adsbygoogle ??= [] as unknown as NonNullable<Window['adsbygoogle']>).push({}); } catch { /* blocked by the browser or an extension */ }
  }, [allowed]);
  if (!allowed) return null;
  return (
    <aside className="ad-slot" aria-label="Advertisement">
      <span className="ad-slot__label">Advertisement</span>
      <ins
        ref={ref}
        className="adsbygoogle ad-slot__unit"
        data-ad-client={adsConfig.client}
        data-ad-slot={adsConfig.slots[placement]}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
