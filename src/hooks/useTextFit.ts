import { useEffect, useMemo, useState } from 'react';
import type { CharacterPart, Track } from '../types/animator';
import { applyTextFitToParts } from '../utils/layers/textFit';

/**
 * The stage's layers with text boxes fitted (`utils/layers/textFit`). Text is
 * measured with the page's fonts, so the fit is measured again whenever a font
 * finishes loading. Render-only: the stored layers are never changed.
 */
export function useTextFit(parts: CharacterPart[], tracks: Track[]): { parts: CharacterPart[]; tracks: Track[] } {
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
  return useMemo(() => applyTextFitToParts(parts, tracks), [parts, tracks, fontEpoch]);
}
