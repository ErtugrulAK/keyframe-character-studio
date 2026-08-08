import { useCallback, useRef, useEffect } from 'react';
import type { CharacterPart, Transform, AnimationTrackData } from '../types/animator';
import { evaluateTransform } from '../utils/evaluateTransform';

interface UseMathOptions {
  characterParts: CharacterPart[];
  tracks: AnimationTrackData[];
  activeTemplateId: string;
}

/**
 * React hook wrapping the pure `evaluateTransform` function.
 *
 * Phase 2: The hook now delegates all evaluation to the pure function.
 * It only adds React-specific caching (useRef) and cache invalidation
 * (useEffect). This is a thin wrapper — actual math lives in
 * `utils/evaluateTransform.ts`.
 *
 * API unchanged: `getComputedTransform(partId, frame) → Transform`
 */
export const useMath = ({ characterParts, tracks, activeTemplateId }: UseMathOptions) => {
  const cacheRef = useRef<Map<string, Transform>>(new Map());

  // Invalidate cache when input data changes
  useEffect(() => {
    cacheRef.current.clear();
  }, [characterParts, tracks, activeTemplateId]);

  const getComputedTransform = useCallback(
    (partId: string, frame: number): Transform => {
      const cacheKey = `${partId}_${frame}`;
      if (cacheRef.current.has(cacheKey)) {
        return cacheRef.current.get(cacheKey)!;
      }

      const world = evaluateTransform(characterParts, tracks, activeTemplateId, partId, frame);
      const part = characterParts.find((p) => p.id === partId);

      // WorldTransform → Transform (backward-compatible: add mask fields for the
      // legacy Transform API shape still consumed by inspector/timeline).
      // Opacity comes from the evaluated world transform — keyframe/channel
      // animated opacity is now reflected here too.
      const result: Transform = {
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
      };

      cacheRef.current.set(cacheKey, result);
      return result;
    },
    [characterParts, tracks, activeTemplateId],
  );

  return {
    getComputedTransform,
  };
};
