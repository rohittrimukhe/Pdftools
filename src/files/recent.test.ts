import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { RETAIN_DAYS, addRecent, clearRecent, listRecent, removeRecent, setKeepRecent } from './recent';

const store = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
} as Storage;
globalThis.window = { dispatchEvent: () => true } as unknown as Window & typeof globalThis;

const file = (name: string) => ({ name, type: 'application/pdf', size: 3, tool: 'merge', blob: new Blob(['abc']) });
const DAY = 24 * 60 * 60 * 1000;

describe('recent files', () => {
  beforeEach(async () => { store.clear(); await clearRecent(); });

  it('lists newest first and removes single entries', async () => {
    const now = Date.now();
    const a = await addRecent(file('a.pdf'), now - 1000);
    await addRecent(file('b.pdf'), now);
    expect((await listRecent(now)).map((f) => f.name)).toEqual(['b.pdf', 'a.pdf']);
    await removeRecent(a!.id);
    expect((await listRecent(now)).map((f) => f.name)).toEqual(['b.pdf']);
  });

  it(`forgets files after ${RETAIN_DAYS} days`, async () => {
    const now = Date.now();
    await addRecent(file('old.pdf'), now - (RETAIN_DAYS + 1) * DAY);
    await addRecent(file('new.pdf'), now - DAY);
    expect((await listRecent(now)).map((f) => f.name)).toEqual(['new.pdf']);
  });

  it('keeps nothing when the user turned keeping off', async () => {
    setKeepRecent(false);
    expect(await addRecent(file('x.pdf'))).toBeNull();
    expect(await listRecent()).toEqual([]);
  });
});
