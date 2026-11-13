import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AUTOSAVE_INTERVAL_STORAGE_KEY,
  DEFAULT_AUTOSAVE_SECONDS,
  normalizeAutosaveSeconds,
  readAutosaveSeconds,
  writeAutosaveSeconds,
} from '../utils/persistence/autosaveInterval';

describe('autosave interval preference', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('normalizes to whole seconds in 1-600 and falls back to the default', () => {
    expect(normalizeAutosaveSeconds(3)).toBe(3);
    expect(normalizeAutosaveSeconds('45')).toBe(45);
    expect(normalizeAutosaveSeconds(2.6)).toBe(3);
    expect(normalizeAutosaveSeconds(0)).toBe(1);
    expect(normalizeAutosaveSeconds(-5)).toBe(1);
    expect(normalizeAutosaveSeconds(10_000)).toBe(600);
    for (const junk of [NaN, Infinity, '', 'abc', null, undefined, {}]) expect(normalizeAutosaveSeconds(junk)).toBe(DEFAULT_AUTOSAVE_SECONDS);
  });

  it('reads the default when nothing (or junk) is stored, and reads back what was written', () => {
    expect(readAutosaveSeconds()).toBe(DEFAULT_AUTOSAVE_SECONDS);
    window.localStorage.setItem(AUTOSAVE_INTERVAL_STORAGE_KEY, 'junk');
    expect(readAutosaveSeconds()).toBe(DEFAULT_AUTOSAVE_SECONDS);
    expect(writeAutosaveSeconds(5)).toBe(5);
    expect(readAutosaveSeconds()).toBe(5);
  });

  it('works when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(readAutosaveSeconds()).toBe(DEFAULT_AUTOSAVE_SECONDS);
    expect(writeAutosaveSeconds(20)).toBe(20);
  });
});
