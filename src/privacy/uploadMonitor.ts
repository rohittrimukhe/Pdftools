/**
 * Counts every byte this page tries to send anywhere: fetch and XHR request
 * bodies, beacons and WebSocket messages. Installed before the app starts, so
 * the "0 bytes uploaded" badge is a measurement, not a claim. Image, script and
 * font downloads send no body, so they don't count as uploads.
 */
export interface UploadSnapshot { bytes: number; requests: number }

const totals: UploadSnapshot = { bytes: 0, requests: 0 };
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

function record(body: unknown) {
  const n = sizeOf(body);
  if (n > 0) {
    totals.bytes += n;
    totals.requests += 1;
  }
}

export function installUploadMonitor(scope: typeof globalThis = globalThis) {
  if (installed) return;
  installed = true;

  const originalFetch = scope.fetch?.bind(scope);
  if (originalFetch) {
    scope.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.body != null) record(init.body);
      else if (typeof Request !== 'undefined' && input instanceof Request && input.body) record(input.body);
      return originalFetch(input, init);
    };
  }

  const xhr = scope.XMLHttpRequest?.prototype;
  if (xhr) {
    const send = xhr.send;
    xhr.send = function patchedSend(this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
      record(body);
      return send.call(this, body);
    };
  }

  const nav = scope.navigator as Navigator | undefined;
  if (nav?.sendBeacon) {
    const beacon = nav.sendBeacon.bind(nav);
    nav.sendBeacon = (url: string | URL, data?: BodyInit | null) => { record(data); return beacon(url, data); };
  }

  const ws = scope.WebSocket?.prototype;
  if (ws) {
    const send = ws.send;
    ws.send = function patchedSend(this: WebSocket, ...args: Parameters<WebSocket['send']>) {
      record(args[0]);
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
