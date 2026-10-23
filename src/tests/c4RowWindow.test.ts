import { describe, expect, it } from 'vitest';
import { fullRowWindow, planRowWindow, rowOffsets, rowWindowRange, type RowWindowSegment } from '../utils/rowWindow';

const mountedRows = (segments: RowWindowSegment[]): number[] => segments.flatMap((segment) => (
  segment.kind === 'rows' ? Array.from({ length: segment.end - segment.start }, (_, offset) => segment.start + offset) : []
));
const totalHeight = (segments: RowWindowSegment[], offsets: number[]): number => segments.reduce(
  (sum, segment) => sum + (segment.kind === 'gap' ? segment.height : offsets[segment.end] - offsets[segment.start]),
  0,
);

describe('C4 row window', () => {
  const offsets = rowOffsets(200, () => 24);

  it('accumulates row heights and ignores invalid ones', () => {
    expect(rowOffsets(3, (index) => [10, Number.NaN, 5][index])).toEqual([0, 10, 10, 15]);
    expect(offsets[200]).toBe(4800);
  });

  it('mounts the viewport plus the overscan, never beyond the list', () => {
    expect(rowWindowRange(offsets, 0, 240, 48)).toEqual({ start: 0, end: 13 });
    expect(rowWindowRange(offsets, 2400, 240, 0)).toEqual({ start: 100, end: 111 });
    expect(rowWindowRange(offsets, 4700, 240, 48)).toEqual({ start: 193, end: 200 });
    expect(rowWindowRange(rowOffsets(0, () => 24), 0, 240)).toEqual({ start: 0, end: 0 });
  });

  it('keeps the full height: every unmounted run is one spacer of exactly its rows', () => {
    const segments = planRowWindow(offsets, { start: 100, end: 111 }, []);
    expect(segments[0]).toEqual({ kind: 'gap', start: 0, end: 100, height: 2400 });
    expect(segments[1]).toEqual({ kind: 'rows', start: 100, end: 111 });
    expect(segments[2]).toEqual({ kind: 'gap', start: 111, end: 200, height: 89 * 24 });
    expect(totalHeight(segments, offsets)).toBe(4800);
  });

  it('mounts pinned rows in place, with spacers around them, in list order', () => {
    const segments = planRowWindow(offsets, { start: 100, end: 103 }, [199, 5, 101, -1, 400]);
    expect(mountedRows(segments)).toEqual([5, 100, 101, 102, 199]);
    expect(segments.map((segment) => segment.kind)).toEqual(['gap', 'rows', 'gap', 'rows', 'gap', 'rows']);
    expect(totalHeight(segments, offsets)).toBe(4800);
  });

  it('handles variable heights (expanded tracks) exactly', () => {
    const heights = Array.from({ length: 80 }, (_, index) => (index % 10 === 0 ? 30 + 6 * 24 : 30));
    const variable = rowOffsets(80, (index) => heights[index]);
    const range = rowWindowRange(variable, 900, 300, 0);
    const segments = planRowWindow(variable, range, [0]);
    expect(totalHeight(segments, variable)).toBe(variable[80]);
    const first = segments.find((segment) => segment.kind === 'rows' && segment.start > 0);
    expect(first && variable[first.start]).toBeLessThanOrEqual(900);
  });

  it('an unwindowed list is one run', () => {
    expect(fullRowWindow(3)).toEqual([{ kind: 'rows', start: 0, end: 3 }]);
    expect(fullRowWindow(0)).toEqual([]);
  });
});
