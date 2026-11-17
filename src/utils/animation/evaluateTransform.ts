/**
 * Phase 2 Step 2 — Pure Transform Evaluation
 *
 * Extracted core logic from `useMath.ts:getComputedTransform`.
 * React-free, cache-free, pure function. Node-compatible.
 *
 * Does NOT include broadcast/live-stunt procedural deltas — those remain
 * in PartRenderer until Step 4.
 */

import type { CharacterPart, Transform, Keyframe, PropertyKeyframe, AnimationTrackData } from '../../types/animator';
import type { WorldTransform } from '../../types/composition';
import { interpolateTransform, interpolateChannel, lowerBound, sortedKeyframes } from './defaults';
import { PART_ANCHOR_OFFSETS } from '../editor/constants';
import { affineOfTransform, composeAffine, composeWorldTransform, withWorldAffine } from '../geometry/containerMath';
import { followMotionPath, measureMotionPath, type MotionPathTable } from '../geometry/motionPath';
import { resolveFreeformPath } from '../geometry/freeform';

/**
 * The pose a layer owns WITHOUT any timeline animation: exactly the base the
 * canonical channels and the legacy composite list are composed onto.
 *
 * This is the ONE authority for "the layer's own authored pose". The evaluator
 * composes every channel onto it, and the legacy → canonical conversion uses the
 * same value to tell a composite list that ANIMATES a property (its samples
 * move, or they hold a pose the layer does not own) from one that merely
 * re-states the layer's pose at every sample (no animation to carry, so no
 * channel key may be fabricated for it).
 */
export const authoredBasePose = (part: CharacterPart | undefined): Transform => (
  part
    ? {
        maskOffsetX: part.maskOffsetX ?? 0,
        maskOffsetY: part.maskOffsetY ?? 0,
        maskScale: part.maskScale ?? 1,
        maskRotation: part.maskRotation ?? 0,
        ...part.baseTransform,
        mask: part.baseTransform?.mask ?? part.mask,
      }
    : { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, maskOffsetX: 0, maskOffsetY: 0, maskScale: 1, maskRotation: 0 }
);

/**
 * Evaluate the animated transform for a single layer at a given frame.
 *
 * Pure — same (layers, tracks, activeTemplateId, partId, frame) always
 * produces the same Transform. No React and no side effects; the lookup index
 * and keyframe orders it reuses are keyed by its (immutable) inputs.
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
  return createTransformEvaluator(layers, tracks, activeTemplateId)(partId, frame);
}

/** id -> layer and partId -> track, built once per (layers, tracks) pair. */
type SceneIndex = { parts: Map<string, CharacterPart>; tracks: Map<string, AnimationTrackData> };
const sceneIndexes = new WeakMap<CharacterPart[], WeakMap<AnimationTrackData[], SceneIndex>>();
const sceneIndexOf = (layers: CharacterPart[], tracks: AnimationTrackData[]): SceneIndex => {
  let byTracks = sceneIndexes.get(layers);
  if (!byTracks) {
    byTracks = new WeakMap();
    sceneIndexes.set(layers, byTracks);
  }
  let index = byTracks.get(tracks);
  if (!index) {
    // The FIRST layer/track with an id wins, as a linear find did.
    const parts = new Map<string, CharacterPart>();
    for (const part of layers) if (!parts.has(part.id)) parts.set(part.id, part);
    const trackByPart = new Map<string, AnimationTrackData>();
    for (const track of tracks) if (!trackByPart.has(track.partId)) trackByPart.set(track.partId, track);
    index = { parts, tracks: trackByPart };
    byTracks.set(tracks, index);
  }
  return index;
};

/** A path layer's measured outline, once per (immutable) part object. */
const measuredPaths = new WeakMap<CharacterPart, MotionPathTable | null>();
const measuredPathOf = (part: CharacterPart): MotionPathTable | null => {
  if (!measuredPaths.has(part)) measuredPaths.set(part, measureMotionPath(resolveFreeformPath(part)));
  return measuredPaths.get(part) ?? null;
};

/** The parent a layer is placed in (a container or a boolean group), if any. */
const placementParentOf = (part: CharacterPart): string | undefined => part.parentId ?? part.booleanGroupId;

/**
 * The path layer a part follows, when the link can be honoured: it is enabled,
 * names another freeform layer with an outline to follow, and both are placed
 * in the same parent (so the path's own transform maps straight into the
 * follower's local space). Anything else follows nothing, and the layer keeps
 * its own position, like a Track Matte whose source is missing.
 */
export const resolveMotionPathSource = (
  part: CharacterPart,
  parts: ReadonlyMap<string, CharacterPart>,
): CharacterPart | undefined => {
  const link = part.motionPath;
  if (!link || link.enabled === false) return undefined;
  const source = parts.get(link.sourcePartId);
  if (!source || source.id === part.id || source.type !== 'custom_freeform') return undefined;
  if (placementParentOf(source) !== placementParentOf(part)) return undefined;
  return source;
};

/**
 * One scene's transform evaluator. Lookups go through an index instead of a
 * scan per layer and per parent level, and a world pose is computed once per
 * (layer, frame) for the evaluator's lifetime, so a parent shared by many
 * children is evaluated once: a frame of n layers is O(n) instead of O(n^2).
 * A result that touched a parent cycle (an invalid scene; validateScene
 * refuses it) is not reused, so such scenes evaluate exactly as before.
 */
export const createTransformEvaluator = (
  layers: CharacterPart[],
  tracks: AnimationTrackData[],
  activeTemplateId: string,
): ((partId: string, frame: number) => WorldTransform) => {
  const index = sceneIndexOf(layers, tracks);
  const activeTmpl = activeTemplateId || 'Sequence';
  const memo = new Map<string, WorldTransform>();
  const visiting = new Set<string>();
  let cycleHits = 0;

  const following = new Set<string>();

  /**
   * A layer's pose in its parent's space: its channels over its authored pose,
   * then its motion path, then its anchor.
   *
   * A layer that follows a path takes its position from the path at the
   * keyed progress, carried through the path layer's own local pose; its own
   * position keys add on top as an offset from its authored position, so an
   * extra wiggle keyed on X still shows. Orient adds the direction of travel
   * to its rotation. A chain of followers resolves through this same function;
   * a loop of them (an invalid scene) leaves the second visit unpathed.
   */
  const localPose = (partId: string, frame: number): Transform => {
    const part = index.parts.get(partId);
    const track = index.tracks.get(partId);
    // A layer with no animation track still inherits its parent: only the
    // keyframe evaluation is skipped here, never the hierarchy resolution.
    // Returning early left a static child at its local transform while the same
    // child with an (empty) track was placed correctly.
    const baseTransform = authoredBasePose(part);
    let pose = track ? evaluateKeyframes(track, baseTransform, frame, activeTmpl) : baseTransform;

    const source = part && !following.has(partId) ? resolveMotionPathSource(part, index.parts) : undefined;
    const table = source ? measuredPathOf(source) : null;
    if (part?.motionPath && source && table) {
      following.add(partId);
      const sourcePose = localPose(source.id, frame);
      following.delete(partId);
      const keys = keyframesOfTemplate(track?.channels?.motionPathProgress, activeTmpl);
      const fallback = part.motionPath.progress ?? 0;
      const progress = keys.length > 0 ? interpolateChannel(keys, frame, fallback) : fallback;
      const onPath = followMotionPath(table, affineOfTransform(sourcePose), progress);
      pose = {
        ...pose,
        x: onPath.x + (pose.x - baseTransform.x),
        y: onPath.y + (pose.y - baseTransform.y),
        rotation: pose.rotation + (part.motionPath.orient === true ? onPath.angle : 0),
      };
    }

    if (part && part.anchor && part.anchor !== 'none') {
      const ox = part.anchorOffsetX ?? 0;
      const oy = part.anchorOffsetY ?? 0;
      const offsets = PART_ANCHOR_OFFSETS[part.anchor] || PART_ANCHOR_OFFSETS.none;
      pose = { ...pose, x: offsets.ax + ox, y: offsets.ay + oy };
    }
    return pose;
  };

  const evaluate = (currentPartId: string, frame: number): WorldTransform => {
    const key = `${currentPartId}@${frame}`;
    const known = memo.get(key);
    if (known) return known;
    const hitsBefore = cycleHits;
    const part = index.parts.get(currentPartId);
    let finalComputed = localPose(currentPartId, frame);
    if (visiting.has(currentPartId)) {
      cycleHits += 1;
      return finalComputed;
    }

    visiting.add(currentPartId);
    const relationshipParentId = part?.parentId ?? part?.booleanGroupId;
    if (part && relationshipParentId) {
      const parentPart = index.parts.get(relationshipParentId);
      if (parentPart && parentPart.id !== currentPartId) {
        const parentTransform = evaluate(parentPart.id, frame);
        const nestedAffine = composeAffine(
          parentTransform.affine ?? affineOfTransform(parentTransform),
          affineOfTransform(finalComputed),
        );
        finalComputed = withWorldAffine(composeWorldTransform(parentTransform, finalComputed), nestedAffine);
      }
    }
    visiting.delete(currentPartId);
    if (cycleHits === hitsBefore) memo.set(key, finalComputed);
    return finalComputed;
  };
  return evaluate;
};

/** The keyframes of a template in a list, computed once per (list, template). */
const byTemplate = new WeakMap<readonly { templateId?: string }[], Map<string, unknown[]>>();
const keyframesOfTemplate = <K extends { templateId?: string }>(keyframes: readonly K[] | undefined, templateId: string): K[] => {
  if (!keyframes || keyframes.length === 0) return [];
  let perTemplate = byTemplate.get(keyframes);
  if (!perTemplate) {
    perTemplate = new Map();
    byTemplate.set(keyframes, perTemplate);
  }
  let filtered = perTemplate.get(templateId) as K[] | undefined;
  if (!filtered) {
    filtered = keyframes.filter((k) => (k.templateId || 'Sequence') === templateId);
    perTemplate.set(templateId, filtered);
  }
  return filtered;
};

// ─── Keyframe evaluation (pure, extracted from useMath.ts:46-114) ──────

function evaluateKeyframes(
  track: AnimationTrackData,
  baseTransform: Transform,
  frame: number,
  activeTmpl: string,
): Transform {
  const ch = track.channels;
  const filterCh = (arr: PropertyKeyframe[] | undefined) => keyframesOfTemplate(arr, activeTmpl);
  const hasChannelData =
    ch && Object.values(ch).some((arr) => filterCh(arr as PropertyKeyframe[] | undefined).length > 0);

  const filteredKfs = keyframesOfTemplate(track.keyframes, activeTmpl);

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

  const sorted = sortedKeyframes(keyframes);
  const at = lowerBound(sorted, frame);
  if (at < sorted.length && sorted[at].frame === frame) return sorted[at].transform;
  if (at === 0) return sorted[0].transform;
  if (at === sorted.length) return sorted[sorted.length - 1].transform;

  const prev = sorted[at - 1];
  const next = sorted[at];
  const dur = next.frame - prev.frame;
  const prog = (frame - prev.frame) / dur;
  return interpolateTransform(prev.transform, next.transform, prog, prev.easing, prev.bezierControlPoints);
}
