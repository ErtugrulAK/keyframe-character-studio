import { describe, expect, it } from 'vitest';
import type { CharacterPart } from '../types/animator';
import { pickedTrackMatte, trackMattePickVerdict } from '../utils/trackMattePick';

const part = (id: string, extra: Partial<CharacterPart> = {}): CharacterPart => ({
  id, name: id.toUpperCase(), type: 'custom_rect', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 1,
  fillColor: '#fff', strokeColor: '#000', width: 10, height: 10, ...extra,
} as CharacterPart);

describe('C4 Track Matte pick-whip verdict (through the scene validator)', () => {
  const parts = [part('t'), part('s'), part('loop', { trackMatte: { sourceLayerId: 't', mode: 'alpha', enabled: true } })];

  it('accepts another layer and names it', () => {
    expect(trackMattePickVerdict(parts, 't', 's')).toEqual({ ok: true, sourceName: 'S' });
  });

  it('refuses no layer, a missing layer, itself, the current source and a loop — each with its reason', () => {
    expect(trackMattePickVerdict(parts, 't', null)).toMatchObject({ ok: false, reason: 'Drop on a layer to use it as the matte.' });
    expect(trackMattePickVerdict(parts, 't', 'gone')).toMatchObject({ ok: false });
    expect(trackMattePickVerdict(parts, 't', 't')).toMatchObject({ ok: false, reason: 'A layer cannot be its own matte.' });
    const withSource = parts.map((p) => (p.id === 't' ? { ...p, trackMatte: { sourceLayerId: 's', mode: 'alpha' as const } } : p));
    expect(trackMattePickVerdict(withSource, 't', 's')).toMatchObject({ ok: false, reason: '“S” is already the matte of this layer.' });
    expect(trackMattePickVerdict(parts, 't', 'loop')).toMatchObject({ ok: false, reason: expect.stringContaining('loop') });
  });

  it('a disabled relationship is not an active loop edge (the validator rule)', () => {
    const disabled = parts.map((p) => (p.id === 'loop' ? { ...p, trackMatte: { ...p.trackMatte!, enabled: false } } : p));
    expect(trackMattePickVerdict(disabled, 't', 'loop')).toMatchObject({ ok: true });
  });

  it('an unrelated problem elsewhere does not block the pick', () => {
    const elsewhere = [...parts, part('x', { trackMatte: { sourceLayerId: 'y', mode: 'alpha' } }), part('y', { trackMatte: { sourceLayerId: 'x', mode: 'alpha' } })];
    expect(trackMattePickVerdict(elsewhere, 't', 's')).toMatchObject({ ok: true });
  });

  it('the written relationship keeps the current settings and never hides the source', () => {
    expect(pickedTrackMatte(undefined, 's')).toEqual({ sourceLayerId: 's', mode: 'alpha', enabled: true, inverted: false, sourceVisible: true });
    expect(pickedTrackMatte({ sourceLayerId: 'old', mode: 'luminance', inverted: true, enabled: false, sourceVisible: false }, 's'))
      .toEqual({ sourceLayerId: 's', mode: 'luminance', enabled: false, inverted: true, sourceVisible: false });
  });
});
