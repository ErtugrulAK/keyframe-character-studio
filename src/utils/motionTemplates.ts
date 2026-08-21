import type { MotionTemplate, PropertyKeyframe, Track } from '../types/animator';
import { generateId } from './idGenerator';

export const DEFAULT_SEQUENCE_DURATION_FRAMES = 60;

export const normalizeSequenceDuration = (value: number | undefined): number => {
  if (!Number.isFinite(value)) return DEFAULT_SEQUENCE_DURATION_FRAMES;
  return Math.max(0, Math.floor(value as number));
};

/**
 * Normalize persisted sequence metadata without rewriting valid historical IDs.
 * Missing IDs use the historical name as a deterministic compatibility fallback;
 * newly authored sequences use `createMotionTemplate`, which always generates an ID.
 */
export const normalizeMotionTemplates = (templates: MotionTemplate[] | undefined): MotionTemplate[] => {
  if (!templates || templates.length === 0) return [];

  return templates.map((template, index) => {
    const fallbackName = `Sequence ${index + 1}`;
    const name = template.name?.trim() || template.id?.trim() || fallbackName;
    const id = template.id?.trim() || (index === 0 ? 'Sequence' : name);
    return {
      ...template,
      id,
      name,
      type: template.type || 'in',
      durationFrames: normalizeSequenceDuration(template.durationFrames),
    };
  });
};

export const createUniqueSequenceName = (requestedName: string, existing: MotionTemplate[], fallback = 'New Sequence'): string => {
  const base = requestedName.trim() || fallback;
  const names = new Set(existing.map((template) => template.name.trim().toLowerCase()));
  if (!names.has(base.toLowerCase())) return base;

  let suffix = 2;
  while (names.has(`${base} ${suffix}`.toLowerCase())) suffix += 1;
  return `${base} ${suffix}`;
};

export const hasSequenceName = (templates: MotionTemplate[], name: string, exceptId?: string): boolean => {
  const normalized = name.trim().toLowerCase();
  return templates.some((template) => template.id !== exceptId && template.name.trim().toLowerCase() === normalized);
};

export const createMotionTemplate = (
  requestedName: string,
  existing: MotionTemplate[],
  type: MotionTemplate['type'] = 'in',
  durationFrames = DEFAULT_SEQUENCE_DURATION_FRAMES,
): MotionTemplate => ({
  id: generateId('seq'),
  name: createUniqueSequenceName(requestedName, existing),
  type,
  durationFrames: normalizeSequenceDuration(durationFrames),
  description: 'Custom Sequence Timeline',
});

const matchesTemplate = (templateId: string | undefined, sequenceId: string): boolean =>
  (templateId || 'Sequence') === sequenceId;

const clonePropertyKeyframe = (keyframe: PropertyKeyframe, sequenceId: string): PropertyKeyframe => ({
  ...keyframe,
  id: generateId('pkf'),
  templateId: sequenceId,
});

/** Clone only one sequence's authored animation data onto a new sequence ID. */
export const cloneSequenceAnimation = (tracks: Track[], sourceId: string, targetId: string): Track[] =>
  tracks.map((track) => {
    const channels = Object.fromEntries(
      Object.entries(track.channels || {}).map(([channel, keyframes]) => [
        channel,
        [
          ...(keyframes || []),
          ...(keyframes || [])
            .filter((keyframe) => matchesTemplate(keyframe.templateId, sourceId))
            .map((keyframe) => clonePropertyKeyframe(keyframe, targetId)),
        ],
      ]),
    ) as Track['channels'];

    const keyframes = (track.keyframes || [])
      .filter((keyframe) => matchesTemplate(keyframe.templateId, sourceId))
      .map((keyframe) => ({
        ...keyframe,
        id: generateId('kf'),
        templateId: targetId,
        transform: { ...keyframe.transform },
      }));

    return {
      ...track,
      channels: {
        ...track.channels,
        ...channels,
      },
      ...(keyframes.length > 0 ? { keyframes: [...(track.keyframes || []), ...keyframes] } : {}),
    };
  });
