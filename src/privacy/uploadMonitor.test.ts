import { describe, expect, it } from 'vitest';
import { installUploadMonitor, uploadSnapshot, uploadedSince } from './uploadMonitor';

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
  });
});
