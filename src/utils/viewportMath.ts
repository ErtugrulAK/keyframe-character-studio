import type { BodyPartType, CharacterPart, Transform } from '../types/animator';
import { getPartBounds } from './bounds';
import { getShapeGeometry, type ShapeGeometry } from './shapeGeometry';
/** Pure viewport / canvas math for the Stage canvas. */
export const CANVAS_CENTER_X = 300;
export const CANVAS_CENTER_Y = 240;

export const clampZoom = (zoom: number): number => Math.min(3, Math.max(0.3, zoom));

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
): ShapeCreationBounds => {
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

export interface CursorAnchoredViewportInput {
  rect: { left: number; top: number; width: number; height: number };
  clientX: number;
  clientY: number;
  zoom: number;
  pan: { x: number; y: number };
  nextZoom: number;
  viewBox: { width: number; height: number };
}

export const getCursorAnchoredViewport = ({
  rect,
  clientX,
  clientY,
  zoom,
  pan,
  nextZoom,
  viewBox,
}: CursorAnchoredViewportInput): { zoom: number; pan: { x: number; y: number } } => {
  const baseScale = Math.min(rect.width / viewBox.width, rect.height / viewBox.height) || 1;
  const viewBoxX = (clientX - rect.left - (rect.width - viewBox.width * baseScale) / 2) / baseScale;
  const viewBoxY = (clientY - rect.top - (rect.height - viewBox.height * baseScale) / 2) / baseScale;
  const relX = viewBoxX - viewBox.width / 2;
  const relY = viewBoxY - viewBox.height / 2;
  return {
    zoom: nextZoom,
    pan: {
      x: pan.x + relX / nextZoom - relX / zoom,
      y: pan.y + relY / nextZoom - relY / zoom,
    },
  };
};

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

export interface EdgeScaleParams {
  dragMode: 'scale_right' | 'scale_left' | 'scale_top' | 'scale_bottom';
  halfW: number;
  halfH: number;
  deltaWorldX: number;
  deltaWorldY: number;
  rotation: number;
  initScaleX: number;
  initScaleY: number;
  initX: number;
  initY: number;
}

export const computeEdgeScale = ({
  dragMode, halfW, halfH, deltaWorldX, deltaWorldY, rotation, initScaleX, initScaleY, initX, initY,
}: EdgeScaleParams): { scaleX: number; scaleY: number; x: number; y: number } => {
  const { dxLocal, dyLocal, cosR, sinR } = getLocalDelta(deltaWorldX, deltaWorldY, rotation);
  let newScaleX = initScaleX;
  let newScaleY = initScaleY;
  let newX = initX;
  let newY = initY;
  if (dragMode === 'scale_right') {
    const value = Math.max(0.05, initScaleX + dxLocal / (2 * halfW));
    const delta = value - initScaleX;
    newScaleX = parseFloat(value.toFixed(2));
    newX = Math.round(initX + delta * halfW * cosR);
    newY = Math.round(initY + delta * halfW * sinR);
  } else if (dragMode === 'scale_left') {
    const value = Math.max(0.05, initScaleX - dxLocal / (2 * halfW));
    const delta = value - initScaleX;
    newScaleX = parseFloat(value.toFixed(2));
    newX = Math.round(initX - delta * halfW * cosR);
    newY = Math.round(initY - delta * halfW * sinR);
  } else if (dragMode === 'scale_bottom') {
    const value = Math.max(0.05, initScaleY + dyLocal / (2 * halfH));
    const delta = value - initScaleY;
    newScaleY = parseFloat(value.toFixed(2));
    newX = Math.round(initX - delta * halfH * sinR);
    newY = Math.round(initY + delta * halfH * cosR);
  } else if (dragMode === 'scale_top') {
    const value = Math.max(0.05, initScaleY - dyLocal / (2 * halfH));
    const delta = value - initScaleY;
    newScaleY = parseFloat(value.toFixed(2));
    newX = Math.round(initX + delta * halfH * sinR);
    newY = Math.round(initY - delta * halfH * cosR);
  }
  return { scaleX: newScaleX, scaleY: newScaleY, x: newX, y: newY };
};

export const getPartsInMarquee = (
  characterParts: CharacterPart[],
  getTransform: (partId: string) => Transform,
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
    const bounds = getPartBounds(part, t);
    const cx = canvasCenterX + t.x;
    const cy = canvasCenterY + t.y;
    const halfW = bounds.halfW * Math.abs(t.scaleX);
    const halfH = bounds.halfH * Math.abs(t.scaleY);
    const partLeft = cx - halfW;
    const partRight = cx + halfW;
    const partTop = cy - halfH;
    const partBottom = cy + halfH;
    if (partRight > marquee.x && partLeft < marquee.x + marquee.w && partBottom > marquee.y && partTop < marquee.y + marquee.h) {
      selected.push(part.id);
    }
  });
  return selected;
};
