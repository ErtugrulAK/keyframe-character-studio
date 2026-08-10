import React, { useMemo } from 'react';
import type {
  AppMode,
  BroadcastObjectState,
  CharacterPart,
  CustomMotionPreset,
  AnimationTrackData,
} from '../../types/animator';
import type { RuntimeData, BroadcastRuntime, RuntimeTrackState } from '../../types/composition';
import { PartRenderer } from './renderers/PartRenderer';
import { evaluateFrame } from '../../utils/evaluateFrame';
import { validateCritical, hasCriticalErrors } from '../../utils/validateScene';
import {
  buildMattePath,
  buildMatteClipPath,
  buildMatteMaskFromPath,
  matteClipPathId,
  matteMaskId,
  isMatteActive,
  resolveMatteMode,
} from '../../utils/matte';
import type { MatteClipPath, MatteMask } from '../../utils/matte';
import { CANVAS_CENTER } from '../../utils/constants';

interface StagePartLayersProps {
  sortedParts: CharacterPart[];
  appMode: AppMode;
  broadcastState: Record<string, BroadcastObjectState>;
  currentFrame: number;
  selectedPartId: string | null;
  totalFrames: number;
  onSelect: (id: string) => void;
  onStartTranslateDrag: (partId: string, e: React.MouseEvent) => void;
  tracks: (AnimationTrackData & RuntimeTrackState)[];
  customPresets: CustomMotionPreset[];
  liveStuntsState: Record<string, { stunt: string; progress: number; loop?: boolean; customPresetId?: string }>;
  /** Project resolution — world-space artboard region for inverted masks.
   *  Same computation as StageCanvas's artboard-clip. */
  projectResolution?: { width: number; height: number };
}

function toBroadcastRuntime(bs: Record<string, BroadcastObjectState>): Record<string, BroadcastRuntime> {
  const result: Record<string, BroadcastRuntime> = {};
  for (const [id, s] of Object.entries(bs)) {
    result[id] = { state: s.state, progress: s.progress };
  }
  return result;
}

function toLiveStuntsRuntime(
  ls: Record<string, { stunt: string; progress: number; customPresetId?: string }>,
): Record<string, { stunt: string; progress: number; customPresetId?: string }> {
  const result: Record<string, { stunt: string; progress: number; customPresetId?: string }> = {};
  for (const [id, s] of Object.entries(ls)) {
    result[id] = { stunt: s.stunt, progress: s.progress, customPresetId: s.customPresetId };
  }
  return result;
}

export const StagePartLayers: React.FC<StagePartLayersProps> = ({
  sortedParts,
  appMode,
  broadcastState,
  currentFrame,
  selectedPartId,
  totalFrames,
  onSelect,
  onStartTranslateDrag,
  tracks,
  customPresets,
  liveStuntsState,
  projectResolution,
}) => {
  // Build frame overrides for custom_timeline presets
  const frameOverrides: Record<string, number> = {};
  for (const part of sortedParts) {
    if (appMode === 'broadcast') {
      const bState = broadcastState[part.id] || { state: 'hidden', progress: 0 };
      if (bState.state === 'animating_in' && part.inAnimPreset === 'custom_timeline') {
        const st = part.inAnimTimelineStart || 0;
        const en = part.inAnimTimelineEnd || 30;
        frameOverrides[part.id] = st + bState.progress * (en - st);
      } else if (bState.state === 'visible' && part.inAnimPreset === 'custom_timeline') {
        frameOverrides[part.id] = part.inAnimTimelineEnd || 30;
      } else if (bState.state === 'animating_out' && part.outAnimPreset === 'custom_timeline') {
        const st = part.outAnimTimelineStart || 0;
        const en = part.outAnimTimelineEnd || 30;
        frameOverrides[part.id] = st + bState.progress * (en - st);
      }
    }
  }

  const runtime: RuntimeData = {
    appMode,
    broadcast: toBroadcastRuntime(broadcastState),
    liveStunts: toLiveStuntsRuntime(liveStuntsState),
  };

  // Phase 3 Step 7: critical validation before evaluation.
  // useMemo keeps it O(1) on re-renders when layer list reference is unchanged,
  // so valid scenes pay no repeated validation cost.
  const criticalErrors = useMemo(() => validateCritical({ layers: sortedParts }), [sortedParts]);
  const hasCritical = useMemo(() => hasCriticalErrors(criticalErrors), [criticalErrors]);

  // Safety: if the scene is structurally broken (duplicate IDs, parent cycles),
  // skip evaluation entirely. evaluateTransform would infinite-loop on cycles.
  if (hasCritical) {
    return null;
  }

  const evaluatedFrame = evaluateFrame(
    sortedParts,
    tracks,
    totalFrames,
    currentFrame,
    runtime,
    customPresets,
    frameOverrides,
  );

  // M11 Step 2B / M13 Step 2C — Track matte: build ONE world-space clipPath
  // or <mask> def per (source, mode, inverted) from the source's evaluated
  // world transform. Non-shape sources (freeform/text/image/video) yield null
  // and produce no clip/mask.
  // Geometry is computed ONCE per source: clips reuse buildMatteClipPath's
  // internal computation (M11 Step 5 dedupe), masks share a pathD cache
  // across modes so alpha + luminance + inverted on the same source run a
  // single buildMattePath.
  const matteClips = new Map<string, MatteClipPath>();
  const matteMasks = new Map<string, MatteMask>();
  const maskPathCache = new Map<string, string>(); // sourceId → pathD (shared across mask modes)
  for (const layer of sortedParts) {
    if (!layer.matte || !isMatteActive(layer.matte)) continue;
    const source = sortedParts.find((p) => p.id === layer.matte!.sourcePartId);
    if (!source) continue; // missing source → no clip/mask (recoverable validation warns)
    const sourceEl = evaluatedFrame.layers.find((el) => el.id === source.id);
    if (!sourceEl) continue;
    const mode = resolveMatteMode(layer.matte);

    if (mode === 'clip') {
      const clipId = matteClipPathId(source.id);
      if (matteClips.has(clipId)) continue; // already built for this source (1 source → N targets)
      const clip = buildMatteClipPath(source, sourceEl.transform);
      if (clip) matteClips.set(clip.id, clip);
      continue;
    }

    // alpha | luminance
    if (mode !== 'alpha' && mode !== 'luminance') continue; // TS narrowing (unreachable)
    const inverted = layer.matte.inverted === true;
    const maskId = matteMaskId(source.id, mode, inverted);
    if (matteMasks.has(maskId)) continue; // same (source, mode, inverted) already built

    let pathD = maskPathCache.get(source.id);
    if (pathD === undefined) {
      pathD = buildMattePath(source, sourceEl.transform) ?? undefined;
      if (pathD === undefined) continue;
      maskPathCache.set(source.id, pathD);
    }
    const fillColor = sourceEl.content.fillColor ?? source.fillColor ?? '#ffffff';
    const mask = buildMatteMaskFromPath(source.id, pathD, mode, inverted, fillColor);
    if (mask) matteMasks.set(mask.id, mask);
  }

  const matteAttrFor = (part: CharacterPart): { clipId?: string; maskId?: string } => {
    if (!part.matte || !isMatteActive(part.matte)) return {};
    if (!sortedParts.some((p) => p.id === part.matte!.sourcePartId)) return {};
    const mode = resolveMatteMode(part.matte);
    if (mode === 'clip') {
      const id = matteClipPathId(part.matte.sourcePartId);
      return matteClips.has(id) ? { clipId: id } : {};
    }
    if (mode === undefined) return {}; // unreachable when matte exists; TS narrowing
    const id = matteMaskId(part.matte.sourcePartId, mode, part.matte.inverted === true);
    return matteMasks.has(id) ? { maskId: id } : {};
  };

  // Inverted masks need an explicit full-artboard region (default mask bbox
  // would leave the outer area unmasked). Same computation as StageCanvas's
  // artboard-clip: CANVAS_CENTER ± projectResolution / 2. No pan/zoom.
  const region = {
    x: CANVAS_CENTER.x - (projectResolution?.width ?? 1920) / 2,
    y: CANVAS_CENTER.y - (projectResolution?.height ?? 1080) / 2,
    width: projectResolution?.width ?? 1920,
    height: projectResolution?.height ?? 1080,
  };

  return (
    <g clipPath={appMode === 'broadcast' ? 'url(#artboard-clip)' : undefined}>
      <defs>
        {[...matteClips.values()].map((clip) => (
          <clipPath key={clip.id} id={clip.id} clipPathUnits="userSpaceOnUse">
            <path d={clip.pathD} />
          </clipPath>
        ))}
        {[...matteMasks.values()].map((mask) => (
          <mask
            key={mask.id}
            id={mask.id}
            maskUnits="userSpaceOnUse"
            maskContentUnits="userSpaceOnUse"
            mask-type={mask.mode}
          >
            {mask.inverted ? (
              mask.mode === 'alpha' ? (
                // H fix (pixel-verified): in Chromium, an ALPHA mask that
                // combines a region rect with a second geometry element never
                // forms the inverted hole — the second element is ignored no
                // matter its fill (transparent/rgba/hex/fill-opacity all
                // FAILED in browser tests). A SINGLE evenodd path carrying the
                // outer region contour + the matte contour yields the real
                // hole: outer area alpha 1, matte area alpha 0.
                <path
                  d={`M ${region.x} ${region.y} H ${region.x + region.width} V ${region.y + region.height} H ${region.x} Z ${mask.pathD}`}
                  fillRule="evenodd"
                  fill="white"
                />
              ) : (
                <>
                  <rect x={region.x} y={region.y} width={region.width} height={region.height} fill="white" />
                  <path d={mask.pathD} fill="black" />
                </>
              )
            ) : (
              <path d={mask.pathD} fill={mask.fill} />
            )}
          </mask>
        ))}
      </defs>
      {evaluatedFrame.layers.map((el) => {
        const part = sortedParts.find(p => p.id === el.id);
        if (!part) return null;
        const matteAttrs = matteAttrFor(part);

        return (
          <PartRenderer
            key={el.id}
            part={part}
            isSelected={selectedPartId === el.id}
            currentFrame={currentFrame}
            onSelect={onSelect}
            onStartTranslateDrag={onStartTranslateDrag}
            evaluatedLayer={el}
            matteClipPathId={matteAttrs.clipId}
            matteMaskId={matteAttrs.maskId}
          />
        );
      })}
    </g>
  );
};
