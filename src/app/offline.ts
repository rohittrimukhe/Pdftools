/** Registers the offline service worker for website visitors. Native app shells load files locally and skip it. */
export function registerOffline({ native = false } = {}) {
  if (!import.meta.env.PROD || native || !('serviceWorker' in navigator)) return;
  const base = import.meta.env.BASE_URL;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => {
      // Offline support is a bonus: the app works online without it.
    });
  });
}
