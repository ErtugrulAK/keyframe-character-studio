import { useCallback, useRef } from 'react';
import type { CharacterPart, Transform, AnimationTrackData } from '../types/animator';
import type { WorldAffine } from '../types/composition';
import { evaluateTransform } from '../utils/evaluateTransform';

interface UseMathOptions {
  characterParts: CharacterPart[];
  tracks: AnimationTrackData[];
  activeTemplateId: string;
}

/**
 * The world pose `getComputedTransform` answers with: the authored TRS reading
 * plus the derived world affine whenever a hierarchy nesting is not expressible
 * as those numbers (a rotated child of an anisotropically scaled container).
 */
type ComputedTransform = Transform & { affine?: WorldAffine };

/**
 * One revision of the document, with the transforms already evaluated for it.
 *
 * The identity of the inputs IS the version: `characterParts`, `tracks` and
 * `activeTemplateId` are replaced immutably, so a cache entry can only be valid
 * for the exact arrays it was computed from.
 */
interface TransformCache {
  parts: CharacterPart[];
  tracks: AnimationTrackData[];
  templateId: string;
  entries: Map<string, ComputedTransform>;
}

/**
 * React hook wrapping the pure `evaluateTransform` function.
 *
 * Phase 2: The hook delegates all evaluation to the pure function and only adds
 * per-frame memoization. Actual math lives in `utils/evaluateTransform.ts`.
 *
 * API unchanged: `getComputedTransform(partId, frame) → Transform`
 */
export const useMath = ({ characterParts, tracks, activeTemplateId }: UseMathOptions) => {
  /**
   * The cache is validated against the data identity at every read.
   *
   * Clearing it from an effect is NOT enough: a render can run before that
   * effect flushes, and then one derivation mixes entries computed from an older
   * document with values computed from the current one. Deriving the container's
   * transform from a previous revision while its children evaluate against the
   * current one made a group's aggregate selection box jump every frame of a
   * rotation drag. Keying the cache to the data removes React's render/effect
   * ordering from the correctness of the math.
   */
  const cacheRef = useRef<TransformCache | null>(null);

  const getComputedTransform = useCallback(
    (partId: string, frame: number): ComputedTransform => {
      const current = cacheRef.current;
      const cache = current
        && current.parts === characterParts
        && current.tracks === tracks
        && current.templateId === activeTemplateId
        ? current
        : { parts: characterParts, tracks, templateId: activeTemplateId, entries: new Map<string, ComputedTransform>() };
      cacheRef.current = cache;

      const cacheKey = `${partId}_${frame}`;
      const cached = cache.entries.get(cacheKey);
      if (cached) return cached;

      const world = evaluateTransform(characterParts, tracks, activeTemplateId, partId, frame);
      const part = characterParts.find((p) => p.id === partId);

      // WorldTransform → the Transform API shape still consumed by the
      // inspector/timeline, PLUS the derived world affine when the nesting is
      // not expressible as these TRS numbers. Opacity comes from the evaluated
      // world transform — keyframe/channel animated opacity is reflected here too.
      const result: ComputedTransform = {
        x: world.x,
        y: world.y,
        rotation: world.rotation,
        scaleX: world.scaleX,
        scaleY: world.scaleY,
        opacity: world.opacity,
        maskOffsetX: part?.maskOffsetX ?? 0,
        maskOffsetY: part?.maskOffsetY ?? 0,
        maskScale: part?.maskScale ?? 1,
        maskRotation: part?.maskRotation ?? 0,
        mask: part?.baseTransform?.mask ?? part?.mask,
        ...(world.affine ? { affine: world.affine } : {}),
      };

      cache.entries.set(cacheKey, result);
      return result;
    },
    [characterParts, tracks, activeTemplateId],
  );

  return {
    getComputedTransform,
  };
};
