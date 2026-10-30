import type { CharacterPart, Track } from '../types/animator';
import type { PartWorldBounds } from './bounds';
import { EDITOR_CAMERA_CENTER, type CoordinatePoint } from './projectCoordinates';
import type { ProjectResolution } from './projectCoordinates';

/**
 * THE stage crop / region-of-interest authority.
 *
 * A crop is authored as a rectangle in STAGE space — the output space whose
 * origin is the current stage's top-left corner and whose unit is one project
 * unit (the same unit as `projectResolution`). Nothing here writes the
 * document: the callers below are pure planners, so the authoring hook can apply
 * a plan inside ONE batch interaction and a rejected crop leaves no trace.
 *
 * ── The coordinate shift, exactly ──────────────────────────────────────────
 * Authored layer positions are project-unit coordinates relative to the CENTRE
 * of the stage (`transform.x = outputX - width / 2`, the contract
 * `utils/projectCoordinates` defines). Cropping keeps every layer's place in the
 * world and only moves the frame, so a point that was at output `p` is at
 * `p - rect.topLeft` afterwards. In centre-relative units that is:
 *
 *   rel' = (rel + oldCentre) - topLeft - newCentre
 *        = rel + (oldCentre - topLeft - newCentre)
 *
 * so the whole scene shifts by ONE constant vector
 *
 *   dx = resolution.width  / 2 - rect.x - rect.width  / 2
 *   dy = resolution.height / 2 - rect.y - rect.height / 2
 *
 * Because the shift is uniform, every relationship between layers (spacing,
 * relative motion, groups, parent transforms, masks, mattes, bonds) survives it
 * byte for byte. The shift is applied to TOP-LEVEL layers only: a child's
 * `x`/`y` is expressed in its container's space (`utils/containerMath`), so a
 * child that also received the delta would move twice.
 *
 * ── What is never touched ──────────────────────────────────────────────────
 * Keyframe FRAMES and sequence (`templateId`) scopes, `rotation`, `scaleX`,
 * `scaleY`, `opacity`, masks, mattes, track mattes, boolean groups, layer
 * groups, trim paths, media and `imageContentBounds`. Only `x`/`y` values of the
 * top-level layers, their canonical `x`/`y` channels, their legacy composite
 * keyframe positions and the stage resolution change.
 *
 * ── Rounding ───────────────────────────────────────────────────────────────
 * A stage unit is a pixel. An auto-crop derived from visual bounds rounds
 * OUTWARD (`floor`/`ceil`), so no visible pixel of the content is ever clipped
 * by the region that measured it; a region the user drew by hand rounds to the
 * nearest whole unit, because it is exactly what the pointer described.
 */

/** A region of the stage, in stage space (origin at the current stage's top-left). */
export interface StageCropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The uniform centre-relative shift cropping applies to the top-level layers. */
interface StageCropShift {
  dx: number;
  dy: number;
}

/** The eight resize handles of the region, keyed by the corner/edge they move. */
export type StageCropHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export const STAGE_CROP_HANDLES: readonly StageCropHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

/** Narrowing guard for a handle read back from the DOM (a data attribute is a string). */
export const isStageCropHandle = (value: string | null | undefined): value is StageCropHandle =>
  value !== null && value !== undefined && (STAGE_CROP_HANDLES as readonly string[]).includes(value);

/**
 * Where each resize handle sits on a region, in the SAME space as the region.
 * The overlay draws from this table and the pointer reads its handle from the
 * drawn element, so the two can never disagree about which edge a handle owns.
 */
export const stageCropHandleCenters = (rect: StageCropRect): Record<StageCropHandle, CoordinatePoint> => {
  const left = rect.x;
  const right = rect.x + rect.width;
  const top = rect.y;
  const bottom = rect.y + rect.height;
  const midX = rect.x + rect.width / 2;
  const midY = rect.y + rect.height / 2;
  return {
    nw: { x: left, y: top },
    n: { x: midX, y: top },
    ne: { x: right, y: top },
    e: { x: right, y: midY },
    se: { x: right, y: bottom },
    s: { x: midX, y: bottom },
    sw: { x: left, y: bottom },
    w: { x: left, y: midY },
  };
};

/** The smallest region a crop may end up with, in stage units. */
export const MIN_STAGE_CROP_SIZE = 8;

const round = (value: number): number => Math.round(value);

/** An integer stage point, so a hand-drawn region lands on whole units. */
const asStageRect = (
  left: number,
  top: number,
  right: number,
  bottom: number,
): StageCropRect => ({
  x: round(left),
  y: round(top),
  width: round(right) - round(left),
  height: round(bottom) - round(top),
});

/**
 * Normalise a candidate region: finite numbers, non-negative size. Returns
 * `null` for anything that is not a usable rectangle.
 */
export const normalizeStageCropRect = (rect: StageCropRect | null | undefined): StageCropRect | null => {
  if (!rect) return null;
  const { x, y, width, height } = rect;
  if (![x, y, width, height].every(Number.isFinite)) return null;
  const normalized = {
    x: Math.min(x, x + width),
    y: Math.min(y, y + height),
    width: Math.abs(width),
    height: Math.abs(height),
  };
  if (normalized.width < MIN_STAGE_CROP_SIZE || normalized.height < MIN_STAGE_CROP_SIZE) return null;
  return normalized;
};

/**
 * Clamp a region into the stage and reject one that cannot hold a crop. The
 * intersection is taken before normalisation, so a region dragged past the
 * stage edge crops the part of it that is over the stage.
 */
export const clampStageCropRect = (
  rect: StageCropRect | null | undefined,
  resolution: ProjectResolution,
): StageCropRect | null => {
  const normalized = normalizeStageCropRect(rect);
  if (!normalized || resolution.width <= 0 || resolution.height <= 0) return null;
  const left = Math.max(0, normalized.x);
  const top = Math.max(0, normalized.y);
  const right = Math.min(resolution.width, normalized.x + normalized.width);
  const bottom = Math.min(resolution.height, normalized.y + normalized.height);
  if (right - left < MIN_STAGE_CROP_SIZE || bottom - top < MIN_STAGE_CROP_SIZE) return null;
  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
};

/** The stage a region crops to: its size IS the new project resolution. */
export const stageCropResolution = (rect: StageCropRect): ProjectResolution => ({
  width: rect.width,
  height: rect.height,
});

/** The uniform centre-relative shift the region applies to every top-level layer. */
export const stageCropShift = (rect: StageCropRect, resolution: ProjectResolution): StageCropShift => ({
  dx: resolution.width / 2 - rect.x - rect.width / 2,
  dy: resolution.height / 2 - rect.y - rect.height / 2,
});

/** True when the region IS the whole stage: cropping it would write nothing. */
export const isFullStageCropRect = (rect: StageCropRect, resolution: ProjectResolution): boolean =>
  Math.abs(rect.x) < 1e-6
  && Math.abs(rect.y) < 1e-6
  && Math.abs(rect.width - resolution.width) < 1e-6
  && Math.abs(rect.height - resolution.height) < 1e-6;

/** Is a stage-space point inside the region? (The pointer's move/resize test.) */
export const isStagePointInsideRect = (point: CoordinatePoint, rect: StageCropRect): boolean =>
  point.x >= rect.x && point.x <= rect.x + rect.width
  && point.y >= rect.y && point.y <= rect.y + rect.height;

/**
 * The region that encloses evaluated world bounds.
 *
 * The bounds come from the shared layout authority in the CENTRE-RELATIVE world
 * space (`getLayerWorldBounds`), so the conversion to stage space adds half the
 * stage. Edges round OUTWARD, so the measured content is always fully inside the
 * region it produced.
 */
export const stageCropRectFromWorldBounds = (
  bounds: PartWorldBounds,
  resolution: ProjectResolution,
): StageCropRect | null => {
  if (![bounds.minX, bounds.minY, bounds.maxX, bounds.maxY].every(Number.isFinite)) return null;
  const left = Math.floor(bounds.minX + resolution.width / 2);
  const top = Math.floor(bounds.minY + resolution.height / 2);
  const right = Math.ceil(bounds.maxX + resolution.width / 2);
  const bottom = Math.ceil(bounds.maxY + resolution.height / 2);
  return clampStageCropRect({ x: left, y: top, width: right - left, height: bottom - top }, resolution);
};

/** The region the pointer described from `anchor` to `pointer` (both stage space). */
export const stageCropRectFromDrag = (
  anchor: CoordinatePoint,
  pointer: CoordinatePoint,
  resolution: ProjectResolution,
): StageCropRect | null => {
  const rect = asStageRect(
    Math.min(anchor.x, pointer.x),
    Math.min(anchor.y, pointer.y),
    Math.max(anchor.x, pointer.x),
    Math.max(anchor.y, pointer.y),
  );
  return clampStageCropRect(rect, resolution);
};

/** The region translated by a stage-space delta, kept inside the stage. */
export const translateStageCropRect = (
  rect: StageCropRect,
  delta: CoordinatePoint,
  resolution: ProjectResolution,
): StageCropRect => {
  const x = Math.min(Math.max(0, rect.x + delta.x), Math.max(0, resolution.width - rect.width));
  const y = Math.min(Math.max(0, rect.y + delta.y), Math.max(0, resolution.height - rect.height));
  return { x: round(x), y: round(y), width: rect.width, height: rect.height };
};

/**
 * The region after dragging one handle to `point` (stage space).
 *
 * A handle moves the edges it owns and leaves the opposite edge exactly where it
 * is; the result is clamped into the stage and can never collapse below
 * `MIN_STAGE_CROP_SIZE` — a handle dragged past its opposite edge parks on the
 * minimum instead of flipping the region.
 */
export const resizeStageCropRect = (
  rect: StageCropRect,
  handle: StageCropHandle,
  point: CoordinatePoint,
  resolution: ProjectResolution,
): StageCropRect => {
  const left = rect.x;
  const top = rect.y;
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;
  const movesWest = handle === 'nw' || handle === 'w' || handle === 'sw';
  const movesEast = handle === 'ne' || handle === 'e' || handle === 'se';
  const movesNorth = handle === 'nw' || handle === 'n' || handle === 'ne';
  const movesSouth = handle === 'sw' || handle === 's' || handle === 'se';

  const nextLeft = movesWest
    ? Math.min(Math.max(0, round(point.x)), right - MIN_STAGE_CROP_SIZE)
    : left;
  const nextRight = movesEast
    ? Math.max(Math.min(resolution.width, round(point.x)), left + MIN_STAGE_CROP_SIZE)
    : right;
  const nextTop = movesNorth
    ? Math.min(Math.max(0, round(point.y)), bottom - MIN_STAGE_CROP_SIZE)
    : top;
  const nextBottom = movesSouth
    ? Math.max(Math.min(resolution.height, round(point.y)), top + MIN_STAGE_CROP_SIZE)
    : bottom;

  return {
    x: nextLeft,
    y: nextTop,
    width: nextRight - nextLeft,
    height: nextBottom - nextTop,
  };
};

// ─── Stage ⇄ editor-camera conversions ─────────────────────────────────────

/**
 * The editor camera draws the stage centred on `EDITOR_CAMERA_CENTER`, so the
 * two spaces differ by a translation. Both conversions are exposed together so
 * the overlay and the pointer can never disagree about the offset.
 */
export const stageSpaceToEditorRect = (
  rect: StageCropRect,
  resolution: ProjectResolution,
): StageCropRect => {
  const originX = EDITOR_CAMERA_CENTER.x - resolution.width / 2;
  const originY = EDITOR_CAMERA_CENTER.y - resolution.height / 2;
  return { x: originX + rect.x, y: originY + rect.y, width: rect.width, height: rect.height };
};

export const editorPointToStageSpace = (
  point: CoordinatePoint,
  resolution: ProjectResolution,
): CoordinatePoint => ({
  x: point.x - (EDITOR_CAMERA_CENTER.x - resolution.width / 2),
  y: point.y - (EDITOR_CAMERA_CENTER.y - resolution.height / 2),
});

// ─── The layers a crop moves ───────────────────────────────────────────────

/**
 * The layers a crop shifts: the TOP-LEVEL ones, resolved exactly as the
 * evaluator composes the hierarchy (`parentId ?? booleanGroupId`, and only when
 * that container actually exists). A layer whose container is named but absent
 * is composed against nothing by `evaluateTransform`, so it is top-level here
 * too — the crop must not leave it behind.
 */
export const resolveStageCropShiftRoots = (parts: CharacterPart[]): string[] =>
  parts
    .filter((part) => {
      const containerId = part.parentId ?? part.booleanGroupId;
      return !containerId || !parts.some((candidate) => candidate.id === containerId);
    })
    .map((part) => part.id);

/**
 * The same layers with every top-level position shifted by `shift`. Positions of
 * layers that live inside a container are untouched: their world place follows
 * the container they are expressed in.
 */
export const shiftStageCropLayers = (
  parts: CharacterPart[],
  rootIds: readonly string[],
  shift: StageCropShift,
): CharacterPart[] => {
  if (shift.dx === 0 && shift.dy === 0) return parts;
  const roots = new Set(rootIds);
  return parts.map((part) => (roots.has(part.id)
    ? {
        ...part,
        baseTransform: {
          ...part.baseTransform,
          x: part.baseTransform.x + shift.dx,
          y: part.baseTransform.y + shift.dy,
        },
      }
    : part));
};

/**
 * The same tracks with the position channels of the shifted layers moved by
 * `shift` — every sequence scope (`templateId`) and the legacy composite list,
 * so no frame of any authored sequence is left on the old origin.
 */
export const shiftStageCropTracks = (
  tracks: Track[],
  rootIds: readonly string[],
  shift: StageCropShift,
): Track[] => {
  if (shift.dx === 0 && shift.dy === 0) return tracks;
  const roots = new Set(rootIds);
  return tracks.map((track) => {
    if (!roots.has(track.partId)) return track;
    const channels = { ...track.channels };
    (['x', 'y'] as const).forEach((channel) => {
      const delta = channel === 'x' ? shift.dx : shift.dy;
      const keyframes = channels[channel];
      if (!keyframes || keyframes.length === 0) return;
      channels[channel] = keyframes.map((keyframe) => ({ ...keyframe, value: keyframe.value + delta }));
    });
    const legacy = track.keyframes;
    const keyframes = legacy && legacy.length > 0
      ? legacy.map((keyframe) => ({
          ...keyframe,
          transform: {
            ...keyframe.transform,
            x: keyframe.transform.x + shift.dx,
            y: keyframe.transform.y + shift.dy,
          },
        }))
      : legacy;
    return { ...track, channels, keyframes };
  });
};
