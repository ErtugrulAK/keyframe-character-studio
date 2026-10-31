import { layerMaskPathChannel, type CharacterPart, type Track } from '../../types/animator';

/**
 * Layer and mask locks.
 *
 * Two different locks, never merged into one:
 *
 * - LAYER lock (`Track.locked`, the timeline's Lock switch): the layer's
 *   CONTENT may not change — its properties, transform, geometry, masks, matte,
 *   parenting, name, stacking position or keyframes — and it cannot be deleted.
 *   It stays visible, keeps animating, renders and exports exactly as before.
 *   Its switches stay usable: the edit/broadcast eyes, the lock itself and the
 *   timeline disclosure. A locked layer is not picked on the canvas (clicks go
 *   to the layer beneath, as in After Effects), but it can be selected in the
 *   layer list to be inspected and unlocked.
 * - MASK lock (`LayerMask.locked`): only that mask's path and its path
 *   transform are protected (the canvas path editor refuses it); the layer and
 *   its other masks stay editable.
 *
 * (The mask-path TOPOLOGY lock — an animated path keeps its vertex count — is a
 * third, unrelated rule in `maskPathEditing`.)
 */

/** Track fields a locked layer still lets the user change: its switches. */
const LOCKED_TRACK_SWITCHES = new Set<keyof Track>(['visible', 'editVisible', 'locked', 'expanded']);
/**
 * Part fields that may change on a locked layer: its stacking number, which
 * other layers' moves renumber (moving the locked layer itself is refused by
 * the reorder authority, not here).
 */
const LOCKED_PART_DERIVED = new Set<keyof CharacterPart>(['zIndex']);

export const lockedLayerIds = (tracks: readonly Track[]): Set<string> => {
  const ids = new Set<string>();
  tracks.forEach((track) => {
    if (track.locked) ids.add(track.partId);
  });
  return ids;
};

const changedOutside = <T extends object>(previous: T, next: T, allowed: Set<keyof T>): boolean => {
  if (previous === next) return false;
  const keys = new Set([...Object.keys(previous), ...Object.keys(next)] as (keyof T)[]);
  for (const key of keys) {
    if (allowed.has(key)) continue;
    // A deep copy of an unchanged value is not a change.
    if (previous[key] !== next[key] && JSON.stringify(previous[key]) !== JSON.stringify(next[key])) return true;
  }
  return false;
};

/** Locked layers whose part record an update removes or changes. */
export const lockedPartChanges = (previous: readonly CharacterPart[], next: readonly CharacterPart[], locked: Set<string>): string[] => {
  if (locked.size === 0 || previous === next) return [];
  const nextById = new Map(next.map((part) => [part.id, part]));
  const hits: string[] = [];
  previous.forEach((part) => {
    if (!locked.has(part.id)) return;
    const after = nextById.get(part.id);
    if (!after || changedOutside(part, after, LOCKED_PART_DERIVED)) hits.push(part.id);
  });
  return hits;
};

/**
 * Locked layers whose track an update removes or changes outside its switches.
 * The lock set is read from the PREVIOUS tracks: locking and unlocking are
 * switches themselves, so the update that flips the lock is always allowed.
 */
export const lockedTrackChanges = (previous: readonly Track[], next: readonly Track[]): string[] => {
  if (previous === next) return [];
  const nextById = new Map(next.map((track) => [track.id, track]));
  const hits: string[] = [];
  previous.forEach((track) => {
    if (!track.locked) return;
    const after = nextById.get(track.id);
    if (!after || changedOutside(track, after, LOCKED_TRACK_SWITCHES)) hits.push(track.partId);
  });
  return hits;
};

/** Names for a refusal message, in layer order. */
export const lockedLayerNames = (parts: readonly CharacterPart[], ids: readonly string[]): string[] => {
  const wanted = new Set(ids);
  return parts.filter((part) => wanted.has(part.id)).map((part) => part.name || part.id);
};

/** The one message every refused edit of a locked layer shows. */
export const lockedLayersMessage = (names: readonly string[]): string => {
  if (names.length === 0) return '';
  const quoted = names.slice(0, 3).map((name) => `“${name}”`).join(', ');
  const more = names.length > 3 ? ` and ${names.length - 3} more` : '';
  return names.length === 1
    ? `Layer ${quoted} is locked. Unlock it to change it.`
    : `Layers ${quoted}${more} are locked. Unlock them, or leave them out of the selection, to change them.`;
};

/**
 * Pre-flight check for an operation on a set of layers (a selection, a
 * delete, a group…): the refusal message when any of them is locked, else
 * null. Mixed selections are refused AS A WHOLE — nothing is applied to the
 * unlocked part of the selection without the user knowing.
 */
export const lockedLayersRefusal = (parts: readonly CharacterPart[], tracks: readonly Track[], ids: readonly string[]): string | null => {
  const locked = lockedLayerIds(tracks);
  const hits = ids.filter((id) => locked.has(id));
  return hits.length ? lockedLayersMessage(lockedLayerNames(parts, hits)) : null;
};

/**
 * Pre-flight check for an operation that has already PLANNED its result (a
 * group, an ungroup, a reparent…): the refusal message when the planned state
 * would change or remove any locked layer, else null — checked before anything
 * is written, so a refused operation leaves no part of itself behind.
 */
export const lockedOutcomeRefusal = (
  parts: readonly CharacterPart[],
  tracks: readonly Track[],
  nextParts: readonly CharacterPart[],
  nextTracks: readonly Track[] | null,
): string | null => {
  const hits = new Set([
    ...lockedPartChanges(parts, nextParts, lockedLayerIds(tracks)),
    ...(nextTracks ? lockedTrackChanges(tracks, nextTracks) : []),
  ]);
  return hits.size ? lockedLayersMessage(lockedLayerNames(parts, [...hits])) : null;
};

/** Whether this layer's lock switch is on. */
export const isLayerLocked = (tracks: readonly Track[], partId: string | null | undefined): boolean => (
  !!partId && tracks.some((track) => track.partId === partId && track.locked)
);

/** Same path data: identical reference, or equal content after a deep copy. */
const samePathData = (a: unknown, b: unknown): boolean => a === b || JSON.stringify(a) === JSON.stringify(b);

/** A locked mask, by owner layer and mask, for the refusal message. */
export interface LockedMaskHit {
  partId: string;
  maskId: string;
  label: string;
}

/**
 * Locked masks whose path an update changes — the static path on the part,
 * or its animated path channel on the track — or that it removes. Deleting
 * the whole LAYER is not a mask edit and is not caught here.
 */
export const lockedMaskChanges = (
  previousParts: readonly CharacterPart[],
  nextParts: readonly CharacterPart[] | null,
  previousTracks: readonly Track[] | null,
  nextTracks: readonly Track[] | null,
): LockedMaskHit[] => {
  const hits = new Map<string, LockedMaskHit>();
  const nextPartById = nextParts ? new Map(nextParts.map((part) => [part.id, part])) : null;
  const nextTrackByPart = nextTracks ? new Map(nextTracks.map((track) => [track.partId, track])) : null;
  const previousTrackByPart = previousTracks ? new Map(previousTracks.map((track) => [track.partId, track])) : null;
  previousParts.forEach((part) => {
    (part.masks ?? []).forEach((mask) => {
      if (!mask.locked) return;
      const hit = () => hits.set(`${part.id}:${mask.id}`, { partId: part.id, maskId: mask.id, label: `“${mask.name || mask.id}” on “${part.name || part.id}”` });
      if (nextPartById && nextPartById.has(part.id)) {
        const after = nextPartById.get(part.id)!.masks?.find((candidate) => candidate.id === mask.id);
        if (!after || !samePathData(after.path, mask.path)) hit();
      }
      if (previousTrackByPart && nextTrackByPart && nextTrackByPart.has(part.id)) {
        const channel = layerMaskPathChannel(mask.id);
        const before = previousTrackByPart.get(part.id)?.maskPathChannels?.[channel];
        const after = nextTrackByPart.get(part.id)?.maskPathChannels?.[channel];
        if (!samePathData(before ?? [], after ?? [])) hit();
      }
    });
  });
  return [...hits.values()];
};

export const lockedMasksMessage = (hits: readonly LockedMaskHit[]): string => (
  hits.length === 1
    ? `Mask ${hits[0].label} is locked. Unlock it to edit its path.`
    : `Masks ${hits.slice(0, 3).map((hit) => hit.label).join(', ')}${hits.length > 3 ? ` and ${hits.length - 3} more` : ''} are locked. Unlock them to edit their paths.`
);
