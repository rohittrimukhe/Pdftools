import { useEffect, useState, type AnchorHTMLAttributes, type MouseEvent } from 'react';

/**
 * A small router of our own: paths are plain URLs under the deploy base
 * (`/` locally, `/Pdftools/` on GitHub Pages), changed with the History API.
 */
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const EVENT = 'hp:navigate';

export const toHref = (path: string) => `${BASE}${path}`;

export function currentPath(): string {
  const path = window.location.pathname.startsWith(BASE) ? window.location.pathname.slice(BASE.length) : window.location.pathname;
  return path === '' ? '/' : path;
}

/** How many in-app screens sit behind this one (0 on the first screen of a visit). */
export const historyDepth = (): number => Number((window.history.state as { hpDepth?: number } | null)?.hpDepth ?? 0);

export function navigate(path: string, { replace = false } = {}) {
  if (path === currentPath()) return;
  const depth = historyDepth();
  if (replace) window.history.replaceState({ hpDepth: depth }, '', toHref(path));
  else window.history.pushState({ hpDepth: depth + 1 }, '', toHref(path));
  window.dispatchEvent(new Event(EVENT));
}

/** Back to the previous in-app screen, or to `fallback` when the visit started here (a shared link). */
export function goBack(fallback: string) {
  if (historyDepth() > 0) window.history.back();
  else navigate(fallback, { replace: true });
}

export function usePath(): string {
  const [path, setPath] = useState(currentPath);
  useEffect(() => {
    const sync = () => setPath(currentPath());
    window.addEventListener('popstate', sync);
    window.addEventListener(EVENT, sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener(EVENT, sync);
    };
  }, []);
  return path;
}

/** An ordinary link that navigates in-app on a plain click and still opens in a new tab on modified clicks. */
export function Link({ to, replace, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string; replace?: boolean }) {
  const handle = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(to, { replace });
  };
  return <a href={toHref(to)} onClick={handle} {...rest} />;
}
