import { describe, expect, it } from 'vitest';
import { TEXT_PRESETS } from '../utils/editor/textPresets';

describe('TEXT_PRESETS', () => {
  it('has unique labels, so the Style list can name a match', () => {
    const labels = TEXT_PRESETS.map((preset) => preset.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('quotes every multi-word family the way the font list stores it', () => {
    TEXT_PRESETS.filter((preset) => /\s/.test(preset.fontFamily.replace(/'/g, ''))).forEach((preset) => {
      expect(preset.fontFamily).toMatch(/^'.+'$/);
    });
  });

  it('uses positive sizes', () => {
    TEXT_PRESETS.forEach((preset) => expect(preset.fontSize).toBeGreaterThan(0));
  });
});
