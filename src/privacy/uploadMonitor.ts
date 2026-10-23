/**
 * Counts every byte this page tries to send anywhere: fetch and XHR request
 * bodies, beacons and WebSocket messages. Installed before the app starts, so
 * the "0 bytes uploaded" badge is a measurement, not a claim. Image, script and
 * font downloads send no body, so they don't count as uploads.
 */
import { isAdRequest } from '../ads/config';

export interface UploadSnapshot { bytes: number; requests: number }

const totals: UploadSnapshot = { bytes: 0, requests: 0 };
/** Sent to the ad network (only when ads are switched on). Never file data; kept apart so the badge stays about your files. */
const adTotals: UploadSnapshot = { bytes: 0, requests: 0 };
let installed = false;

function sizeOf(body: unknown): number {
  if (body == null) return 0;
  if (typeof body === 'string') return new TextEncoder().encode(body).length;
  if (body instanceof Blob) return body.size;
  if (body instanceof ArrayBuffer) return body.byteLength;
  if (ArrayBuffer.isView(body)) return body.byteLength;
  if (body instanceof URLSearchParams) return new TextEncoder().encode(body.toString()).length;
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    let n = 0;
    body.forEach((value) => { n += typeof value === 'string' ? new TextEncoder().encode(value).length : value.size; });
    return n;
  }
  // A stream's length is unknown until read; count it as at least one byte so it never reads as zero.
  return 1;
}

/**
 * The desktop app hands a finished file to the system Save dialog over its own
 * in-process channel (ipc://localhost, or http://ipc.localhost on Windows).
 * Both stay inside this computer: *.localhost never leaves the machine.
 */
export function isLocalShellRequest(url: string, base = 'https://happypdf.invalid/'): boolean {
  try {
    const { protocol, hostname } = new URL(url, base);
    return protocol === 'ipc:' || hostname === 'ipc.localhost';
  } catch { return false; }
}

function record(body: unknown, url?: string | URL) {
  const n = sizeOf(body);
  if (n === 0) return;
  if (url !== undefined && isLocalShellRequest(String(url), globalThis.location?.href)) return;
  const target = url !== undefined && isAdRequest(String(url), globalThis.location?.href) ? adTotals : totals;
  target.bytes += n;
  target.requests += 1;
}

const urlOf = (input: RequestInfo | URL) => (typeof input === 'string' || input instanceof URL ? input : input.url);
const XHR_URL = Symbol('hp.url');

export function installUploadMonitor(scope: typeof globalThis = globalThis) {
  if (installed) return;
  installed = true;

  const originalFetch = scope.fetch?.bind(scope);
  if (originalFetch) {
    scope.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.body != null) record(init.body, urlOf(input));
      else if (typeof Request !== 'undefined' && input instanceof Request && input.body) record(input.body, input.url);
      return originalFetch(input, init);
    };
  }

  const xhr = scope.XMLHttpRequest?.prototype;
  if (xhr) {
    const open = xhr.open;
    xhr.open = function patchedOpen(this: XMLHttpRequest & { [XHR_URL]?: string }, ...args: unknown[]) {
      this[XHR_URL] = String(args[1]);
      return (open as (...a: unknown[]) => void).apply(this, args);
    } as typeof xhr.open;
    const send = xhr.send;
    xhr.send = function patchedSend(this: XMLHttpRequest & { [XHR_URL]?: string }, body?: Document | XMLHttpRequestBodyInit | null) {
      record(body, this[XHR_URL]);
      return send.call(this, body);
    };
  }

  const nav = scope.navigator as Navigator | undefined;
  if (nav?.sendBeacon) {
    const beacon = nav.sendBeacon.bind(nav);
    nav.sendBeacon = (url: string | URL, data?: BodyInit | null) => { record(data, url); return beacon(url, data); };
  }

  const ws = scope.WebSocket?.prototype;
  if (ws) {
    const send = ws.send;
    ws.send = function patchedSend(this: WebSocket, ...args: Parameters<WebSocket['send']>) {
      record(args[0], this.url);
      return send.apply(this, args);
    };
  }
}

export const uploadSnapshot = (): UploadSnapshot => ({ ...totals });

/** Bytes and requests sent between two snapshots. */
export const uploadedSince = (start: UploadSnapshot): UploadSnapshot => ({
  bytes: totals.bytes - start.bytes,
  requests: totals.requests - start.requests,
});

export const adSnapshot = (): UploadSnapshot => ({ ...adTotals });
