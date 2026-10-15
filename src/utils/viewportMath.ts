import type { BodyPartType, CharacterPart, Transform } from '../types/animator';
import { getPartWorldBounds } from './bounds';
import type { WorldAffine } from './containerMath';
import { deriveBooleanGeometry } from './booleanGeometry';
import { getShapeGeometry, type ShapeGeometry } from './shapeGeometry';
import type { CoordinatePoint } from './projectCoordinates';
/** Pure viewport / canvas math for the Stage canvas. */
export const CANVAS_CENTER_X = 300;
export const CANVAS_CENTER_Y = 240;

export const clampZoom = (zoom: number): number => Math.min(3, Math.max(0.3, zoom));

export interface StageBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * THE camera model of the edit stage.
 *
 * A camera point (a viewBox point) is projected to client pixels as
 *   client = center + zoom * baseScale * (point - viewBox centre).
 *
 * `center` is the client position of the camera centre and `baseScale` is the
 * screen pixels per viewBox unit at zoom 1. Both are *camera* state: they are
 * captured when the camera is anchored and never derived from the stage box, so
 * panels and the timeline can resize the stage freely without moving or
 * rescaling the authored world. Only the stage fit (how the SVG element maps its
 * viewBox into its own box) depends on the layout, and the rendered transform
 * divides it back out.
 */
export interface StageCameraView {
  center: CoordinatePoint;
  baseScale: number;
}

/** Aspect-fit of the camera viewBox inside the stage box. */
export const getStageFitScale = (
  { width, height }: { width: number; height: number },
  viewBox: { width: number; height: number },
): number => Math.min(width / viewBox.width, height / viewBox.height) || 1;

export interface StageCameraTransformInput {
  view: StageCameraView;
  stage: StageBox;
  zoom: number;
  viewBox: { width: number; height: number };
}

/**
 * CSS transform applied to the stage SVG. `transform-origin` is the element
 * centre, so the translate is plain screen pixels and the scale divides out the
 * layout fit — the rendered magnification stays `zoom * baseScale`.
 */
export const getStageCameraTransform = ({
  view,
  stage,
  zoom,
  viewBox,
}: StageCameraTransformInput): { translateX: number; translateY: number; scale: number } => ({
  translateX: view.center.x - (stage.left + stage.width / 2),
  translateY: view.center.y - (stage.top + stage.height / 2),
  scale: (zoom * view.baseScale) / getStageFitScale(stage, viewBox),
});

export interface ClientToCameraPointInput {
  view: StageCameraView;
  clientX: number;
  clientY: number;
  zoom: number;
  viewBox: { width: number; height: number };
}

/** Fallback client-to-camera conversion for environments without screen CTM. */
export const clientToCameraPoint = ({
  view,
  clientX,
  clientY,
  zoom,
  viewBox,
}: ClientToCameraPointInput): CoordinatePoint => {
  const zoomScale = zoom * view.baseScale;
  return {
    x: viewBox.width / 2 + (clientX - view.center.x) / zoomScale,
    y: viewBox.height / 2 + (clientY - view.center.y) / zoomScale,
  };
};

export interface ShapeCreationBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

export interface ShapeCreationPlacement {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
}

export const getShapeCreationBounds = (
  start: { x: number; y: number },
  current: { x: number; y: number },
  constrainSquare = false,
): ShapeCreationBounds => {
  const deltaX = current.x - start.x;
  const deltaY = current.y - start.y;
  if (constrainSquare) {
    const size = Math.max(Math.abs(deltaX), Math.abs(deltaY));
    const endX = start.x + (deltaX < 0 ? -size : size);
    const endY = start.y + (deltaY < 0 ? -size : size);
    const minX = Math.min(start.x, endX);
    const minY = Math.min(start.y, endY);
    const maxX = Math.max(start.x, endX);
    const maxY = Math.max(start.y, endY);
    return {
      minX,
      minY,
      maxX,
      maxY,
      width: size,
      height: size,
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2,
    };
  }
  const minX = Math.min(start.x, current.x);
  const minY = Math.min(start.y, current.y);
  const maxX = Math.max(start.x, current.x);
  const maxY = Math.max(start.y, current.y);
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
};

const getGeometryBounds = (geometry: ShapeGeometry): { minX: number; minY: number; maxX: number; maxY: number } => {
  if (geometry.kind === 'rect') {
    return { minX: geometry.x, minY: geometry.y, maxX: geometry.x + geometry.width, maxY: geometry.y + geometry.height };
  }
  if (geometry.kind === 'circle') {
    return { minX: -geometry.r, minY: -geometry.r, maxX: geometry.r, maxY: geometry.r };
  }
  const xs = geometry.points.map((point) => point.x);
  const ys = geometry.points.map((point) => point.y);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
};

export const getShapeCreationPlacement = (
  type: BodyPartType,
  bounds: ShapeCreationBounds,
  canvasCenterX: number = CANVAS_CENTER_X,
  canvasCenterY: number = CANVAS_CENTER_Y,
): ShapeCreationPlacement | null => {
  const geometry = getShapeGeometry(type);
  if (!geometry) return null;
  const local = getGeometryBounds(geometry);
  const canonicalWidth = Math.max(0.001, local.maxX - local.minX);
  const canonicalHeight = Math.max(0.001, local.maxY - local.minY);
  const scaleX = bounds.width / canonicalWidth;
  const scaleY = bounds.height / canonicalHeight;
  const localCenterX = (local.minX + local.maxX) / 2;
  const localCenterY = (local.minY + local.maxY) / 2;
  return {
    x: bounds.centerX - canvasCenterX - localCenterX * scaleX,
    y: bounds.centerY - canvasCenterY - localCenterY * scaleY,
    scaleX,
    scaleY,
  };
};

export interface CursorAnchoredCameraInput {
  view: StageCameraView;
  clientX: number;
  clientY: number;
  zoom: number;
  nextZoom: number;
}

/**
 * Camera centre that keeps the camera point under the cursor while the zoom
 * changes. Derived from the camera model alone — never from the stage box — so
 * panel layout cannot influence the anchoring.
 */
export const getCursorAnchoredCameraCenter = ({
  view,
  clientX,
  clientY,
  zoom,
  nextZoom,
}: CursorAnchoredCameraInput): CoordinatePoint => {
  const zoomScale = zoom * view.baseScale;
  const offsetX = (clientX - view.center.x) / zoomScale;
  const offsetY = (clientY - view.center.y) / zoomScale;
  const nextZoomScale = nextZoom * view.baseScale;
  return { x: clientX - offsetX * nextZoomScale, y: clientY - offsetY * nextZoomScale };
};
export const getPointerDelta = (
  start: { x: number; y: number },
  current: { x: number; y: number },
): { dx: number; dy: number } => ({
  dx: current.x - start.x,
  dy: current.y - start.y,
});
export const getLocalDelta = (dx: number, dy: number, rotationDeg: number) => {
  const rad = (rotationDeg * Math.PI) / 180;
  const cosR = Math.cos(rad);
  const sinR = Math.sin(rad);
  return {
    dxLocal: dx * cosR + dy * sinR,
    dyLocal: -dx * sinR + dy * cosR,
    cosR,
    sinR,
  };
};

/**
 * Marquee hit-test. `getTransform` must return the EVALUATED world transform,
 * including the DERIVED affine a sheared nesting carries; the part bounds are
 * then mapped through `worldAffineOf` (bounds.ts), so a rotated child of an
 * anisotropically scaled container is hit exactly where it is drawn while a
 * shear-free pose keeps its historical bounds.
 */
export const getPartsInMarquee = (
  characterParts: CharacterPart[],
  getTransform: (partId: string) => Transform & { affine?: WorldAffine },
  marquee: { x: number; y: number; w: number; h: number },
  canvasCenterX: number = CANVAS_CENTER_X,
  canvasCenterY: number = CANVAS_CENTER_Y,
  isSelectable: (part: CharacterPart) => boolean = () => true,
): string[] => {
  const selected: string[] = [];
  characterParts.forEach((part) => {
    if (!isSelectable(part)) return;
    const t = getTransform(part.id);
    if (!t) return;
    const selectionPart = part.booleanOperandIds?.length && part.booleanOperation
      ? {
        ...part,
        booleanContours: deriveBooleanGeometry(
          part.booleanOperation,
          part.booleanOperandIds
            .map((operandId) => characterParts.find((candidate) => candidate.id === operandId))
            .filter((candidate): candidate is CharacterPart => Boolean(candidate)),
          Object.fromEntries(
            part.booleanOperandIds.map((operandId) => [operandId, getTransform(operandId)]),
          ),
          t,
        ).localContours,
      }
      : part;
    const bounds = getPartWorldBounds(selectionPart, t, canvasCenterX, canvasCenterY);
    const partLeft = bounds.minX;
    const partRight = bounds.maxX;
    const partTop = bounds.minY;
    const partBottom = bounds.maxY;
    if (partRight > marquee.x && partLeft < marquee.x + marquee.w && partBottom > marquee.y && partTop < marquee.y + marquee.h) {
      selected.push(part.id);
    }
  });
  return selected;
};
