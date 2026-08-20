import type { CharacterPart, Transform } from '../types/animator';
import { getPartBounds } from './bounds';

/**
 * Pure viewport / canvas math for the Stage canvas.
 * Kept free of React dependencies so it stays independently testable.
 */

export const CANVAS_CENTER_X = 300;
export const CANVAS_CENTER_Y = 240;

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

/**
 * Computes the new transform while dragging a single edge of a part.
 * Keeps the opposite edge fixed and stretches only the dragged edge.
 */
export const computeEdgeScale = ({
  dragMode,
  halfW,
  halfH,
  deltaWorldX,
  deltaWorldY,
  rotation,
  initScaleX,
  initScaleY,
  initX,
  initY,
}: EdgeScaleParams): { scaleX: number; scaleY: number; x: number; y: number } => {
  const { dxLocal, dyLocal, cosR, sinR } = getLocalDelta(deltaWorldX, deltaWorldY, rotation);

  let newScaleX = initScaleX;
  let newScaleY = initScaleY;
  let newX = initX;
  let newY = initY;

  if (dragMode === 'scale_right') {
    // Keep Left edge fixed, stretch ONLY Right
    const newScaleXVal = Math.max(0.05, initScaleX + dxLocal / (2 * halfW));
    const deltaScaleX = newScaleXVal - initScaleX;
    newScaleX = parseFloat(newScaleXVal.toFixed(2));
    newX = Math.round(initX + deltaScaleX * halfW * cosR);
    newY = Math.round(initY + deltaScaleX * halfW * sinR);
  } else if (dragMode === 'scale_left') {
    // Keep Right edge fixed, stretch ONLY Left
    const newScaleXVal = Math.max(0.05, initScaleX - dxLocal / (2 * halfW));
    const deltaScaleX = newScaleXVal - initScaleX;
    newScaleX = parseFloat(newScaleXVal.toFixed(2));
    newX = Math.round(initX - deltaScaleX * halfW * cosR);
    newY = Math.round(initY - deltaScaleX * halfW * sinR);
  } else if (dragMode === 'scale_bottom') {
    // Keep Top edge fixed, stretch ONLY Bottom
    const newScaleYVal = Math.max(0.05, initScaleY + dyLocal / (2 * halfH));
    const deltaScaleY = newScaleYVal - initScaleY;
    newScaleY = parseFloat(newScaleYVal.toFixed(2));
    newX = Math.round(initX - deltaScaleY * halfH * sinR);
    newY = Math.round(initY + deltaScaleY * halfH * cosR);
  } else if (dragMode === 'scale_top') {
    // Keep Bottom edge fixed, stretch ONLY Top
    const newScaleYVal = Math.max(0.05, initScaleY - dyLocal / (2 * halfH));
    const deltaScaleY = newScaleYVal - initScaleY;
    newScaleY = parseFloat(newScaleYVal.toFixed(2));
    newX = Math.round(initX + deltaScaleY * halfH * sinR);
    newY = Math.round(initY - deltaScaleY * halfH * cosR);
  }

  return { scaleX: newScaleX, scaleY: newScaleY, x: newX, y: newY };
};

/**
 * Returns the ids of all parts intersecting the marquee rectangle.
 */
export const getPartsInMarquee = (
  characterParts: CharacterPart[],
  getTransform: (partId: string) => Transform,
  marquee: { x: number; y: number; w: number; h: number },
  canvasCenterX: number = CANVAS_CENTER_X,
  canvasCenterY: number = CANVAS_CENTER_Y
): string[] => {
  const selected: string[] = [];
  characterParts.forEach((part) => {
    const t = getTransform(part.id);
    if (!t) return;
    const bounds = getPartBounds(part, t);
    const cx = canvasCenterX + t.x;
    const cy = canvasCenterY + t.y;
    // Rough bounding box intersection
    const partLeft = cx - bounds.halfW * t.scaleX;
    const partRight = cx + bounds.halfW * t.scaleX;
    const partTop = cy - bounds.halfH * t.scaleY;
    const partBottom = cy + bounds.halfH * t.scaleY;

    if (
      partRight > marquee.x &&
      partLeft < marquee.x + marquee.w &&
      partBottom > marquee.y &&
      partTop < marquee.y + marquee.h
    ) {
      selected.push(part.id);
    }
  });
  return selected;
};
