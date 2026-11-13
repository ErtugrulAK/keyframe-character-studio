import { describe, expect, it } from 'vitest';
import type { Track } from '../types/animator';
import { makeEmptyChannels } from '../utils/animation/defaults';
import { resolveLaneRows } from '../components/Timeline/timelineLaneLayout';

const track = (channels: Partial<Track['channels']> = {}, extra: Partial<Track> = {}): Track => ({
  id: 't', partId: 'p', name: 'p', keyframes: [], expanded: true,
  channels: { ...makeEmptyChannels(), ...channels }, ...extra,
} as Track);
const key = (frame: number, value: number) => ({ id: `k${frame}`, frame, value, templateId: 'Sequence' });
const open = () => true;
/** The tree as indented labels, like the panel reads. */
const tree = (rows: ReturnType<typeof resolveLaneRows>) => rows.slice(1).map((row) => (
  row.kind === 'header' ? `${'  '.repeat(row.depth - 1)}▸ ${row.label}` : row.kind === 'channel' ? `${'  '.repeat(row.depth - 1)}${row.channel}` : ''
));

describe('timeline property tree, grouped like After Effects', () => {
  it('groups the transform properties under Transform, with Position and Scale inside', () => {
    expect(tree(resolveLaneRows(track(), open))).toEqual([
      '▸ Transform',
      '  ▸ Position',
      '    x',
      '    y',
      '  ▸ Scale',
      '    scaleX',
      '    scaleY',
      '  rotation',
      '  opacity',
    ]);
  });

  it('puts Trim Paths, Masks (one group per mask) and Track Matte before Transform', () => {
    const rows = resolveLaneRows(track(), open, { trimPath: true, trackMatte: true, masks: [{ id: 'm1', name: 'Mask 1' }] });
    const headers = tree(rows).filter((line) => line.includes('▸'));
    expect(headers).toEqual(['▸ Trim Paths', '▸ Masks', '  ▸ Mask 1', '▸ Track Matte', '▸ Transform', '  ▸ Position', '  ▸ Scale']);
  });

  it('closed groups hide their members; Scale and each mask start closed', () => {
    const closedByDefault = (key: string, fallback?: boolean) => fallback ?? false;
    const lines = tree(resolveLaneRows(track(), closedByDefault, { masks: [{ id: 'm1', name: 'Mask 1' }] }));
    expect(lines).toContain('  ▸ Scale');
    expect(lines).not.toContain('    scaleX');
    expect(lines).not.toContain('    m1:path');
  });

  it('Animated Only (U) shows just the properties whose keys change the value, and their groups', () => {
    // x moves; opacity has one key and y two equal keys (as the layer row's + leaves them): not animating.
    const animated = track({ x: [key(0, 0), key(10, 50)], y: [key(0, 5), key(10, 5)], opacity: [key(0, 1)], rotation: [key(0, 0), key(20, 90)] } as Partial<Track['channels']>);
    expect(tree(resolveLaneRows(animated, open, { animatedOnly: true, trimPath: true, masks: [{ id: 'm1', name: 'Mask 1' }] }))).toEqual([
      '▸ Transform',
      '  ▸ Position',
      '    x',
      '  rotation',
    ]);
  });
});
