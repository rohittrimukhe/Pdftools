import { describe, expect, it } from 'vitest';
import { installUploadMonitor, isLocalShellRequest, uploadSnapshot, uploadedSince } from './uploadMonitor';

describe('upload monitor', () => {
  it('counts request bodies sent with fetch, and nothing for plain downloads', async () => {
    const calls: unknown[] = [];
    const scope = { fetch: async (...args: unknown[]) => { calls.push(args); return new Response('ok'); } } as unknown as typeof globalThis;
    installUploadMonitor(scope);
    const start = uploadSnapshot();

    await scope.fetch('https://example.invalid/page');
    expect(uploadedSince(start)).toEqual({ bytes: 0, requests: 0 });

    await scope.fetch('https://example.invalid/upload', { method: 'POST', body: new Blob([new Uint8Array(2048)]) });
    await scope.fetch('https://example.invalid/form', { method: 'POST', body: 'héllo' });
    expect(uploadedSince(start)).toEqual({ bytes: 2048 + 6, requests: 2 });
    expect(calls).toHaveLength(3);

    // The ad network's own requests are counted apart: they never carry your files.
    await scope.fetch('https://pagead2.googlesyndication.com/pagead/ping', { method: 'POST', body: 'x'.repeat(100) });
    expect(uploadedSince(start)).toEqual({ bytes: 2048 + 6, requests: 2 });

    // The desktop app's own save channel stays on the computer.
    await scope.fetch('ipc://localhost/plugin%3Afs%7Cwrite_file', { method: 'POST', body: new Uint8Array(500) });
    await scope.fetch('http://ipc.localhost/plugin%3Afs%7Cwrite_file', { method: 'POST', body: new Uint8Array(500) });
    expect(uploadedSince(start)).toEqual({ bytes: 2048 + 6, requests: 2 });
  });

  it('treats only the desktop save channel as local', () => {
    expect(isLocalShellRequest('ipc://localhost/x')).toBe(true);
    expect(isLocalShellRequest('http://ipc.localhost/x')).toBe(true);
    expect(isLocalShellRequest('https://ipc.localhost.example.com/x')).toBe(false);
    expect(isLocalShellRequest('https://example.com/ipc.localhost')).toBe(false);
    expect(isLocalShellRequest('/upload')).toBe(false);
  });
});
