/**
 * Where the app is running. The same build serves the website and the native
 * shells: Tauri on Windows, Linux and macOS, Capacitor on Android and iOS.
 */
export type Runtime = 'web' | 'desktop' | 'android' | 'ios';

interface ShellGlobals {
  __TAURI_INTERNALS__?: unknown;
  Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
}

export function detectRuntime(scope: ShellGlobals | undefined = typeof window === 'undefined' ? undefined : (window as ShellGlobals)): Runtime {
  if (!scope) return 'web';
  if (scope.__TAURI_INTERNALS__) return 'desktop';
  const cap = scope.Capacitor;
  if (cap?.isNativePlatform?.()) {
    const platform = cap.getPlatform?.();
    if (platform === 'android' || platform === 'ios') return platform;
  }
  return 'web';
}

export const runtime: Runtime = detectRuntime();
export const isNative = runtime !== 'web';
