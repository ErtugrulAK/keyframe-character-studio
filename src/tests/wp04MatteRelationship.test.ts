/**
 * WP-04 — the effective Track Matte reading: V2-over-legacy precedence from
 * `resolveMatteSource`, the unchanged any-false visibility aggregation, missing
 * vs self references, and the shared-source conflict list. Read-only: the raw
 * representations are never altered.
 */
import { describe, expect, it } from 'vitest';
import type { CharacterPart } from '../types/animator';
import { matteTargetsOfSource, resolveEffectiveMatteRelationship } from '../utils/layers/matteRelationship';

const part = (id: string, overrides: Partial<CharacterPart> = {}): CharacterPart => ({
  id,
  name: id.toUpperCase(),
  type: 'custom_rect',
  zIndex: 1,
  baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
  ...overrides,
});

describe('WP-04 effective matte relationship', () => {
  it('returns null without a relationship', () => {
    expect(resolveEffectiveMatteRelationship(part('a'), [part('a')])).toBeNull();
  });

  it('reads an active Track Matte with its own show-source setting', () => {
    const target = part('a', { trackMatte: { sourceLayerId: 'b', mode: 'luminance', inverted: true, sourceVisible: true } });
    const parts = [target, part('b')];
    const relationship = resolveEffectiveMatteRelationship(target, parts)!;
    expect(relationship).toMatchObject({ kind: 'track', sourceId: 'b', status: 'active', mode: 'luminance', inverted: true, showSourceSetting: true, sourcePainted: true, legacyShadowed: false });
    expect(relationship.source?.id).toBe('b');
  });

  it('reports a source hidden by ANOTHER target even when this one shows it (aggregation unchanged)', () => {
    const a = part('a', { trackMatte: { sourceLayerId: 'b', mode: 'alpha', sourceVisible: true } });
    const d = part('d', { name: 'Lower third', trackMatte: { sourceLayerId: 'b', mode: 'alpha', sourceVisible: false } });
    const parts = [a, part('b'), d];
    const relationship = resolveEffectiveMatteRelationship(a, parts)!;
    expect(relationship.showSourceSetting).toBe(true);
    expect(relationship.sourcePainted).toBe(false);
    expect(relationship.hiddenByOtherTargets.map((candidate) => candidate.name)).toEqual(['Lower third']);
    expect(matteTargetsOfSource('b', parts).map((candidate) => candidate.id)).toEqual(['a', 'd']);
  });

  it('keeps a shadowed legacy matte visible as preserved but inactive', () => {
    const target = part('a', {
      trackMatte: { sourceLayerId: 'b', mode: 'alpha' },
      matte: { sourcePartId: 'c', mode: 'clip', feather: 4 },
    });
    const parts = [target, part('b'), part('c')];
    expect(resolveEffectiveMatteRelationship(target, parts)).toMatchObject({ kind: 'track', sourceId: 'b', legacyShadowed: true });
    // A disabled V2 lets the legacy matte take effect — "disable V2" is not "no matte".
    const disabled = { ...target, trackMatte: { ...target.trackMatte!, enabled: false } };
    expect(resolveEffectiveMatteRelationship(disabled, [disabled, part('b'), part('c')])).toMatchObject({ kind: 'legacy', sourceId: 'c', mode: 'clip' });
    // Nothing was written to either representation.
    expect(target.matte).toEqual({ sourcePartId: 'c', mode: 'clip', feather: 4 });
  });

  it('separates a missing source from a self reference', () => {
    const missing = part('a', { trackMatte: { sourceLayerId: 'gone', mode: 'alpha' } });
    expect(resolveEffectiveMatteRelationship(missing, [missing])).toMatchObject({ status: 'missing', source: undefined });
    const self = part('a', { matte: { sourcePartId: 'a' } });
    expect(resolveEffectiveMatteRelationship(self, [self])?.status).toBe('self');
  });
});
