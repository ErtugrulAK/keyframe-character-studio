import { describe, expect, it } from 'vitest';
import type { CharacterPart, Track } from '../types/animator';
import { makeEmptyChannels } from '../utils/defaults';
import { edgeScrollStep, laneGroupHeight, laneKeyframePositions, laneKeyframes, resolveLaneRows } from '../components/Timeline/timelineLaneLayout';
import { CHANNEL_ROW_HEIGHT, TRACK_ROW_HEIGHT } from '../components/Timeline/timelineConstants';
import { rowOffsets } from '../utils/rowWindow';
import { searchLayers } from '../utils/layerSearch';
import { editTargetText, resolveEditTarget, type EditTargetInput } from '../utils/editTarget';
import { deletionCommandLabel, describeDeletionScope } from '../utils/partDeletion';
import { pickedTrackMatte } from '../utils/trackMattePick';
import { resolveMatteSource } from '../utils/matte';
import { validateCritical } from '../utils/validateScene';

const part = (id: string, extra: Partial<CharacterPart> = {}): CharacterPart => ({
  id,
  name: id[0].toUpperCase() + id.slice(1),
  type: 'custom_rect',
  zIndex: 1,
  baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
  ...extra,
} as CharacterPart);

const key = (id: string, frame: number, value = 0) => ({ id, frame, value, easing: 'linear' as const });

const track = (partId: string, extra: Partial<Track> = {}): Track => ({
  id: `track-${partId}`, partId, name: partId, color: '#fff', keyframes: [], channels: makeEmptyChannels(), visible: true, locked: false, expanded: false, ...extra,
} as Track);

const allExpanded = (_key: string, defaultVal = true) => defaultVal;

describe('C5 timeline lane layout (the marquee hit-tests data, not mounted diamonds)', () => {
  it('a collapsed track is one layer row; an expanded one lists the property tree rows in order', () => {
    expect(resolveLaneRows(track('a'), allExpanded)).toEqual([{ kind: 'track' }]);
    const rows = resolveLaneRows(track('a', { expanded: true }), allExpanded);
    const names = (list: ReturnType<typeof resolveLaneRows>) => list.map((row) => (row.kind === 'channel' ? row.channel : row.kind === 'header' ? `[${row.group}]` : 'TRACK'));
    // C7 — Position, Scale, Rotation, Opacity (After Effects order); Scale
    // starts closed; no Trim Paths group on a layer that does not use it.
    expect(names(rows)).toEqual(['TRACK', '[position]', 'x', 'y', '[scale]', 'rotation', 'opacity']);
    expect(laneGroupHeight(track('a', { expanded: true }), allExpanded)).toBe(TRACK_ROW_HEIGHT + 6 * CHANNEL_ROW_HEIGHT);
    const everyGroupOpen = () => true;
    expect(names(resolveLaneRows(track('a', { expanded: true }), everyGroupOpen))).toEqual(['TRACK', '[position]', 'x', 'y', '[scale]', 'scaleX', 'scaleY', 'rotation', 'opacity']);
    // Trim Paths appears when the layer uses it, then one group per mask.
    const context = { trimPath: true, masks: [{ id: 'm1', name: 'Window' }] };
    expect(names(resolveLaneRows(track('a', { expanded: true }), everyGroupOpen, context))).toEqual([
      'TRACK', '[position]', 'x', 'y', '[scale]', 'scaleX', 'scaleY', 'rotation', 'opacity',
      '[trim]', 'trimPathStart', 'trimPathEnd', 'trimPathOffset',
      '[mask:m1]', 'm1:path', 'm1:feather', 'm1:opacity', 'm1:expansion',
    ]);
    // Defaults: Trim Paths open, mask groups closed (header only).
    expect(laneGroupHeight(track('a', { expanded: true }), allExpanded, context)).toBe(TRACK_ROW_HEIGHT + 11 * CHANNEL_ROW_HEIGHT);
    // Trim keys left on a layer that switched Trim Paths off stay reachable.
    const trimKeyed = track('a', { expanded: true, channels: { ...makeEmptyChannels(), trimPathEnd: [key('te', 4, 0.5)] } });
    expect(names(resolveLaneRows(trimKeyed, allExpanded))).toContain('[trim]');
  });

  it('a collapsed sub-group contributes no rows, so its keys are not selectable', () => {
    const collapsedPosition = (key: string, defaultVal = true) => (key.endsWith('_position') ? false : defaultVal);
    const channels = { ...makeEmptyChannels(), x: [key('kx', 10)], rotation: [key('kr', 20)] };
    const keys = laneKeyframes(track('a', { expanded: true, channels }), undefined, null, collapsedPosition);
    // The layer row shows one diamond per frame group (its first channel's key),
    // then the rotation row (position header, NO x/y rows, scale header —
    // closed by default — then rotation) holds kr; kx's own x row is collapsed away.
    expect(keys.map((keyframe) => [keyframe.id, keyframe.centerY])).toEqual([
      ['kx', TRACK_ROW_HEIGHT / 2],
      ['kr', TRACK_ROW_HEIGHT / 2],
      ['kr', TRACK_ROW_HEIGHT + 2 * CHANNEL_ROW_HEIGHT + CHANNEL_ROW_HEIGHT / 2],
    ]);
  });

  it('positions every key of every track (mounted or not) in content space', () => {
    const tracks = Array.from({ length: 150 }, (_, index) => track(`l${index}`, { channels: { ...makeEmptyChannels(), x: [key(`k${index}`, index % 30)] } }));
    const heightAt = (index: number) => laneGroupHeight(tracks[index], allExpanded);
    const positions = laneKeyframePositions(tracks, rowOffsets(tracks.length, heightAt), { x: 5, y: 28 }, 18, (candidate) => laneKeyframes(candidate, undefined, null, allExpanded));
    expect(positions).toHaveLength(150);
    const last = positions[149];
    expect(last).toEqual({ id: 'k149', x: 5 + (149 % 30) * 18, y: 28 + 149 * TRACK_ROW_HEIGHT + TRACK_ROW_HEIGHT / 2 });
  });

  it('edge auto-scroll is proportional at the edges and zero inside', () => {
    expect(edgeScrollStep(300, 100, 500)).toBe(0);
    expect(edgeScrollStep(110, 100, 500)).toBeLessThan(0);
    expect(edgeScrollStep(495, 100, 500)).toBeGreaterThan(0);
    expect(edgeScrollStep(5000, 100, 500)).toBe(24);
    expect(edgeScrollStep(-5000, 100, 500)).toBe(-24);
  });
});

describe('C5 layer search (scene data, not mounted rows)', () => {
  const parts = [
    part('group', { name: 'Hero Group', isGroup: true }),
    part('photo', { name: 'Photo Çerçeve', parentId: 'group' }),
    part('mask', { name: 'mask shape', parentId: 'photo' }),
    part('bg', { name: 'Background' }),
  ];

  it('an empty query is no search', () => {
    expect(searchLayers(parts, '   ')).toBeNull();
  });

  it('matches case- and accent-insensitively and keeps every ancestor for context', () => {
    const result = searchLayers(parts, 'cerceve');
    expect(result?.matchIds).toEqual(['photo']);
    expect([...(result?.shownIds ?? [])].sort()).toEqual(['group', 'photo']);
    const deep = searchLayers(parts, 'MASK');
    expect([...(deep?.shownIds ?? [])].sort()).toEqual(['group', 'mask', 'photo']);
    expect(searchLayers(parts, 'zzz')?.matchIds).toEqual([]);
  });
});

describe('C5 edit target (one answer for the strip and the Inspector)', () => {
  const parts = [part('photo', { name: 'Photo', masks: [{ id: 'm1', name: 'Mask 1', mode: 'add', path: { version: 1, coordinateSpace: 'normalized', closed: true, points: [] } }] } as Partial<CharacterPart>), part('circle', { name: 'Circle' })];
  const base: EditTargetInput = {
    characterParts: parts,
    selectedPartId: 'photo',
    selectedPartIds: ['photo'],
    maskEditTarget: null,
    maskDrawSession: null,
    matteReturnTargetId: null,
    activeTool: 'select',
    pendingShapeType: null,
    freeformPointCount: null,
  };

  it('names each mode distinctly', () => {
    expect(editTargetText(resolveEditTarget(base)!)).toBe('Layer · Photo');
    expect(editTargetText(resolveEditTarget({ ...base, lockedIds: new Set(['photo']) })!)).toBe('Layer · Photo · locked');
    expect(editTargetText(resolveEditTarget({ ...base, maskEditTarget: { ownerPartId: 'photo', maskId: 'm1' } })!)).toBe('Mask editing · Photo / Mask 1');
    expect(editTargetText(resolveEditTarget({ ...base, maskDrawSession: { ownerPartId: 'photo', shape: 'pen' } })!)).toBe('Drawing mask · Photo / Pen mask');
    expect(editTargetText(resolveEditTarget({ ...base, selectedPartId: 'circle', selectedPartIds: ['circle'], matteReturnTargetId: 'photo' })!)).toBe('Matte source · Circle · matte of Photo');
    expect(editTargetText(resolveEditTarget({ ...base, activeTool: 'shape_create', pendingShapeType: 'custom_rect' })!)).toBe('New shape · Rectangle · drag on the canvas');
    expect(editTargetText(resolveEditTarget({ ...base, activeTool: 'freeform_draw', freeformPointCount: 3 })!)).toBe('Drawing shape · Pen · 3 points');
    expect(editTargetText(resolveEditTarget({ ...base, selectedPartIds: ['photo', 'circle'] })!)).toBe('Layers · 2 selected · primary Photo');
    expect(resolveEditTarget({ ...base, selectedPartId: null, selectedPartIds: [] })).toBeNull();
  });

  it('the most specific session wins', () => {
    const both = resolveEditTarget({ ...base, maskEditTarget: { ownerPartId: 'photo', maskId: 'm1' }, matteReturnTargetId: 'circle' });
    expect(both?.kind).toBe('mask');
  });
});

describe('C5 delete scope: a group takes its layers, a parent keeps its children', () => {
  const parts = [
    part('group', { name: 'Group', isGroup: true }),
    part('a', { name: 'A', parentId: 'group' }),
    part('b', { name: 'B', parentId: 'group' }),
    part('parent', { name: 'Parent' }),
    part('child', { name: 'Child', parentId: 'parent' }),
    part('solo', { name: 'Solo' }),
  ];

  it('group: contents are deleted with it', () => {
    const scope = describeDeletionScope(parts, ['group']);
    expect(scope.ownedContents.map((p) => p.id)).toEqual(['a', 'b']);
    expect(scope.keptChildren).toEqual([]);
    expect(deletionCommandLabel(scope)).toBe('Delete Group and 2 Layers');
  });

  it('plain parent: children are kept', () => {
    const scope = describeDeletionScope(parts, ['parent']);
    expect(scope.ownedContents).toEqual([]);
    expect(scope.keptChildren.map((p) => p.id)).toEqual(['child']);
    expect(deletionCommandLabel(scope)).toBe('Delete (Keeps 1 Child)');
  });

  it('a plain layer is just Delete', () => {
    expect(deletionCommandLabel(describeDeletionScope(parts, ['solo']))).toBe('Delete');
  });
});

describe('C5 Track Matte authority: the pick-whip field is the one renderer, validator and navigation read', () => {
  it('trackMatte.sourceLayerId is the effective relationship and the validated one', () => {
    const target = part('target', { trackMatte: pickedTrackMatte(undefined, 'source'), matte: { sourcePartId: 'legacy', enabled: true } as CharacterPart['matte'] });
    // The V6 record wins over a legacy matte (renderer `getEffectiveMatte`, Outliner badge, navigation).
    expect(resolveMatteSource(target)).toEqual({ sourceId: 'source', kind: 'track' });
    // The validator reads the same field: a missing source and a cycle are reported from it.
    const missing = validateCritical({ layers: [{ id: 'target', trackMatte: { sourceLayerId: 'gone', enabled: true } }] });
    expect(missing.some((error) => error.message.includes('"gone"'))).toBe(true);
    const cycle = validateCritical({ layers: [
      { id: 'a', trackMatte: { sourceLayerId: 'b', enabled: true } },
      { id: 'b', trackMatte: { sourceLayerId: 'a', enabled: true } },
    ] });
    expect(cycle.length).toBeGreaterThan(0);
  });
});
