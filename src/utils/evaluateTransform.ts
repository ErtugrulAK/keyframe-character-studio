/**
 * Phase 2 Step 2 — Pure Transform Evaluation
 *
 * Extracted core logic from `useMath.ts:getComputedTransform`.
 * React-free, cache-free, pure function. Node-compatible.
 *
 * Does NOT include broadcast/live-stunt procedural deltas — those remain
 * in PartRenderer until Step 4.
 */

import type { CharacterPart, Transform, Keyframe, PropertyKeyframe, AnimationTrackData } from '../types/animator';
import type { WorldTransform } from '../types/composition';
import { interpolateTransform, interpolateChannel } from './defaults';
import { PART_ANCHOR_OFFSETS } from './constants';

/**
 * Evaluate the animated transform for a single layer at a given frame.
 *
 * Pure — same (layers, tracks, activeTemplateId, partId, frame) always
 * produces the same Transform. No React, no cache, no side effects.
 *
 * Includes:
 *   - Keyframe evaluation (channels first, legacy composite fallback)
 *   - Anchor point offset resolution
 *   - Parent-child hierarchy (recursive)
 *
 * Does NOT include:
 *   - Broadcast/live-stunt procedural deltas (PartRenderer responsibility)
 *   - Opacity inheritance/visibility (renderer responsibility)
 */
export function evaluateTransform(
  layers: CharacterPart[],
  tracks: AnimationTrackData[],
  activeTemplateId: string,
  partId: string,
  frame: number,
): WorldTransform {
  const part = layers.find((p) => p.id === partId);

  // 1. Base transform (defensive fallback for missing layer)
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

  // 2. Keyframe evaluation
  const rawTransform = evaluateKeyframes(track, baseTransform, frame, activeTmpl);

  let finalComputed = rawTransform;

  // 3. Anchor point resolution
  if (part && part.anchor && part.anchor !== 'none') {
    const ox = part.anchorOffsetX ?? 0;
    const oy = part.anchorOffsetY ?? 0;
    const offsets = PART_ANCHOR_OFFSETS[part.anchor] || PART_ANCHOR_OFFSETS['none'];
    finalComputed = {
      ...rawTransform,
      x: offsets.ax + ox,
      y: offsets.ay + oy,
    };
  }

  // 4. Parent-child hierarchy (recursive)
  if (part && part.parentId) {
    const parentPart = layers.find((p) => p.id === part.parentId);
    if (parentPart && parentPart.id !== partId) {
      const parentTransform = evaluateTransform(layers, tracks, activeTemplateId, parentPart.id, frame);
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
        // Container children keep their OWN opacity
        opacity: finalComputed.opacity,
      };
    }
  }

  return finalComputed;
}

// ─── Keyframe evaluation (pure, extracted from useMath.ts:46-114) ──────

function evaluateKeyframes(
  track: AnimationTrackData,
  baseTransform: Transform,
  frame: number,
  activeTmpl: string,
): Transform {
  const ch = track.channels;
  const filterCh = (arr: PropertyKeyframe[] = []) =>
    arr.filter((k) => (k.templateId || 'Sequence') === activeTmpl);
  const hasChannelData =
    ch && Object.values(ch).some((arr: any) => filterCh(arr).length > 0);

  const filteredKfs = (track.keyframes || []).filter(
    (k) => (k.templateId || 'Sequence') === activeTmpl,
  );

  // Per-channel evaluation (canonical path)
  if (hasChannelData) {
    const legacyTransform = evalComposite(filteredKfs, baseTransform, frame);

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

  // Legacy composite evaluation (fallback path)
  return evalComposite(filteredKfs, baseTransform, frame);
}

function evalComposite(
  keyframes: Keyframe[],
  baseTransform: Transform,
  frame: number,
): Transform {
  if (keyframes.length === 0) return baseTransform;

  const sorted = [...keyframes].sort((a, b) => a.frame - b.frame);
  const exact = sorted.find((k) => k.frame === frame);
  if (exact) return exact.transform;

  if (frame <= sorted[0].frame) return sorted[0].transform;
  if (frame >= sorted[sorted.length - 1].frame) return sorted[sorted.length - 1].transform;

  let prev = sorted[0];
  let next = sorted[sorted.length - 1];
  for (let i = 0; i < sorted.length - 1; i++) {
    if (frame >= sorted[i].frame && frame <= sorted[i + 1].frame) {
      prev = sorted[i];
      next = sorted[i + 1];
      break;
    }
  }
  const dur = next.frame - prev.frame;
  const prog = (frame - prev.frame) / dur;
  return interpolateTransform(prev.transform, next.transform, prog, prev.easing, prev.bezierControlPoints);
}
