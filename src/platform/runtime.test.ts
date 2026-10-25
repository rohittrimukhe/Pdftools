import { describe, expect, it } from 'vitest';
import { detectRuntime } from './runtime';

describe('detectRuntime', () => {
  it('is web without a native shell', () => {
    expect(detectRuntime(undefined)).toBe('web');
    expect(detectRuntime({})).toBe('web');
  });
  it('spots the Tauri desktop shell', () => {
    expect(detectRuntime({ __TAURI_INTERNALS__: {} })).toBe('desktop');
  });
  it('spots Capacitor on Android and iOS', () => {
    expect(detectRuntime({ Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android' } })).toBe('android');
    expect(detectRuntime({ Capacitor: { isNativePlatform: () => true, getPlatform: () => 'ios' } })).toBe('ios');
  });
  it('treats Capacitor in a browser as web', () => {
    expect(detectRuntime({ Capacitor: { isNativePlatform: () => false, getPlatform: () => 'web' } })).toBe('web');
  });
});
