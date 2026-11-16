import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { CharacterPart } from '../types/animator';
import type { SceneData, SceneLayer } from '../types/composition';
import { renderShapePart } from '../components/Canvas/renderers/parts/ShapePartRenderers';
import { evaluateOGrafScene } from '../ograf/evaluation';
import { compileOGrafPackage } from '../ograf/packageCompiler';
import { renderOGrafSvg } from '../ograf/svgRenderer';
import { getShapeGeometry } from '../utils/geometry/shapeGeometry';
import { getPartLocalBounds } from '../utils/geometry/bounds';
import { isPolygonShape, normalizePolygonShape, polygonShapePoints } from '../utils/geometry/polygonShape';
import { validateImportedDocument } from '../utils/persistence/importValidation';
import { onAir } from './helpers/ografOnAir';

const extent = (points: Array<{ x: number; y: number }>) => ({
  minX: Math.min(...points.map((point) => point.x)),
  maxX: Math.max(...points.map((point) => point.x)),
  minY: Math.min(...points.map((point) => point.y)),
  maxY: Math.max(...points.map((point) => point.y)),
});

describe('the Polygon outline', () => {
  it('has one corner per side, or two per point for a star, the first at the top', () => {
    expect(polygonShapePoints({ sides: 6 })).toHaveLength(6);
    expect(polygonShapePoints({ sides: 6, innerRatio: 0.5 })).toHaveLength(12);
    const [top] = polygonShapePoints({ sides: 5 });
    expect(top).toEqual({ x: 0, y: -35 });
    // Absent settings: a pentagon.
    expect(polygonShapePoints(undefined)).toEqual(polygonShapePoints({ sides: 5 }));
  });

  it.each([3, 4, 5, 8, 24])('fills the same 70 x 70 box with %i corners, as a polygon and as a star', (sides) => {
    for (const innerRatio of [1, 0.4]) {
      expect(extent(polygonShapePoints({ sides, innerRatio }))).toEqual({ minX: -35, maxX: 35, minY: -35, maxY: 35 });
    }
  });

  it('a star\'s inner corners sit at the inner radius', () => {
    const points = polygonShapePoints({ sides: 4, innerRatio: 0.5 });
    // Four points: the inner corners lie on the diagonals, half way out (the box
    // fit is 1:1 here). Corners are stored to 0.001, so each coordinate may be
    // off by up to 0.0005.
    expect(Math.hypot(points[1].x, points[1].y)).toBeCloseTo(17.5, 2);
  });

  it('settings out of range are read in range; stored values are checked strictly', () => {
    expect(normalizePolygonShape({ sides: 2.4, innerRatio: 0 })).toEqual({ sides: 3, innerRatio: 0.1 });
    expect(normalizePolygonShape({ sides: 99, innerRatio: 4 })).toEqual({ sides: 24, innerRatio: 1 });
    expect(normalizePolygonShape({ sides: 'six' as unknown as number })).toEqual({ sides: 5, innerRatio: 1 });
    expect(isPolygonShape({ sides: 6 })).toBe(true);
    expect(isPolygonShape({ sides: 6, innerRatio: 0.5 })).toBe(true);
    for (const value of [{ sides: 2 }, { sides: 25 }, { sides: 6, innerRatio: 0 }, { sides: 6, innerRatio: 1.5 }, { sides: '6' }, null, [6]]) {
      expect(isPolygonShape(value)).toBe(false);
    }
  });

  it('the shape table and the layer bounds read the layer\'s settings; without them the box is the same', () => {
    const hexagon = { polygon: { sides: 6 } };
    expect(getShapeGeometry('custom_polygon', hexagon)).toEqual({ kind: 'polygon', points: polygonShapePoints({ sides: 6 }) });
    const part = { id: 'p', type: 'custom_polygon', polygon: { sides: 3, innerRatio: 0.3 }, baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } } as unknown as CharacterPart;
    const bounds = getPartLocalBounds(part);
    expect(bounds).toMatchObject({ minX: -35, maxX: 35, minY: -35, maxY: 35 });
  });
});

const polygonLayer = (polygon: SceneLayer['polygon']): SceneLayer => ({
  id: 'poly', name: 'Polygon', type: 'custom_polygon',
  x: 10, y: -20, rotation: 0, scaleX: 2, scaleY: 2, opacity: 1, visible: true, zIndex: 1,
  fillColor: '#33aaff', fillEnabled: true, strokeEnabled: false, strokeColor: '#000000',
  ...(polygon ? { polygon } : {}),
} as SceneLayer);

const sceneWith = (layer: SceneLayer): SceneData => ({
  version: 2, coordinateSystem: 'project-unit-center-v1', name: 'Polygon', width: 640, height: 360, fps: 30, totalFrames: 30,
  layers: [layer], tracks: [],
});

/** The `points` of the first polygon drawn for the layer `id` in this markup. */
const pointsIn = (markup: string, id: string): string | undefined => {
  const at = markup.indexOf(`data-layer-id="${id}"`);
  const from = at < 0 ? markup : markup.slice(at);
  return /<polygon[^>]*\spoints="([^"]+)"/u.exec(from)?.[1];
};
const numbers = (points: string | undefined) => (points ?? '').trim().split(/[\s,]+/u).map(Number);

type GeneratedGraphic = HTMLElement & {
  _currentFrame: number;
  _render: () => void;
  load: (params: { renderType: 'realtime'; data?: unknown }) => Promise<Record<string, unknown>>;
  dispose: () => Promise<Record<string, unknown>>;
};
let counter = 0;
function instantiateGraphic(source: string): GeneratedGraphic {
  const Graphic = new Function('HTMLElement', `${source.replace('export default class Graphic', 'return class Graphic').replaceAll('import.meta.url', 'location.href')}`)(HTMLElement) as unknown as new () => GeneratedGraphic;
  counter += 1;
  const tagName = `x-polygon-parity-${counter}`;
  customElements.define(tagName, Graphic);
  return document.createElement(tagName) as GeneratedGraphic;
}

describe('a Polygon is drawn the same everywhere', () => {
  it.each([
    ['a hexagon', { sides: 6 }],
    ['a seven-point star', { sides: 7, innerRatio: 0.45 }],
    ['no settings (a pentagon)', undefined],
  ])('%s: the editor, the static SVG and the OGraf runtime draw the same corners', async (_label, polygon) => {
    const expected = polygonShapePoints(polygon).flatMap((point) => [point.x, point.y]);

    const part = { id: 'poly', type: 'custom_polygon', ...(polygon ? { polygon } : {}), fillColor: '#33aaff', strokeColor: '#000000', baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } } as unknown as CharacterPart;
    const editor = render(<svg>{renderShapePart({ part, fill: '#33aaff', stroke: '#000000', isSelected: false, isGhost: false })}</svg>);
    const drawn = editor.container.querySelector('polygon')?.getAttribute('points');
    expect(numbers(drawn ?? undefined)).toEqual(expected);
    editor.unmount();

    const authored = sceneWith(polygonLayer(polygon));
    expect(numbers(pointsIn(renderOGrafSvg(evaluateOGrafScene(authored, 0)), 'poly'))).toEqual(expected);

    const plan = compileOGrafPackage(authored);
    expect(plan.status).toBe('ready-to-materialize');
    const graphic = instantiateGraphic(plan.files.find((file) => file.path === 'graphic.mjs')?.content || '');
    await graphic.load({ renderType: 'realtime', data: {} });
    await onAir(graphic);
    graphic._currentFrame = 0;
    graphic._render();
    expect(numbers(pointsIn(graphic.innerHTML, 'poly'))).toEqual(expected);
    await graphic.dispose();
  });

  it('saved settings open again; malformed ones are refused whole', () => {
    expect(validateImportedDocument(JSON.stringify(sceneWith(polygonLayer({ sides: 8, innerRatio: 0.6 })))).ok).toBe(true);
    for (const polygon of [{ sides: 1 }, { sides: 6, innerRatio: -1 }, 'hexagon', { innerRatio: 0.5 }]) {
      const refused = validateImportedDocument(JSON.stringify(sceneWith(polygonLayer(polygon as SceneLayer['polygon']))));
      expect(refused.ok).toBe(false);
    }
  });
});
