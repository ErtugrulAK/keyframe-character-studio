import { useCallback, useRef, useEffect } from 'react';
import type { CharacterPart, Track, Transform, PropertyKeyframe } from '../types/animator';
import { interpolateTransform, interpolateChannel } from '../utils/defaults';
import { PART_ANCHOR_OFFSETS } from '../utils/constants';

interface UseMathOptions {
  characterParts: CharacterPart[];
  tracks: Track[];
  activeTemplateId: string;
}

export const useMath = ({ characterParts, tracks, activeTemplateId }: UseMathOptions) => {
  const cacheRef = useRef<Map<string, Transform>>(new Map());

  // Invalidate cache immediately on data change
  useEffect(() => {
    cacheRef.current.clear();
  }, [characterParts, tracks, activeTemplateId]);

  // Calculate position/rotation at given frame using interpolation
  // Channels take priority over legacy composite keyframes when populated
  const getComputedTransform = useCallback(
    (partId: string, frame: number): Transform => {
      const cacheKey = `${partId}_${frame}`;
      if (cacheRef.current.has(cacheKey)) {
        return cacheRef.current.get(cacheKey)!;
      }

      const part = characterParts.find((p) => p.id === partId);
      const baseTransform: Transform = part
        ? {
            maskOffsetX: part.maskOffsetX ?? 0,
            maskOffsetY: part.maskOffsetY ?? 0,
            maskScale: part.maskScale ?? 1,
            maskRotation: part.maskRotation ?? 0,
            ...part.baseTransform,
            mask: part.baseTransform?.mask ?? part.mask,
          }
        : { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, maskOffsetX: 0, maskOffsetY: 0, maskScale: 1, maskRotation: 0 };

      const track = tracks.find((t) => t.partId === partId);
      if (!track) return baseTransform;

      const activeTmpl = activeTemplateId || 'Sequence';

      const rawTransform = (() => {
        const ch = track.channels;
        const filterCh = (arr: PropertyKeyframe[] = []) => arr.filter((k) => (k.templateId || 'Sequence') === activeTmpl);
        const hasChannelData = ch && Object.values(ch).some((arr: any) => filterCh(arr).length > 0);

        const filteredKfs = (track.keyframes || []).filter((k) => (k.templateId || 'Sequence') === activeTmpl);

        if (hasChannelData) {
          const legacyTransform: Transform = (() => {
            if (filteredKfs.length === 0) return baseTransform;
            const sorted = [...filteredKfs].sort((a, b) => a.frame - b.frame);
            const exact = sorted.find((k) => k.frame === frame);
            if (exact) return exact.transform;
            if (frame <= sorted[0].frame) return sorted[0].transform;
            if (frame >= sorted[sorted.length - 1].frame) return sorted[sorted.length - 1].transform;
            let prev = sorted[0]; let next = sorted[sorted.length - 1];
            for (let i = 0; i < sorted.length - 1; i++) {
              if (frame >= sorted[i].frame && frame <= sorted[i + 1].frame) { prev = sorted[i]; next = sorted[i + 1]; break; }
            }
            const dur = next.frame - prev.frame;
            const prog = (frame - prev.frame) / dur;
            return interpolateTransform(prev.transform, next.transform, prog, prev.easing, prev.bezierControlPoints);
          })();

          const cx = filterCh(ch.x);
          const cy = filterCh(ch.y);
          const crot = filterCh(ch.rotation);
          const csx = filterCh(ch.scaleX);
          const csy = filterCh(ch.scaleY);
          const cop = filterCh(ch.opacity);
          const cmox = filterCh(ch.maskOffsetX);
          const cmoy = filterCh(ch.maskOffsetY);
          const cms = filterCh(ch.maskScale);
          const cmr = filterCh(ch.maskRotation);

          return {
            x: cx.length > 0 ? interpolateChannel(cx, frame, legacyTransform.x) : legacyTransform.x,
            y: cy.length > 0 ? interpolateChannel(cy, frame, legacyTransform.y) : legacyTransform.y,
            rotation: crot.length > 0 ? interpolateChannel(crot, frame, legacyTransform.rotation) : legacyTransform.rotation,
            scaleX: csx.length > 0 ? interpolateChannel(csx, frame, legacyTransform.scaleX) : legacyTransform.scaleX,
            scaleY: csy.length > 0 ? interpolateChannel(csy, frame, legacyTransform.scaleY) : legacyTransform.scaleY,
            opacity: cop.length > 0 ? interpolateChannel(cop, frame, legacyTransform.opacity) : legacyTransform.opacity,
            maskOffsetX: cmox.length > 0 ? interpolateChannel(cmox, frame, legacyTransform.maskOffsetX ?? 0) : (legacyTransform.maskOffsetX ?? baseTransform.maskOffsetX ?? 0),
            maskOffsetY: cmoy.length > 0 ? interpolateChannel(cmoy, frame, legacyTransform.maskOffsetY ?? 0) : (legacyTransform.maskOffsetY ?? baseTransform.maskOffsetY ?? 0),
            maskScale: cms.length > 0 ? interpolateChannel(cms, frame, legacyTransform.maskScale ?? 1) : (legacyTransform.maskScale ?? baseTransform.maskScale ?? 1),
            maskRotation: cmr.length > 0 ? interpolateChannel(cmr, frame, legacyTransform.maskRotation ?? 0) : (legacyTransform.maskRotation ?? baseTransform.maskRotation ?? 0),
            mask: legacyTransform.mask,
          };
        }

        if (filteredKfs.length === 0) return baseTransform;

        const sortedKfs = [...filteredKfs].sort((a, b) => a.frame - b.frame);
        const exact = sortedKfs.find((k) => k.frame === frame);
        if (exact) return exact.transform;
        if (frame <= sortedKfs[0].frame) return sortedKfs[0].transform;
        if (frame >= sortedKfs[sortedKfs.length - 1].frame) return sortedKfs[sortedKfs.length - 1].transform;

        let prevKf = sortedKfs[0];
        let nextKf = sortedKfs[sortedKfs.length - 1];
        for (let i = 0; i < sortedKfs.length - 1; i++) {
          if (frame >= sortedKfs[i].frame && frame <= sortedKfs[i + 1].frame) {
            prevKf = sortedKfs[i]; nextKf = sortedKfs[i + 1]; break;
          }
        }
        const duration = nextKf.frame - prevKf.frame;
        const progress = (frame - prevKf.frame) / duration;
        return interpolateTransform(prevKf.transform, nextKf.transform, progress, prevKf.easing, prevKf.bezierControlPoints);
      })();

      let finalComputed = rawTransform;

      // Feature 2: Responsive Anchor Point Resolution
      if (part && part.anchor && part.anchor !== 'none') {
        const ox = part.anchorOffsetX ?? 0;
        const oy = part.anchorOffsetY ?? 0;
        const offsets = PART_ANCHOR_OFFSETS[part.anchor] || PART_ANCHOR_OFFSETS['none'];
        const ax = offsets.ax;
        const ay = offsets.ay;
        finalComputed = {
          ...rawTransform,
          x: ax + ox,
          y: ay + oy,
        };
      }

      // Feature 3: Parent-Child Hierarchical Group Composition
      if (part && part.parentId) {
        const parentPart = characterParts.find((p) => p.id === part.parentId);
        if (parentPart && parentPart.id !== partId) {
          const parentTransform = getComputedTransform(parentPart.id, frame);
          const rad = (parentTransform.rotation * Math.PI) / 180;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);

          const scaledChildX = finalComputed.x * parentTransform.scaleX;
          const scaledChildY = finalComputed.y * parentTransform.scaleY;

          const rotatedChildX = scaledChildX * cos - scaledChildY * sin;
          const rotatedChildY = scaledChildX * sin + scaledChildY * cos;

          finalComputed = {
            ...finalComputed,
            x: parentTransform.x + rotatedChildX,
            y: parentTransform.y + rotatedChildY,
            rotation: parentTransform.rotation + finalComputed.rotation,
            scaleX: parentTransform.scaleX * finalComputed.scaleX,
            scaleY: parentTransform.scaleY * finalComputed.scaleY,
            // Container children keep their OWN opacity (like masked inner
            // media) — the container's opacity must NOT cascade into them.
            opacity: finalComputed.opacity,
          };
        }
      }

      cacheRef.current.set(cacheKey, finalComputed);
      return finalComputed;
    },
    [characterParts, tracks, activeTemplateId]
  );

  return {
    getComputedTransform,
  };
};
