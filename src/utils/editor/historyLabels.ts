/**
 * Names for undo steps, read off the two scene snapshots a step lies between.
 *
 * The history records snapshots, not commands, so a step has no name of its
 * own. Instead of having every command label itself (hundreds of call sites,
 * and a forgotten one would read "Edit"), the name says WHAT CHANGED: a layer
 * added or deleted, a move, a colour, a keyframe. A command the difference
 * cannot tell apart from another (Align Left moves layers) reads as what it
 * did ("Move 3 layers").
 *
 * Pure: the same two snapshots always give the same label.
 */
import type { CharacterPart, MotionTemplate, Track } from '../../types/animator';
import { structurallyEqual } from '../persistence/historySnapshot';

export interface HistoryStepState {
  tracks: readonly Track[];
  characterParts: readonly CharacterPart[];
  motionTemplates?: readonly MotionTemplate[];
  document?: unknown;
}

const count = (n: number, one: string, many: string): string => (n === 1 ? one : `${n} ${many}`);
const nameOf = (part: CharacterPart): string => part.name || 'layer';
const who = (parts: readonly CharacterPart[]): string => (parts.length === 1 ? nameOf(parts[0]) : `${parts.length} layers`);

/** Which part fields belong to which kind of edit; the first group with a hit names the step. */
const FIELD_GROUPS: ReadonlyArray<readonly [label: string, test: (key: string) => boolean]> = [
  ['Rename', (key) => key === 'name'],
  ['Edit path of', (key) => key === 'path' || key === 'points' || key === 'booleanContours'],
  ['Edit text of', (key) => key === 'textValue'],
  ['Change modifiers of', (key) => ['textFit', 'fitToText', 'follow', 'lookAt', 'justify', 'repeater'].includes(key)],
  ['Change text style of', (key) => key.startsWith('font') || key.startsWith('text') || key === 'letterSpacing' || key === 'lineHeight'],
  ['Change mask of', (key) => key === 'masks' || key === 'mask' || key.startsWith('mask')],
  ['Change matte of', (key) => key === 'matte' || key === 'trackMatte'],
  ['Change motion path of', (key) => key === 'motionPath'],
  ['Change corners of', (key) => key === 'polygon'],
  ['Crop', (key) => key.startsWith('crop')],
  ['Change effects of', (key) => key.startsWith('glow') || key.startsWith('shadow') || key.startsWith('dropShadow') || key === 'layerBlur' || key === 'blendMode' || key === 'effects'],
  ['Change trim path of', (key) => key.startsWith('trimPath')],
  ['Change motion of', (key) => key.includes('Preset') || key.includes('Duration') || key.startsWith('animation')],
  ['Change appearance of', (key) => key.startsWith('fill') || key.startsWith('stroke') || key === 'borderRadius' || key === 'gradient'],
  ['Replace image of', (key) => key === 'imageUrl' || key === 'innerMediaUrl' || key === 'assetId'],
  ['Resize', (key) => key === 'width' || key === 'height'],
  ['Reparent', (key) => key === 'parentId' || key === 'booleanGroupId' || key === 'boundPartIds' || key === 'booleanOperandIds'],
  ['Reorder', (key) => key === 'zIndex'],
];

const changedKeys = (a: object, b: object): string[] => {
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...keys].filter((key) => !structurallyEqual(left[key], right[key]));
};

/** The verb of a pose change: what of position, rotation, scale and opacity moved. */
const transformVerb = (pairs: ReadonlyArray<readonly [CharacterPart, CharacterPart]>): string => {
  const keys = new Set<string>();
  for (const [before, after] of pairs) for (const key of changedKeys(before.baseTransform ?? {}, after.baseTransform ?? {})) keys.add(key);
  const moved = keys.has('x') || keys.has('y');
  const turned = keys.has('rotation');
  const scaled = keys.has('scaleX') || keys.has('scaleY');
  const faded = keys.has('opacity');
  const kinds = [moved, turned, scaled, faded].filter(Boolean).length;
  if (kinds !== 1) return 'Transform';
  if (moved) return 'Move';
  if (turned) return 'Rotate';
  if (scaled) return 'Scale';
  return 'Change opacity of';
};

const keyframeCount = (track: Track): number => {
  let total = track.keyframes?.length ?? 0;
  for (const list of Object.values(track.channels ?? {})) total += list?.length ?? 0;
  for (const list of Object.values(track.maskChannels ?? {})) total += list?.length ?? 0;
  for (const list of Object.values(track.maskPathChannels ?? {})) total += list?.length ?? 0;
  return total;
};

const ANIMATION_KEYS = new Set(['channels', 'keyframes', 'maskChannels', 'maskPathChannels']);

/** The label of a step whose layers are the same but whose tracks differ. */
const describeTracks = (before: readonly Track[], after: readonly Track[], parts: readonly CharacterPart[]): string | undefined => {
  const previous = new Map(before.map((track) => [track.id, track] as const));
  const changed = after.filter((track) => {
    const old = previous.get(track.id);
    return old !== undefined && old !== track && !structurallyEqual(old, track);
  });
  if (changed.length === 0) return before.length !== after.length ? 'Change tracks' : undefined;
  const owners = changed
    .map((track) => parts.find((part) => part.id === track.partId))
    .filter((part): part is CharacterPart => part !== undefined);
  const subject = owners.length > 0 ? who(owners) : count(changed.length, 'track', 'tracks');
  const keys = new Set<string>();
  let keyframesBefore = 0;
  let keyframesAfter = 0;
  for (const track of changed) {
    const old = previous.get(track.id)!;
    for (const key of changedKeys(old, track)) keys.add(key);
    keyframesBefore += keyframeCount(old);
    keyframesAfter += keyframeCount(track);
  }
  if ([...keys].some((key) => ANIMATION_KEYS.has(key))) {
    const delta = keyframesAfter - keyframesBefore;
    if (delta > 0) return `Add ${count(delta, 'keyframe', 'keyframes')} on ${subject}`;
    if (delta < 0) return `Delete ${count(-delta, 'keyframe', 'keyframes')} on ${subject}`;
    return `Edit keyframes on ${subject}`;
  }
  if (keys.has('name')) return `Rename ${subject}`;
  if (keys.has('visible') || keys.has('editVisible')) return `Show / hide ${subject}`;
  if (keys.has('locked')) return `Lock / unlock ${subject}`;
  if (keys.has('color')) return `Change colour label of ${subject}`;
  return `Change timeline view of ${subject}`;
};

/** What the step from `before` to `after` did, as a short label. */
export const describeHistoryStep = (before: HistoryStepState, after: HistoryStepState): string => {
  const previous = new Map(before.characterParts.map((part) => [part.id, part] as const));
  const present = new Set(after.characterParts.map((part) => part.id));
  const added = after.characterParts.filter((part) => !previous.has(part.id));
  const removed = before.characterParts.filter((part) => !present.has(part.id));
  if (added.length > 0 && removed.length > 0) return `Replace ${who(removed)} with ${who(added)}`;
  if (added.length > 0) return `Add ${who(added)}`;
  if (removed.length > 0) return `Delete ${who(removed)}`;

  const pairs: Array<readonly [CharacterPart, CharacterPart]> = [];
  for (const part of after.characterParts) {
    const old = previous.get(part.id)!;
    if (old !== part && !structurallyEqual(old, part)) pairs.push([old, part]);
  }
  if (pairs.length > 0) {
    const subject = who(pairs.map(([, part]) => part));
    const keys = new Set<string>();
    for (const [old, part] of pairs) for (const key of changedKeys(old, part)) keys.add(key);
    for (const [label, test] of FIELD_GROUPS) {
      if ([...keys].some(test)) return `${label} ${subject}`;
    }
    if (keys.has('baseTransform')) return `${transformVerb(pairs)} ${subject}`;
    return `Edit ${subject}`;
  }

  const trackLabel = describeTracks(before.tracks, after.tracks, after.characterParts);
  if (trackLabel) return trackLabel;
  if (!structurallyEqual(before.motionTemplates, after.motionTemplates)) return 'Edit sequences';
  if (!structurallyEqual(before.document, after.document)) return 'Change project settings';
  return 'Edit';
};

/** The label of every step of a history stack; the first entry is where it starts. */
export const describeHistory = (history: readonly HistoryStepState[], cache?: WeakMap<object, string>): string[] =>
  history.map((state, index) => {
    if (index === 0) return 'Start';
    const known = cache?.get(state);
    if (known !== undefined) return known;
    const label = describeHistoryStep(history[index - 1], state);
    cache?.set(state, label);
    return label;
  });
