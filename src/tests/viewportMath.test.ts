import { describe, expect, it } from 'vitest';
import type { CharacterPart, Transform } from '../types/animator';
import { clientToCameraPoint, getCursorAnchoredCameraCenter, getPartsInMarquee, getPointerDelta, getShapeCreationBounds, getShapeCreationPlacement, getStageCameraTransform, getStageFitScale, type StageBox } from '../utils/viewportMath';

const part = (id: string, overrides: Partial<CharacterPart> = {}): CharacterPart => ({
  id,
  name: id,
  type: 'custom_box',
  zIndex: 0,
  fillColor: '#fff',
  strokeColor: '#000',
  pivot: { x: 0, y: 0 },
  baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
  ...overrides,
});

describe('Canvas Interaction V1 viewport math', () => {
  it('keeps the camera point beneath the cursor stable during zoom', () => {
    const view = { center: { x: 518, y: 308 }, baseScale: 1.2 };
    const viewBox = { width: 600, height: 480 };
    const cursor = { x: 520, y: 320 };
    const center = getCursorAnchoredCameraCenter({
      view,
      clientX: cursor.x,
      clientY: cursor.y,
      zoom: 1,
      nextZoom: 1.5,
    });
    const before = clientToCameraPoint({ view, clientX: cursor.x, clientY: cursor.y, zoom: 1, viewBox });
    const after = clientToCameraPoint({ view: { ...view, center }, clientX: cursor.x, clientY: cursor.y, zoom: 1.5, viewBox });
    expect(after.x).toBeCloseTo(before.x, 10);
    expect(after.y).toBeCloseTo(before.y, 10);
  });

  it('selects negative-scale parts when they intersect the marquee', () => {
    const parts = [part('mirrored', { baseTransform: { x: 0, y: 0, rotation: 0, scaleX: -2, scaleY: 1, opacity: 1 } })];
    const transforms: Record<string, Transform> = { mirrored: { x: 0, y: 0, rotation: 0, scaleX: -2, scaleY: 1, opacity: 1 } };
    expect(getPartsInMarquee(parts, (id) => transforms[id], { x: 250, y: 225, w: 100, h: 100 })).toEqual(['mirrored']);
  });

  it('filters hidden or editor-invisible parts through the selection predicate', () => {
    const parts = [part('visible'), part('hidden')];
    const transform: Transform = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };
    expect(getPartsInMarquee(parts, () => transform, { x: 250, y: 225, w: 100, h: 100 }, 300, 240, (candidate) => candidate.id === 'visible')).toEqual(['visible']);
  });
  it.each([
    [{ x: 10, y: 20 }, { x: 110, y: 220 }],
    [{ x: 110, y: 220 }, { x: 10, y: 20 }],
    [{ x: 110, y: 20 }, { x: 10, y: 220 }],
    [{ x: 10, y: 220 }, { x: 110, y: 20 }],
  ])('normalizes shape creation bounds in every drag direction', (start, current) => {
    const bounds = getShapeCreationBounds(start, current);
    expect(bounds).toMatchObject({ minX: 10, minY: 20, maxX: 110, maxY: 220, width: 100, height: 200, centerX: 60, centerY: 120 });
  });

  it('keeps cursor points stable at edges and through repeated zoom changes', () => {
    const viewBox = { width: 600, height: 480 };
    const cursors = [
      { x: 520, y: 380 },
      { x: 40, y: 50 },
      { x: 990, y: 680 },
    ];
    for (const cursor of cursors) {
      let state = { zoom: 0.8, view: { center: { x: 640, y: 420 }, baseScale: 1.1 } };
      for (const nextZoom of [1.1, 1.6, 0.7, 1.3]) {
        const before = clientToCameraPoint({ view: state.view, clientX: cursor.x, clientY: cursor.y, zoom: state.zoom, viewBox });
        const center = getCursorAnchoredCameraCenter({
          view: state.view,
          clientX: cursor.x,
          clientY: cursor.y,
          zoom: state.zoom,
          nextZoom,
        });
        const after = clientToCameraPoint({ view: { ...state.view, center }, clientX: cursor.x, clientY: cursor.y, zoom: nextZoom, viewBox });
        expect(after.x).toBeCloseTo(before.x, 8);
        expect(after.y).toBeCloseTo(before.y, 8);
        state = { zoom: nextZoom, view: { ...state.view, center } };
      }
    }
  });

  it.each([
    [{ x: 10, y: 20 }, { x: 110, y: 60 }],
    [{ x: 110, y: 60 }, { x: 10, y: 20 }],
    [{ x: 110, y: 20 }, { x: 10, y: 60 }],
    [{ x: 10, y: 60 }, { x: 110, y: 20 }],
  ])('constrains square creation bounds in every drag direction', (start, current) => {
    const bounds = getShapeCreationBounds(start, current, true);
    expect(bounds.width).toBe(bounds.height);
    expect(bounds.width).toBe(100);
  });

  it('preserves pointer-derived deltas near former snap thresholds', () => {
    expect(getPointerDelta({ x: 0, y: 0 }, { x: 5, y: -4 })).toEqual({ dx: 5, dy: -4 });
    expect(getPointerDelta({ x: 0, y: 0 }, { x: 7.9, y: 8.1 })).toEqual({ dx: 7.9, dy: 8.1 });
  });


  it('derives rectangle, circle and asymmetric polygon placement from canonical bounds', () => {
    const bounds = getShapeCreationBounds({ x: 200, y: 140 }, { x: 400, y: 340 });
    expect(getShapeCreationPlacement('custom_rect', bounds)).toEqual({ x: 0, y: 0, scaleX: 5 / 3, scaleY: 10 / 3 });
    expect(getShapeCreationPlacement('custom_circle', bounds)).toEqual({ x: 0, y: 0, scaleX: 10 / 3, scaleY: 10 / 3 });
    const parallelogram = getShapeCreationPlacement('custom_parallelogram', bounds);
    expect(parallelogram?.scaleX).toBeCloseTo(200 / 170, 8);
    expect(parallelogram?.scaleY).toBeCloseTo(200 / 60, 8);
    expect(parallelogram?.x).toBeCloseTo(0, 8);
    expect(parallelogram?.y).toBeCloseTo(0, 8);
  });

  it('inverts client coordinates through the camera zoom and base scale', () => {
    const view = { center: { x: 543, y: 371 }, baseScale: 0.86 };
    const viewBox = { width: 600, height: 480 };
    const zoom = 1.5;
    const point = { x: 420, y: 300 };
    const client = {
      x: view.center.x + (point.x - viewBox.width / 2) * view.baseScale * zoom,
      y: view.center.y + (point.y - viewBox.height / 2) * view.baseScale * zoom,
    };

    expect(clientToCameraPoint({
      view,
      clientX: client.x,
      clientY: client.y,
      zoom,
      viewBox,
    })).toMatchObject({
      x: expect.closeTo(point.x, 8),
      y: expect.closeTo(point.y, 8),
    });
  });

  it('renders a camera point at the same client position when the stage box changes', () => {
    const view = { center: { x: 600, y: 400 }, baseScale: 0.7 };
    const viewBox = { width: 600, height: 480 };
    const zoom = 1.5;
    const point = { x: 240, y: 180 };
    const project = (stage: StageBox) => {
      const transform = getStageCameraTransform({ view, stage, zoom, viewBox });
      const renderedScale = transform.scale * getStageFitScale(stage, viewBox);
      return {
        x: stage.left + stage.width / 2 + transform.translateX + renderedScale * (point.x - viewBox.width / 2),
        y: stage.top + stage.height / 2 + transform.translateY + renderedScale * (point.y - viewBox.height / 2),
      };
    };

    const before = project({ left: 336, top: 79, width: 584, height: 321 });
    // Inspector closed, then left toolbar collapsed, then timeline collapsed.
    const wider = project({ left: 336, top: 79, width: 944, height: 321 });
    const leftShifted = project({ left: 0, top: 79, width: 920, height: 321 });
    const taller = project({ left: 336, top: 79, width: 584, height: 491 });
    for (const stage of [wider, leftShifted, taller]) {
      expect(stage.x).toBeCloseTo(before.x, 10);
      expect(stage.y).toBeCloseTo(before.y, 10);
    }
    // The rendered position is exactly the camera model, not a layout fit.
    expect(before.x).toBeCloseTo(view.center.x + (point.x - viewBox.width / 2) * view.baseScale * zoom, 10);
    expect(before.y).toBeCloseTo(view.center.y + (point.y - viewBox.height / 2) * view.baseScale * zoom, 10);
  });
});
