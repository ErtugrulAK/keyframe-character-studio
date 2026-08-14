/**
 * Phase 2 Step 4 — Procedural Animation Helpers
 *
 * Pure functions extracted from PartRenderer.tsx broadcast/live-stunt logic.
 * React-free, deterministic (except shake uses Math.random).
 *
 * These compute the procedural animation deltas that were previously
 * calculated inside the PartRenderer React component.
 */

import type { CharacterPart, CustomMotionPreset, AnimationTrackData } from '../types/animator';
import type { RuntimeData, RuntimeTrackState } from '../types/composition';
import { sampleCustomPreset } from './presetSampler';

// ─── Public API ─────────────────────────────────────────────────────────

export interface ProceduralDelta {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  opacityMul: number;
}

/**
 * Compute broadcast + live-stunt procedural animation deltas for one layer.
 *
 * Pure — given the same inputs always produces the same outputs
 * (except `shake` stunt which uses Math.random).
 *
 * Returns deltas that should be ADDED/MULTIPLIED to the keyframe-evaluated
 * world transform:
 *   finalX = world.x + delta.x
 *   finalY = world.y + delta.y
 *   finalRot = world.rotation + delta.rotation
 *   finalSX = world.scaleX * delta.scaleX
 *   finalSY = world.scaleY * delta.scaleY
 *   finalOpacity = baseOpacity * delta.opacityMul
 */
export function computeProceduralDelta(
  layer: CharacterPart,
  tracks: (AnimationTrackData & RuntimeTrackState)[],
  totalFrames: number,
  currentFrame: number,
  runtime: RuntimeData,
  customPresets: CustomMotionPreset[],
): ProceduralDelta {
  let x = 0, y = 0, rot = 0, sx = 1, sy = 1, opacityMul = 1;

  const inDur = layer.inAnimDuration || 30;
  const outDur = layer.outAnimDuration || 30;
  const inPreset = layer.inAnimPreset || 'none';
  const outPreset = layer.outAnimPreset || 'none';
  const allowMotion = layer.enableMotionAnim !== false;

  const targetTrack = tracks.find(t => t.partId === layer.id);

  if (runtime.appMode === 'broadcast') {
    // ── Broadcast mode ──────────────────────────────────────────────
    const bState = runtime.broadcast[layer.id] || { state: 'hidden', progress: 0 };

    if (targetTrack && targetTrack.visible === false) {
      opacityMul = 0;
    } else if (bState.state === 'hidden') {
      opacityMul = 0;
    } else if (allowMotion && bState.state === 'animating_in') {
      const r = applyPreset(inPreset, bState.progress, customPresets, 'in');
      x = r.x; y = r.y; rot = r.rot; sx = r.sx; sy = r.sy; opacityMul = r.opacity;
    } else if (allowMotion && bState.state === 'animating_out') {
      const r = applyPreset(outPreset, bState.progress, customPresets, 'out');
      x = r.x; y = r.y; rot = r.rot; sx = r.sx; sy = r.sy; opacityMul = r.opacity;
    } else if (bState.state === 'visible') {
      opacityMul = 1;
    }
  } else {
    // ── Edit mode (linear timeline) ─────────────────────────────────
    if (targetTrack && targetTrack.editVisible === false) {
      opacityMul = 0;
    } else {
      if (allowMotion && inPreset !== 'none' && currentFrame < inDur) {
        const p = currentFrame / inDur;
        const r = applyEditPreset(inPreset, p, 'in', customPresets);
        x = r.x; y = r.y; rot = r.rot; sx = r.sx; sy = r.sy; opacityMul = r.opacity;
      }
      if (allowMotion && outPreset !== 'none' && totalFrames - currentFrame <= outDur) {
        const p = Math.max(0, (totalFrames - currentFrame) / outDur);
        const r = applyEditPreset(outPreset, p, 'out', customPresets);
        x = r.x; y = r.y; rot = r.rot; sx = r.sx; sy = r.sy; opacityMul = r.opacity;
      }
    }
  }

  // ── Live stunts ──────────────────────────────────────────────────
  const stunt = runtime.liveStunts[layer.id];
  if (stunt) {
    const r = applyStunt(stunt.stunt, stunt.progress, stunt.customPresetId, customPresets);
    x += r.x; y += r.y; rot += r.rot; sx *= r.sx; sy *= r.sy; opacityMul *= r.opacity;
  }

  return { x, y, rotation: rot, scaleX: sx, scaleY: sy, opacityMul };
}

// ─── Preset application ─────────────────────────────────────────────────

interface DeltaResult { x: number; y: number; rot: number; sx: number; sy: number; opacity: number; }

function applyPreset(
  id: string, progress: number, presets: CustomMotionPreset[], mode: 'in' | 'out',
): DeltaResult {
  const cp = presets.find(p => p.id === id);
  if (cp) {
    const s = sampleCustomPreset(cp.keyframes, progress);
    const scope = cp.scope || 'both';
    let sx = s.scaleX, sy = s.scaleY;
    if (sx > 2.5) sx = sx / 6.42;
    if (sy > 2.5) sy = sy / 6.42;
    return {
      x: (scope === 'both' || scope === 'motion_only') ? s.deltaX : 0,
      y: (scope === 'both' || scope === 'motion_only') ? s.deltaY : 0,
      rot: (scope === 'both' || scope === 'motion_only') ? s.rotation : 0,
      sx: (scope === 'both' || scope === 'shape_only') ? sx : 1,
      sy: (scope === 'both' || scope === 'shape_only') ? sy : 1,
      opacity: s.opacity,
    };
  }
  // BUGFIX: a part WITHOUT an in/out preset (undefined) must stay fully
  // visible while animating_in — applyBuiltin(undefined) would fall through
  // to the default; being explicit keeps the contract deterministic:
  // no preset = no motion, full opacity.
  if (!id || id === 'none' || id === 'custom_timeline') {
    return { x: 0, y: 0, rot: 0, sx: 1, sy: 1, opacity: 1 };
  }
  // Builtin preset: apply cubic easing (matches PartRenderer broadcast behavior)
  const eased = mode === 'in'
    ? 1 - Math.pow(1 - progress, 3)
    : Math.pow(progress, 3);
  return applyBuiltin(id, eased, mode);
}

function applyEditPreset(id: string, progress: number, mode: 'in' | 'out', presets: CustomMotionPreset[]): DeltaResult {
  // M25 25B-fix: edit mode resolves CUSTOM presets through the exact same
  // chain as broadcast mode (lookup → scope handling → scale clamp →
  // sampleCustomPreset → DeltaResult). Builtin/fallback behavior is
  // identical to applyPreset (same default when id is missing/unknown), so
  // delegating keeps one source of truth instead of a second copy.
  return applyPreset(id, progress, presets, mode);
}

function applyBuiltin(id: string, eased: number, mode: 'in' | 'out'): DeltaResult {
  const sign = mode === 'in' ? 1 : -1;
  switch (id) {
    case 'fade':        return { x: 0, y: 0, rot: 0, sx: 1, sy: 1, opacity: eased };
    case 'pop':         return { x: 0, y: 0, rot: 0, sx: eased, sy: eased, opacity: eased };
    case 'spin':        return { x: 0, y: 0, rot: (1 - eased) * -360 * sign, sx: eased, sy: eased, opacity: eased };
    case 'slide-left':  return { x: 300 * (1 - eased) * sign, y: 0, rot: 0, sx: 1, sy: 1, opacity: eased };
    case 'slide-right': return { x: -300 * (1 - eased) * sign, y: 0, rot: 0, sx: 1, sy: 1, opacity: eased };
    case 'slide-up':    return { x: 0, y: 300 * (1 - eased) * sign, rot: 0, sx: 1, sy: 1, opacity: eased };
    case 'slide-down':  return { x: 0, y: -300 * (1 - eased) * sign, rot: 0, sx: 1, sy: 1, opacity: eased };
    // M24 — builtin COMBINATION presets (Option A: new IDs, same switch).
    // Genuinely NEW behavior only: every existing builtin already carries
    // opacity=eased, so "fade+slide" ≡ slide and "fade+scale" ≡ pop — those
    // are intentionally NOT added (discovery finding). Combinations combine
    // the existing atomic deltas in one DeltaResult: x/y additive, scale/
    // opacity multiplicative (evaluateFrame merge rules).
    case 'slide-scale-left':  return { x: 300 * (1 - eased) * sign, y: 0, rot: 0, sx: eased, sy: eased, opacity: eased };
    case 'slide-scale-right': return { x: -300 * (1 - eased) * sign, y: 0, rot: 0, sx: eased, sy: eased, opacity: eased };
    case 'soft-pop':          return { x: 0, y: 0, rot: 0, sx: 0.85 + 0.15 * eased, sy: 0.85 + 0.15 * eased, opacity: eased };
    default:            return { x: 0, y: 0, rot: 0, sx: 1, sy: 1, opacity: 1 };
  }
}

function applyStunt(
  stunt: string, progress: number,
  customId: string | undefined, presets: CustomMotionPreset[],
): DeltaResult {
  if (customId) {
    const cp = presets.find(p => p.id === customId);
    if (cp) {
      const s = sampleCustomPreset(cp.keyframes, progress);
      const scope = cp.scope || 'both';
      let sx = s.scaleX, sy = s.scaleY;
      if (sx > 2.5) sx = sx / 6.42;
      if (sy > 2.5) sy = sy / 6.42;
      return {
        x: (scope === 'both' || scope === 'motion_only') ? s.deltaX : 0,
        y: (scope === 'both' || scope === 'motion_only') ? s.deltaY : 0,
        rot: (scope === 'both' || scope === 'motion_only') ? s.rotation : 0,
        sx: (scope === 'both' || scope === 'shape_only') ? sx : 1,
        sy: (scope === 'both' || scope === 'shape_only') ? sy : 1,
        opacity: s.opacity,
      };
    }
  }
  switch (stunt) {
    case 'bounce': case 'ball':
      return { x: 0, y: Math.sin(progress * Math.PI) * -80, rot: 0, sx: 1, sy: 1, opacity: 1 };
    case 'pulse': {
      const f = 1 + Math.sin(progress * Math.PI) * 0.35;
      return { x: 0, y: 0, rot: 0, sx: f, sy: f, opacity: 1 };
    }
    case 'wobble':
      return { x: 0, y: 0, rot: Math.sin(progress * Math.PI * 4) * 18 * (1 - progress), sx: 1, sy: 1, opacity: 1 };
    case 'spin':
      return { x: 0, y: 0, rot: progress * 360, sx: 1, sy: 1, opacity: 1 };
    case 'shake': {
      const vib = (1 - progress) * 15;
      return { x: (Math.random() - 0.5) * vib, y: (Math.random() - 0.5) * vib, rot: 0, sx: 1, sy: 1, opacity: 1 };
    }
    case 'float':
      return { x: 0, y: Math.sin(progress * Math.PI * 2) * -30, rot: 0, sx: 1, sy: 1, opacity: 1 };
    default:
      return { x: 0, y: 0, rot: 0, sx: 1, sy: 1, opacity: 1 };
  }
}
