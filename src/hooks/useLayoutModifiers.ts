import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CharacterPart, Track, Transform } from '../types/animator';
import { applyLayoutToParts } from '../utils/layers/layoutModifiers';
import { createTransformEvaluator } from '../utils/animation/evaluateTransform';

/**
 * The stage's layers laid out by their modifiers (`utils/layers/layoutModifiers`):
 * text boxes, auto size, follow, justify and repeated copies. Text is measured
 * with the page's fonts, so the layout is measured again whenever a font
 * finishes loading. Render-only: the stored layers are never changed.
 *
 * `displayedTransform` is the transform the stage paints for a stored layer:
 * the computed one moved and scaled by exactly what its layout (and its
 * parents' layouts) changed, so the selection frame outlines what is drawn.
 */
export function useLayoutModifiers(
  parts: CharacterPart[],
  tracks: Track[],
  activeTemplateId: string,
  getComputedTransform: (id: string, frame: number) => Transform,
): {
  parts: CharacterPart[];
  tracks: Track[];
  displayedTransform: (id: string, frame: number) => Transform;
} {
  const [fontEpoch, setFontEpoch] = useState(0);
  useEffect(() => {
    const fonts = typeof document === 'object' ? document.fonts : undefined;
    if (!fonts) return undefined;
    let live = true;
    const remeasure = () => {
      if (live) setFontEpoch((epoch) => epoch + 1);
    };
    fonts.addEventListener?.('loadingdone', remeasure);
    void fonts.ready?.then(remeasure);
    return () => {
      live = false;
      fonts.removeEventListener?.('loadingdone', remeasure);
    };
  }, []);
  // fontEpoch only invalidates the measurement.
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  const laidOut = useMemo(() => applyLayoutToParts(parts, tracks), [parts, tracks, fontEpoch]);

  const evaluators = useMemo(() => {
    if (laidOut.parts === parts && laidOut.tracks === tracks) return null;
    const tmpl = activeTemplateId || 'Sequence';
    return { stored: createTransformEvaluator(parts, tracks, tmpl), shown: createTransformEvaluator(laidOut.parts, laidOut.tracks, tmpl) };
  }, [laidOut, parts, tracks, activeTemplateId]);

  const displayedTransform = useCallback((id: string, frame: number): Transform => {
    const transform = getComputedTransform(id, frame);
    if (!evaluators || !transform) return transform;
    const stored = evaluators.stored(id, frame);
    const shown = evaluators.shown(id, frame);
    if (stored.x === shown.x && stored.y === shown.y && stored.scaleX === shown.scaleX) return transform;
    return {
      ...transform,
      x: transform.x + (shown.x - stored.x),
      y: transform.y + (shown.y - stored.y),
      scaleX: stored.scaleX === 0 ? transform.scaleX : transform.scaleX * (shown.scaleX / stored.scaleX),
    };
  }, [evaluators, getComputedTransform]);

  return { parts: laidOut.parts, tracks: laidOut.tracks, displayedTransform };
}
