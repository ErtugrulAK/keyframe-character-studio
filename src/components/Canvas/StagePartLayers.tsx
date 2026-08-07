import React from 'react';
import type { AppMode, BroadcastObjectState, CharacterPart, Transform } from '../../types/animator';
import { PartRenderer } from './renderers/PartRenderer';

interface StagePartLayersProps {
  sortedParts: CharacterPart[];
  focusModeNodeId: string | null;
  appMode: AppMode;
  broadcastState: Record<string, BroadcastObjectState>;
  currentFrame: number;
  getComputedTransform: (partId: string, frame: number) => Transform;
  selectedPartId: string | null;
  totalFrames: number;
  onSelect: (id: string) => void;
  onStartTranslateDrag: (partId: string, e: React.MouseEvent) => void;
  onStartInnerMediaDrag?: (partId: string, e: React.MouseEvent) => void;
  onStartInnerMediaScale?: (partId: string, e: React.MouseEvent) => void;
  onStartInnerMediaRotate?: (partId: string, e: React.MouseEvent) => void;
}

/**
 * Renders the character part layers inside the stage <g>.
 * Handles the active parts map, the broadcast-mode frame evaluation, and the
 * focus-mode dimmer + focused part overlay.
 */
export const StagePartLayers: React.FC<StagePartLayersProps> = ({
  sortedParts,
  focusModeNodeId,
  appMode,
  broadcastState,
  currentFrame,
  getComputedTransform,
  selectedPartId,
  totalFrames,
  onSelect,
  onStartTranslateDrag,
  onStartInnerMediaDrag,
  onStartInnerMediaScale,
  onStartInnerMediaRotate,
}) => {
  // Render order: every container renders before its children (so the child's
  // clip path def exists and the child draws on top of its container).
  const orderedParts: CharacterPart[] = [];
  const placed = new Set<string>();
  for (const p of sortedParts) {
    if (placed.has(p.id)) continue;
    orderedParts.push(p);
    placed.add(p.id);
    if (!p.parentId) {
      for (const c of sortedParts) {
        if (c.parentId === p.id && !placed.has(c.id)) {
          orderedParts.push(c);
          placed.add(c.id);
        }
      }
    }
  }

  return (
    <g clipPath={appMode === 'broadcast' ? 'url(#artboard-clip)' : undefined}>
      {orderedParts.map((part) => {
        if (focusModeNodeId && part.id === focusModeNodeId) return null; // Render later

        let frameToEvaluate = currentFrame;

        if (appMode === 'broadcast') {
          const bState = broadcastState[part.id] || { state: 'hidden', progress: 0 };
          if (bState.state === 'animating_in' && part.inAnimPreset === 'custom_timeline') {
            const st = part.inAnimTimelineStart || 0;
            const en = part.inAnimTimelineEnd || 30;
            frameToEvaluate = st + bState.progress * (en - st);
          } else if (bState.state === 'visible' && part.inAnimPreset === 'custom_timeline') {
            frameToEvaluate = part.inAnimTimelineEnd || 30;
          } else if (bState.state === 'animating_out' && part.outAnimPreset === 'custom_timeline') {
            const st = part.outAnimTimelineStart || 0;
            const en = part.outAnimTimelineEnd || 30;
            frameToEvaluate = st + bState.progress * (en - st);
          }
        }

        const transform = getComputedTransform(part.id, frameToEvaluate);
        return (
          <PartRenderer
            key={part.id}
            part={part}
            transform={transform}
            isSelected={selectedPartId === part.id}
            currentFrame={frameToEvaluate}
            totalFrames={totalFrames}
            onSelect={onSelect}
            onStartTranslateDrag={onStartTranslateDrag}
            onStartInnerMediaDrag={onStartInnerMediaDrag}
            onStartInnerMediaScale={onStartInnerMediaScale}
            onStartInnerMediaRotate={onStartInnerMediaRotate}
          />
        );
      })}

      {/* Focus Mode Overlay and Focused Part */}
      {focusModeNodeId && (
        <>
          <rect
            className="focus-spotlight-dimmer"
            x={-300000}
            y={-300000}
            width={600000}
            height={600000}
            fill="rgba(0, 0, 0, 0.7)"
          />
          {sortedParts.filter((p) => p.id === focusModeNodeId).map((part) => {
            const transform = getComputedTransform(part.id, currentFrame);
            return (
              <g key={`focus-${part.id}`}>
                <PartRenderer
                  part={part}
                  transform={transform}
                  isSelected={true}
                  currentFrame={currentFrame}
                  totalFrames={totalFrames}
                  onSelect={onSelect}
                  onStartTranslateDrag={onStartTranslateDrag}
                  isGhost={true}
                  isFocusGhost={true}
                />
                <PartRenderer
                  part={part}
                  transform={transform}
                  isSelected={true}
                  currentFrame={currentFrame}
                  totalFrames={totalFrames}
                  onSelect={onSelect}
                  onStartTranslateDrag={onStartTranslateDrag}
                  onStartInnerMediaDrag={onStartInnerMediaDrag}
                  onStartInnerMediaScale={onStartInnerMediaScale}
                  onStartInnerMediaRotate={onStartInnerMediaRotate}
                />
              </g>
            );
          })}
        </>
      )}
    </g>
  );
};
