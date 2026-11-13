import React, { useId } from 'react';
import type { CharacterPart, PropertyKeyframe } from '../../../../types/animator';
import { useAnimatorSlice } from '../../../../context/useAnimator';
import { interpolateChannel } from '../../../../utils/animation/defaults';
import { resolveMotionPathSource } from '../../../../utils/animation/evaluateTransform';
import { generateId } from '../../../../utils/layers/idGenerator';
import { SmartNumberInput } from '../../inputs/SmartNumberInput';
import { StyleCard } from './StyleCard';

interface MotionPathCardProps {
  part: CharacterPart;
  characterParts: CharacterPart[];
  onPartPropChange: (key: keyof CharacterPart, value: unknown) => void;
  /** Writes the progress at the current frame (a key once it is keyed), as Trim Path does. */
  onUpdateProgress?: (value: number) => void;
  readOnlyReason?: string;
}

const placementParentOf = (part: CharacterPart): string | undefined => part.parentId ?? part.booleanGroupId;

/** The layers a part can follow: other path (freeform) layers placed in the same parent. */
export const motionPathCandidates = (part: CharacterPart, parts: readonly CharacterPart[]): CharacterPart[] =>
  parts.filter((candidate) => candidate.id !== part.id
    && candidate.type === 'custom_freeform'
    && placementParentOf(candidate) === placementParentOf(part));

/**
 * Motion Path: walk a layer along a path layer's outline. Choosing a path
 * links the layer and, when its progress is not keyed yet, keys it from the
 * start (0%) to the end (100%) of the sequence, so it walks right away; the
 * timeline's Motion Path › Progress row then times it like any other key.
 * Choosing None removes the link and its progress keys. Each change is one
 * undo step.
 */
export const MotionPathCard: React.FC<MotionPathCardProps> = ({ part, characterParts, onPartPropChange, onUpdateProgress, readOnlyReason }) => {
  const selectId = useId();
  const orientId = useId();
  const {
    tracks, setTracks, currentFrame, totalFrames, activeTemplateId, startBatchInteraction, endBatchInteraction,
  } = useAnimatorSlice('tracks', 'setTracks', 'currentFrame', 'totalFrames', 'activeTemplateId', 'startBatchInteraction', 'endBatchInteraction');
  const template = activeTemplateId || 'Sequence';
  const link = part.motionPath;
  const candidates = motionPathCandidates(part, characterParts);
  const parts = new Map(characterParts.map((candidate) => [candidate.id, candidate] as const));
  const following = resolveMotionPathSource(part, parts);
  const track = tracks.find((candidate) => candidate.partId === part.id);
  const keys = (track?.channels?.motionPathProgress ?? []).filter((key) => (key.templateId || 'Sequence') === template);
  const progress = keys.length > 0 ? interpolateChannel(keys, currentFrame, link?.progress ?? 0) : (link?.progress ?? 0);

  const writeKeys = (next: (keys: PropertyKeyframe[]) => PropertyKeyframe[]) => {
    if (!track) return;
    setTracks((previous) => previous.map((candidate) => (
      candidate.id === track.id
        ? { ...candidate, channels: { ...candidate.channels, motionPathProgress: next(candidate.channels?.motionPathProgress ?? []) } }
        : candidate
    )));
  };

  const choose = (sourceId: string) => {
    startBatchInteraction();
    try {
      if (!sourceId) {
        onPartPropChange('motionPath', undefined);
        writeKeys(() => []);
        return;
      }
      onPartPropChange('motionPath', { ...link, sourcePartId: sourceId, progress: link?.progress ?? 0 });
      if (keys.length === 0) {
        const end = Math.max(1, totalFrames);
        writeKeys((list) => [
          ...list,
          { id: generateId('pkf_motionPathProgress'), frame: 0, value: 0, easing: 'easeInOut', templateId: template },
          { id: generateId('pkf_motionPathProgress'), frame: end, value: 1, easing: 'easeInOut', templateId: template },
        ]);
      }
    } finally {
      endBatchInteraction();
    }
  };

  const status = !link
    ? undefined
    : link.enabled === false
      ? 'Off'
      : following
        ? 'On'
        : 'Missing';

  return (
    <StyleCard title="MOTION PATH" collapsible retainKey="motion-path" badge={status}>
      <div className="effects-property-grid">
        <div className="effects-property-field">
          <label className="param-label" htmlFor={selectId}>FOLLOW PATH</label>
          <select
            id={selectId}
            aria-label="Follow path"
            value={link?.sourcePartId ?? ''}
            disabled={Boolean(readOnlyReason)}
            title={readOnlyReason ?? 'Walk this layer along a path layer drawn with the pen'}
            onChange={(event) => choose(event.target.value)}
          >
            <option value="">None</option>
            {link && !candidates.some((candidate) => candidate.id === link.sourcePartId) && (
              <option value={link.sourcePartId}>{parts.get(link.sourcePartId)?.name ?? 'Missing path'}</option>
            )}
            {candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>{candidate.name || candidate.id}</option>
            ))}
          </select>
        </div>
        {link && (
          <div className="effects-property-field">
            <span className="param-label">PROGRESS %</span>
            <SmartNumberInput
              ariaLabel="Path progress"
              value={Math.round(progress * 1000) / 10}
              step={1}
              onChange={(value) => onUpdateProgress?.(value / 100)}
            />
          </div>
        )}
      </div>
      {link && (
        <div className="appearance-group-header">
          <label htmlFor={orientId}>ORIENT TO PATH</label>
          <input
            id={orientId}
            type="checkbox"
            aria-label="Orient to path"
            checked={link.orient === true}
            disabled={Boolean(readOnlyReason)}
            title="Turn the layer with the direction of travel"
            onChange={(event) => onPartPropChange('motionPath', { ...link, orient: event.target.checked })}
          />
        </div>
      )}
      {link && !following && link.enabled !== false && (
        <p className="param-label motion-path-note" role="note">
          The path is missing or sits in another group, so the layer stays where it is.
        </p>
      )}
      {candidates.length === 0 && !link && (
        <p className="param-label motion-path-note" role="note">Draw a path with the pen tool to follow it.</p>
      )}
    </StyleCard>
  );
};
