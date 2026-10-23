import { describe, expect, it } from 'vitest';
import { adAllowed, adsOn, isAdRequest } from './config';

const on = { client: 'ca-pub-1234567890123456', slots: { home: '1234567890', result: '2345678901' } };

describe('ads', () => {
  it('are off with no publisher ID, which is how the app ships', () => {
    expect(adsOn({ slots: {} })).toBe(false);
    expect(adAllowed({ slots: { home: '1234567890' } }, 'home')).toBe(false);
  });
  it('show only in placements that have their own ad unit', () => {
    expect(adAllowed(on, 'home')).toBe(true);
    expect(adAllowed(on, 'recent')).toBe(false);
  });
  it('ignore malformed IDs rather than calling the ad network with them', () => {
    expect(adAllowed({ client: 'pub-123', slots: { home: '1234567890' } }, 'home')).toBe(false);
    expect(adAllowed({ client: on.client, slots: { home: 'abc' } }, 'home')).toBe(false);
  });
  it('never show inside the native apps', () => {
    expect(adAllowed(on, 'home', { native: true })).toBe(false);
  });
  it('tells ad-network traffic apart from everything else', () => {
    expect(isAdRequest('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js')).toBe(true);
    expect(isAdRequest('https://googleads.g.doubleclick.net/pagead/ads')).toBe(true);
    expect(isAdRequest('https://example.com/upload')).toBe(false);
    expect(isAdRequest('/api/upload')).toBe(false);
  });
});

describe('ad host list', () => {
  it('stays narrow: other Google services still count on the badge', () => {
    expect(isAdRequest('https://www.google.com/upload')).toBe(false);
    expect(isAdRequest('https://evil-googlesyndication.com/x')).toBe(false);
  });
});
