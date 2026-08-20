/**
 * Phase 2 Step 4 — Frame Evaluation Pipeline (with procedural animation)
 *
 * Pure function: layers + tracks + frame + runtime + customPresets → EvaluatedFrame
 * React-free, Node-compatible, deterministic.
 *
 * Pipeline (4 stages):
 *   1. Animation — keyframe interpolation + broadcast/live-stunt procedural deltas
 *   2. Hierarchy — parent-child world transform (in evaluateTransform)
 *   3. Visibility & Opacity — base opacity × procedural × editVisible/broadcast
 *   4. Sort — zIndex ordering
 *
 * DEPENDS ON:
 *   - evaluateTransform.ts (Step 2)
 *   - proceduralAnimation.ts (Step 4 Phase A)
 */

import type { CharacterPart, CustomMotionPreset, AnimationTrackData } from '../types/animator';
import type {
  EvaluatedFrame,
  EvaluatedLayer,
  RuntimeData,
  RuntimeTrackState,
  LayerContent,
} from '../types/composition';
import { evaluateTransform } from './evaluateTransform';
import { computeProceduralDelta } from './proceduralAnimation';

/**
 * Evaluate one complete frame with full animation evaluation.
 *
 * @param layers         — CharacterPart[]
 * @param tracks         — AnimationTrackData & RuntimeTrackState (animation data +
 *                          render-relevant visibility state; editor-only fields excluded)
 * @param totalFrames    — scene totalFrames
 * @param frame          — target frame number (default for all layers)
 * @param runtime        — RuntimeData (broadcast, liveStunts, appMode)
 * @param customPresets  — CustomMotionPreset[] (procedural animation assets)
 * @param frameOverrides — per-layer frame overrides for custom_timeline presets
 * @param sequenceId     — timeline sequence/template ID (defaults to legacy "Sequence")
 */
export function evaluateFrame(
  layers: CharacterPart[],
  tracks: (AnimationTrackData & RuntimeTrackState)[],
  totalFrames: number,
  frame: number,
  runtime: RuntimeData,
  customPresets: CustomMotionPreset[],
  frameOverrides?: Record<string, number>,
  sequenceId: string = 'Sequence',
): EvaluatedFrame {
  // ── Stage 1 & 2: Animation + Hierarchy ────────────────────────────
  // evaluateTransform handles keyframe interpolation + parent-child.
  // computeProceduralDelta handles broadcast/live-stunt deltas.
  // Both are merged here.

  const computed = new Map<string, {
    world: ReturnType<typeof evaluateTransform>;
    delta: ReturnType<typeof computeProceduralDelta>;
  }>();

  for (const layer of layers) {
    // Use per-layer frame override for custom_timeline presets
    const evalFrame = frameOverrides?.[layer.id] ?? frame;
    const world = evaluateTransform(layers, tracks, sequenceId, layer.id, evalFrame);
    // Procedural deltas always use the global frame (broadcast progress doesn't change per-layer)
    const delta = computeProceduralDelta(layer, tracks, totalFrames, frame, runtime, customPresets);
    computed.set(layer.id, { world, delta });
  }

  // ── Stage 3: Visibility & Opacity ─────────────────────────────────
  // Stage 4: Sort ────────────────────────────────────────────────────
  const evaluated: EvaluatedLayer[] = [];

  for (const layer of layers) {
    const c = computed.get(layer.id);
    if (!c) continue;

    const d = c.delta;

    // Merge keyframe world + procedural deltas
    const finalX = c.world.x + d.x;
    const finalY = c.world.y + d.y;
    const finalRot = c.world.rotation + d.rotation;
    const finalSX = c.world.scaleX * d.scaleX;
    const finalSY = c.world.scaleY * d.scaleY;

    // Opacity: keyframe-evaluated (world.opacity) × procedural multiplier
    const finalOpacity = Math.max(0, Math.min(1, c.world.opacity * d.opacityMul));
    const visible = finalOpacity > 0.001;

    evaluated.push({
      id: layer.id,
      type: layer.type,
      transform: {
        x: finalX,
        y: finalY,
        rotation: finalRot,
        scaleX: finalSX,
        scaleY: finalSY,
        opacity: finalOpacity,
      },
      opacity: finalOpacity,
      visible,
      content: extractContent(layer),
      zIndex: layer.zIndex,
    });
  }

  evaluated.sort((a, b) => a.zIndex - b.zIndex);

  return { frame, layers: evaluated };
}

// ─── Content extraction ──────────────────────────────────────────────────

function extractContent(layer: CharacterPart): LayerContent {
  return {
    fillColor: layer.fillColor,
    strokeColor: layer.strokeColor,
    fillEnabled: layer.fillEnabled,
    fillOpacity: layer.fillOpacity,
    strokeEnabled: layer.strokeEnabled,
    strokeWidth: layer.strokeWidth,
    strokeOpacity: layer.strokeOpacity,
    textValue: layer.textValue,
    fontSize: layer.fontSize,
    fontFamily: layer.fontFamily,
    imageUrl: layer.imageUrl,
    videoUrl: layer.videoUrl,
    points: layer.points,
    shadowColor: layer.shadowColor,
    shadowBlur: layer.shadowBlur,
    shadowOffsetX: layer.shadowOffsetX,
    shadowOffsetY: layer.shadowOffsetY,
    borderRadius: layer.borderRadius,
    width: layer.width,
    height: layer.height,
    // Cloner/particle passthrough
    clonerConfig: layer.clonerConfig,
    particleConfig: layer.particleConfig,
    inCustomPresetId: layer.inCustomPresetId,
    outCustomPresetId: layer.outCustomPresetId,
  };
}
