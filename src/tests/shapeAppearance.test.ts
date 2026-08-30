import { describe, expect, it } from 'vitest';
import type { BodyPartType } from '../types/animator';
import {
  isShapeAppearanceEligible,
  resolveShapeAppearance,
  toAuthoringStrokeAlignment,
  toStrokeAlignmentControlValue,
  updateShapeAppearance,
} from '../utils/shapeAppearance';

const eligibleTypes: BodyPartType[] = [
  'custom_rect', 'custom_box', 'custom_circle', 'custom_triangle', 'custom_star',
  'custom_diamond', 'custom_parallelogram', 'custom_capsule', 'custom_freeform',
];

const basePart = (type: BodyPartType = 'custom_rect') => ({
  type,
  fillColor: '#fff',
  strokeColor: '#101218',
});

describe('shape appearance resolver', () => {
  it('detects modern appearance only from the new fields', () => {
    expect(resolveShapeAppearance({ ...basePart(), strokeWidth: 9 }).isModernAppearance).toBe(false);
    expect(resolveShapeAppearance({ ...basePart(), fillEnabled: false }).isModernAppearance).toBe(true);
    expect(resolveShapeAppearance({ ...basePart(), fillOpacity: 0 }).isModernAppearance).toBe(true);
    expect(resolveShapeAppearance({ ...basePart(), strokeEnabled: false }).isModernAppearance).toBe(true);
    expect(resolveShapeAppearance({ ...basePart(), strokeOpacity: 0 }).isModernAppearance).toBe(true);
  });

  it('applies modern defaults and preserves explicit booleans', () => {
    expect(resolveShapeAppearance({ ...basePart(), fillEnabled: false, strokeEnabled: true })).toMatchObject({
      fillEnabled: false,
      fillOpacity: 1,
      strokeEnabled: true,
      strokeWidth: 1.5,
      strokeOpacity: 1,
      strokeAlignment: 'center',
      isModernAppearance: true,
    });
  });

  it('defaults missing alignment to center and accepts inside/outside', () => {
    expect(resolveShapeAppearance({ ...basePart(), fillEnabled: true })).toMatchObject({ strokeAlignment: 'center' });
    expect(resolveShapeAppearance({ ...basePart(), fillEnabled: true, strokeAlignment: 'inside' })).toMatchObject({ strokeAlignment: 'inside' });
    expect(resolveShapeAppearance({ ...basePart(), fillEnabled: true, strokeAlignment: 'outside' })).toMatchObject({ strokeAlignment: 'outside' });
  });

  it('maps legacy center alignment to the Outside control without changing renderer compatibility', () => {
    expect(toStrokeAlignmentControlValue(undefined)).toBe('outside');
    expect(toStrokeAlignmentControlValue('center')).toBe('outside');
    expect(toStrokeAlignmentControlValue('outside')).toBe('outside');
    expect(toStrokeAlignmentControlValue('inside')).toBe('inside');
    expect(toAuthoringStrokeAlignment('outside')).toBe('center');
    expect(toAuthoringStrokeAlignment('inside')).toBe('inside');
  });

  it('clamps finite opacities while preserving zero', () => {
    expect(resolveShapeAppearance({ ...basePart(), fillOpacity: 0, strokeOpacity: 2 })).toMatchObject({ fillOpacity: 0, strokeOpacity: 1 });
    expect(resolveShapeAppearance({ ...basePart(), fillOpacity: -1, strokeOpacity: Number.NaN })).toMatchObject({ fillOpacity: 0, strokeOpacity: 1 });
    expect(resolveShapeAppearance({ ...basePart(), fillOpacity: Number.POSITIVE_INFINITY })).toMatchObject({ fillOpacity: 1 });
  });

  it('normalizes stroke width while preserving zero', () => {
    expect(resolveShapeAppearance({ ...basePart(), fillEnabled: true, strokeWidth: 0 })).toMatchObject({ strokeWidth: 0 });
    expect(resolveShapeAppearance({ ...basePart(), fillEnabled: true, strokeWidth: -2 })).toMatchObject({ strokeWidth: 1.5 });
    expect(resolveShapeAppearance({ ...basePart(), fillEnabled: true, strokeWidth: Number.NaN })).toMatchObject({ strokeWidth: 1.5 });
    expect(resolveShapeAppearance({ ...basePart(), fillEnabled: true, strokeWidth: Number.POSITIVE_INFINITY })).toMatchObject({ strokeWidth: 1.5 });
  });

  it('keeps colors authoritative', () => {
    expect(resolveShapeAppearance({ ...basePart(), fillColor: '#abc', strokeColor: '#def', fillOpacity: 0.4 })).toMatchObject({ fillColor: '#abc', strokeColor: '#def' });
  });

  it.each(eligibleTypes)('classifies %s as eligible', (type) => {
    expect(isShapeAppearanceEligible(type)).toBe(true);
    expect(resolveShapeAppearance(basePart(type))).toMatchObject({ fillEnabled: true, fillOpacity: 1, strokeWidth: 1.5, isModernAppearance: false });
  });

  it.each<BodyPartType>(['custom_banner', 'custom_card', 'custom_text', 'custom_image', 'custom_video', 'mograph_cloner', 'particle_system'])('excludes %s from V1 eligibility', (type) => {
    expect(isShapeAppearanceEligible(type)).toBe(false);
  });

  it('preserves legacy custom-stroke distinctions', () => {
    expect(resolveShapeAppearance(basePart('custom_box')).strokeEnabled).toBe(true);
    expect(resolveShapeAppearance({ ...basePart('custom_box'), strokeColor: '#f00' }).strokeEnabled).toBe(false);
    expect(resolveShapeAppearance({ ...basePart('custom_banner'), strokeColor: '#f00' }).strokeEnabled).toBe(true);
    expect(resolveShapeAppearance({ ...basePart('custom_box'), strokeColor: 'none' }).strokeEnabled).toBe(false);
  });

  it('ignores dormant legacy strokeWidth and trim fields', () => {
    const legacy = resolveShapeAppearance({ ...basePart(), strokeWidth: 12, strokeProgress: 0, strokeAnimColor: '#f00' } as never);
    const plain = resolveShapeAppearance(basePart());
    expect(legacy).toEqual(plain);
    expect(legacy.strokeWidth).toBe(1.5);
  });

  it('is deterministic and does not mutate input', () => {
    const part = { ...basePart(), fillOpacity: 0.25, strokeWidth: 2 };
    const before = { ...part };
    expect(resolveShapeAppearance(part)).toEqual(resolveShapeAppearance(part));
    expect(part).toEqual(before);
  });

  it('materializes the complete modern state on the first explicit legacy edit', () => {
    const legacy = { ...basePart('custom_box'), strokeWidth: 9 };
    expect(legacy.fillEnabled).toBeUndefined();
    const next = updateShapeAppearance(legacy as never, { fillOpacity: 0 });
    expect(next).toMatchObject({
      fillEnabled: true,
      fillOpacity: 0,
      strokeEnabled: true,
      strokeWidth: 1.5,
      strokeOpacity: 1,
      strokeAlignment: 'center',
      strokeColor: '#101218',
    });
    expect(next).not.toBe(legacy);
  });

  it('does not materialize excluded part types', () => {
    const text = { ...basePart('custom_text') };
    const next = updateShapeAppearance(text as never, { fillOpacity: 0 });
    expect(next.fillOpacity).toBe(0);
    expect(next.fillEnabled).toBeUndefined();
  });
});
