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
import { buildMatteClipPath, matteClipPathId, isMatteActive } from '../../utils/matte';
import type { MatteClipPath } from '../../utils/matte';

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

  // M11 Step 2B — Track matte: build ONE world-space clipPath per matte
  // source (deduped by sourcePartId) from the source's evaluated world
  // transform. Non-shape sources (freeform/text/image/video) yield null and
  // produce no clip.
  const matteClips = new Map<string, MatteClipPath>();
  for (const layer of sortedParts) {
    if (!layer.matte || !isMatteActive(layer.matte)) continue;
    const source = sortedParts.find((p) => p.id === layer.matte!.sourcePartId);
    if (!source) continue; // missing source → no clip (recoverable validation warns)
    const clipId = matteClipPathId(source.id);
    if (matteClips.has(clipId)) continue; // already built for this source (1 source → N targets)
    const sourceEl = evaluatedFrame.layers.find((el) => el.id === source.id);
    if (!sourceEl) continue;
    const clip = buildMatteClipPath(source, sourceEl.transform);
    if (clip && !matteClips.has(clip.id)) {
      matteClips.set(clip.id, clip);
    }
  }

  const clipIdFor = (part: CharacterPart): string | undefined => {
    if (!part.matte || !isMatteActive(part.matte)) return undefined;
    if (!sortedParts.some((p) => p.id === part.matte!.sourcePartId)) return undefined;
    const id = matteClipPathId(part.matte!.sourcePartId);
    return matteClips.has(id) ? id : undefined;
  };

  return (
    <g clipPath={appMode === 'broadcast' ? 'url(#artboard-clip)' : undefined}>
      <defs>
        {[...matteClips.values()].map((clip) => (
          <clipPath key={clip.id} id={clip.id} clipPathUnits="userSpaceOnUse">
            <path d={clip.pathD} />
          </clipPath>
        ))}
      </defs>
      {evaluatedFrame.layers.map((el) => {
        const part = sortedParts.find(p => p.id === el.id);
        if (!part) return null;

        return (
          <PartRenderer
            key={el.id}
            part={part}
            isSelected={selectedPartId === el.id}
            currentFrame={currentFrame}
            onSelect={onSelect}
            onStartTranslateDrag={onStartTranslateDrag}
            evaluatedLayer={el}
            matteClipPathId={clipIdFor(part)}
          />
        );
      })}
    </g>
  );
};
