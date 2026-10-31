import type { CharacterPart } from '../types/animator';
import { resolveMatteMode, resolveMatteSource, suppressedMatteSourceIds } from './matte';

/**
 * One product-language reading of a layer's Track Matte, built only
 * from the existing authorities (`resolveMatteSource` for V2-over-legacy
 * precedence, `suppressedMatteSourceIds` for the scene-wide visibility
 * aggregation). It reads; it never migrates, merges or writes either raw
 * representation, so legacy and V2 data stay exactly as authored.
 */
interface EffectiveMatteRelationship {
  /** Which stored representation is in effect. */
  kind: 'track' | 'legacy';
  sourceId: string;
  /** The source layer, or undefined when the reference is missing. */
  source?: CharacterPart;
  status: 'active' | 'missing' | 'self';
  mode: 'alpha' | 'luminance' | 'clip';
  inverted: boolean;
  /** Track Matte only: this relationship's own "show source" setting. */
  showSourceSetting?: boolean;
  /** Whether the source is actually painted in the composition right now. */
  sourcePainted: boolean;
  /** OTHER targets whose active Track Matte hides this same source. */
  hiddenByOtherTargets: CharacterPart[];
  /** An active Track Matte shadows a legacy matte that is kept, inactive. */
  legacyShadowed: boolean;
}

/** The targets whose active relationship (V2 or legacy) reads `sourceId`. */
export const matteTargetsOfSource = (sourceId: string, parts: readonly CharacterPart[]): CharacterPart[] =>
  parts.filter((part) => part.id !== sourceId && resolveMatteSource(part)?.sourceId === sourceId);

export const resolveEffectiveMatteRelationship = (
  target: CharacterPart,
  parts: readonly CharacterPart[],
): EffectiveMatteRelationship | null => {
  const reference = resolveMatteSource(target);
  if (!reference) return null;
  const source = parts.find((part) => part.id === reference.sourceId);
  const status: EffectiveMatteRelationship['status'] = reference.sourceId === target.id
    ? 'self'
    : source ? 'active' : 'missing';
  const suppressed = suppressedMatteSourceIds(parts);
  const hiddenByOtherTargets = parts.filter((part) => part.id !== target.id
    && part.trackMatte
    && part.trackMatte.enabled !== false
    && part.trackMatte.sourceVisible === false
    && part.trackMatte.sourceLayerId === reference.sourceId);
  if (reference.kind === 'track') {
    const track = target.trackMatte!;
    return {
      kind: 'track',
      sourceId: reference.sourceId,
      source,
      status,
      mode: track.mode,
      inverted: track.inverted === true,
      showSourceSetting: track.sourceVisible !== false,
      sourcePainted: !suppressed.has(reference.sourceId),
      hiddenByOtherTargets,
      legacyShadowed: Boolean(target.matte?.sourcePartId),
    };
  }
  const legacy = target.matte!;
  return {
    kind: 'legacy',
    sourceId: reference.sourceId,
    source,
    status,
    mode: resolveMatteMode(legacy) ?? 'clip',
    inverted: legacy.inverted === true,
    sourcePainted: !suppressed.has(reference.sourceId),
    hiddenByOtherTargets,
    legacyShadowed: false,
  };
};
