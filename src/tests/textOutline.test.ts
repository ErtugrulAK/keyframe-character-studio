import { describe, expect, it } from 'vitest';
import { traceBinaryMask, type BinaryMask } from '../utils/textOutline';

/**
 * The mask tracer behind a text Boolean operand. The rasteriser needs a canvas,
 * but the algorithm does not: these cases drive it directly with synthetic masks
 * so the part that decides "where is the outline, and which ring is a hole" is
 * pinned deterministically. A letter's counter is exactly the hole case here.
 */
const maskFromRows = (rows: string[]): BinaryMask => {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  const alpha = new Uint8Array(width * height);
  rows.forEach((row, y) => {
    for (let x = 0; x < width; x += 1) alpha[y * width + x] = row[x] === '#' ? 255 : 0;
  });
  return { width, height, alpha };
};

const ringAreas = (polygon: [number, number][][]): number[] => polygon.map((ring) => {
  let area = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const [x1, y1] = ring[index];
    const [x2, y2] = ring[(index + 1) % ring.length];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area) / 2;
});

const boundingBox = (ring: [number, number][]): { minX: number; minY: number; maxX: number; maxY: number } => ({
  minX: Math.min(...ring.map(([x]) => x)),
  minY: Math.min(...ring.map(([, y]) => y)),
  maxX: Math.max(...ring.map(([x]) => x)),
  maxY: Math.max(...ring.map(([, y]) => y)),
});

describe('text mask tracing', () => {
  it('traces an empty mask to no geometry', () => {
    expect(traceBinaryMask(maskFromRows(['....', '....']))).toEqual([]);
    expect(traceBinaryMask({ width: 0, height: 0, alpha: new Uint8Array(0) })).toEqual([]);
  });

  it('traces one solid block to a single exterior ring at its own bounds', () => {
    const polygons = traceBinaryMask(maskFromRows([
      '......',
      '.####.',
      '.####.',
      '.####.',
      '......',
    ]));

    expect(polygons).toHaveLength(1);
    expect(polygons[0]).toHaveLength(1);
    const ring = polygons[0][0];
    expect(ring.length).toBeGreaterThanOrEqual(4);
    expect(boundingBox(ring)).toEqual({ minX: 1, minY: 1, maxX: 5, maxY: 4 });
    expect(ringAreas(polygons[0])[0]).toBeCloseTo(4 * 3, 5);
  });

  it('keeps a counter a hole instead of a second region', () => {
    // A ring of pixels with a hole in the middle: the `o` case.
    const polygons = traceBinaryMask(maskFromRows([
      '.......',
      '.#####.',
      '.#...#.',
      '.#...#.',
      '.#####.',
      '.......',
    ]));

    expect(polygons).toHaveLength(1);
    expect(polygons[0]).toHaveLength(2); // exterior + hole
    const [exterior, hole] = ringAreas(polygons[0]);
    expect(exterior).toBeCloseTo(5 * 4, 5);
    expect(hole).toBeCloseTo(3 * 2, 5);
    const holeBox = boundingBox(polygons[0][1]);
    expect(holeBox.minX).toBeGreaterThan(1);
    expect(holeBox.maxX).toBeLessThan(6);
  });

  it('groups two separate glyphs as two regions', () => {
    const polygons = traceBinaryMask(maskFromRows([
      '.........',
      '.##...##.',
      '.##...##.',
      '.........',
    ]));

    expect(polygons).toHaveLength(2);
    expect(polygons.every((polygon) => polygon.length === 1)).toBe(true);
    const [left, right] = polygons.map((polygon) => boundingBox(polygon[0]));
    expect(left.maxX).toBeLessThanOrEqual(right.minX);
  });

  it('keeps an island inside a hole as its own region', () => {
    // The `8` case: exterior, hole, island.
    const polygons = traceBinaryMask(maskFromRows([
      '#######',
      '#.....#',
      '#.###.#',
      '#.#.#.#',
      '#.###.#',
      '#.....#',
      '#######',
    ]));

    expect(polygons).toHaveLength(2);
    expect(polygons[0]).toHaveLength(2); // the ring plus its counter
    expect(polygons[1]).toHaveLength(2); // the island plus its own counter
  });

  it('separates regions that touch only diagonally', () => {
    const polygons = traceBinaryMask(maskFromRows([
      '##..',
      '##..',
      '..##',
      '..##',
    ]));

    expect(polygons).toHaveLength(2);
    expect(polygons.every((polygon) => polygon.length === 1)).toBe(true);
  });

  it('is deterministic and does not depend on the scan order of equal inputs', () => {
    const rows = [
      '..###..',
      '.#...#.',
      '#..#..#',
      '.#...#.',
      '..###..',
    ];

    const first = traceBinaryMask(maskFromRows(rows));
    const second = traceBinaryMask(maskFromRows([...rows]));
    expect(second).toEqual(first);
  });

  it('simplifies a staircase inside the tolerance without moving the bounds', () => {
    const rows = ['#' + '.'.repeat(20)];
    for (let step = 1; step <= 20; step += 1) rows.push('#'.repeat(step + 1) + '.'.repeat(20 - step));
    const polygons = traceBinaryMask(maskFromRows(rows), 0.75);

    expect(polygons).toHaveLength(1);
    const ring = polygons[0][0];
    // A 45-degree staircase is one straight edge within the tolerance: far fewer
    // points than the 21x21 corners the raw boundary has.
    expect(ring.length).toBeLessThan(20);
    expect(boundingBox(ring)).toEqual({ minX: 0, minY: 0, maxX: 21, maxY: 21 });
  });
});
