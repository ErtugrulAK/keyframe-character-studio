/**
 * Step markers split a sequence into OGraf steps: a graphic whose sequence
 * has markers at frames 40 and 90 plays 0→40 on its first play, 40→90 on
 * the next and 90→the end on the last (each "Next" in the playout plays one
 * step and holds). A sequence without markers is one step, as before.
 *
 * The markers live on the sequence (`MotionTemplate.stepMarkers`): frames
 * strictly inside it, whole numbers, sorted, each once.
 */
import type { MotionTemplate } from '../../types/animator';

/** The markers as stored: whole frames strictly between 0 and `durationFrames`, sorted, without repeats. */
export const normalizeStepMarkers = (markers: unknown, durationFrames: number): number[] => {
  if (!Array.isArray(markers)) return [];
  const frames = new Set<number>();
  for (const marker of markers) {
    if (typeof marker !== 'number' || !Number.isFinite(marker)) continue;
    const frame = Math.round(marker);
    if (frame > 0 && frame < durationFrames) frames.add(frame);
  }
  return [...frames].sort((a, b) => a - b);
};

/** The frame each step ends on: the markers, then the end of the sequence. */
export const stepEndFrames = (markers: readonly number[], totalFrames: number): number[] => [
  ...normalizeStepMarkers(markers, totalFrames),
  totalFrames,
];

/** The markers of the sequence a scene plays (its active one, else the first). */
export const sceneStepMarkers = (
  scene: { motionTemplates?: MotionTemplate[]; activeTemplateId?: string; totalFrames: number },
): number[] => {
  const templates = scene.motionTemplates ?? [];
  const template = templates.find((candidate) => candidate.id === (scene.activeTemplateId || 'Sequence')) ?? templates[0];
  return normalizeStepMarkers(template?.stepMarkers, scene.totalFrames);
};

/** A marker added at `frame` (no change when it is outside the sequence or already there). */
export const addStepMarker = (markers: readonly number[] | undefined, frame: number, durationFrames: number): number[] => (
  normalizeStepMarkers([...(markers ?? []), frame], durationFrames)
);

/** The marker at `frame` removed. */
export const removeStepMarker = (markers: readonly number[] | undefined, frame: number, durationFrames: number): number[] => (
  normalizeStepMarkers((markers ?? []).filter((marker) => Math.round(marker) !== Math.round(frame)), durationFrames)
);
