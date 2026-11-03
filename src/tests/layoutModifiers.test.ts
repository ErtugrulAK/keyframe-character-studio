import { describe, expect, it } from 'vitest';
import { applyLayoutToParts, applyLayoutToScene, compensateLayoutChange, limitLength, resolveLayout } from '../utils/layers/layoutModifiers';
import { planPartDeletion } from '../utils/layers/partDeletion';

// 10 px per character at size 20 (0.5 em), linear in the size.
const measure = (text: string, size: number) => Array.from(text).length * size * 0.5;
const text = (textValue: string, extra: Record<string, unknown> = {}) => ({ id: 'title', type: 'custom_text', textValue, fontSize: 20, ...extra });
const bar = (extra: Record<string, unknown> = {}) => ({ id: 'bar', type: 'custom_rect', fitToText: { textLayerId: 'title', padding: 10, maxWidth: 220 }, ...extra });
const pose = (layer: Record<string, unknown>) => ({ x: (layer.x as number) ?? 0, y: (layer.y as number) ?? 0, rotation: (layer.rotation as number) ?? 0, scaleX: (layer.scaleX as number) ?? 1, scaleY: (layer.scaleY as number) ?? 1 });
const layout = (layers: Array<Record<string, unknown>>) => resolveLayout(layers as never, pose as never, measure);

describe('text box and auto size', () => {
  it('a short text keeps its size and the shape hugs it with its padding', () => {
    const { adjustments } = layout([text('Hi'), bar()]);
    expect(adjustments.title).toBeUndefined();
    // 20 px of text + 2 x 10 padding = 40 px on a 120 px primitive.
    expect(adjustments.bar.scaleXFactor).toBeCloseTo(40 / 120);
  });

  it('past the max width the text shrinks and the shape stops growing', () => {
    // 30 chars = 300 px; room = 220 - 20 = 200 px -> size 20 * 200/300.
    const { adjustments } = layout([text('x'.repeat(30)), bar()]);
    expect(adjustments.title.fontSize).toBeCloseTo(20 * (200 / 300));
    expect(adjustments.title.scaleXFactor).toBeUndefined();
    expect(adjustments.bar.scaleXFactor).toBeCloseTo(220 / 120);
  });

  it('stops at the min size, then squeezes so the text never leaves the box', () => {
    // 80 chars = 800 px; min 50 % -> 400 px > 200 px room -> squeeze 0.5.
    const { adjustments } = layout([text('x'.repeat(80)), bar()]);
    expect(adjustments.title.fontSize).toBe(10);
    expect(adjustments.title.scaleXFactor).toBeCloseTo(0.5);
    expect(adjustments.bar.scaleXFactor).toBeCloseTo(220 / 120);
  });

  it('caps the characters, and honours the shape min width', () => {
    const { adjustments } = layout([text('abcdef', { textFit: { maxLength: 3 } }), bar({ fitToText: { textLayerId: 'title', padding: 10, minWidth: 120 } })]);
    expect(adjustments.title.textValue).toBe('abc');
    expect(adjustments.bar).toBeUndefined(); // 120 px = the primitive width: nothing to change
    expect(limitLength('🙂🙂🙂', 2)).toBe('🙂🙂');
  });

  it('applies to SceneData: base scaleX and every scaleX key keep the reveal proportions', () => {
    const scene = {
      layers: [{ ...text('Hi'), scaleX: 1 }, { ...bar(), scaleX: 2 }],
      tracks: [{ partId: 'bar', channels: { scaleX: [{ frame: 0, value: 0 }, { frame: 10, value: 2 }] } }],
    };
    const fitted = applyLayoutToScene(scene, measure);
    const factor = 40 / 240;
    expect(fitted.layers[1].scaleX).toBeCloseTo(2 * factor);
    expect((fitted.tracks![0].channels!.scaleX as Array<{ value: number }>).map((key) => key.value)).toEqual([0, 2 * factor]);
    // Nothing to lay out: the same object.
    const plain = { layers: [{ id: 'a', type: 'custom_rect', scaleX: 1 }], tracks: [] };
    expect(applyLayoutToScene(plain, measure)).toBe(plain);
  });

  it('a left or right aligned text keeps that edge on its x, along its own turn', () => {
    expect(layout([text('Hello', { textFit: { align: 'left' } })]).adjustments.title.dx).toBeCloseTo(25);
    expect(layout([text('Hello', { textFit: { align: 'right' } })]).adjustments.title.dx).toBeCloseTo(-25);
    const turned = layout([text('Hello', { rotation: 90, textFit: { align: 'left' } })]).adjustments.title;
    expect(turned.dx ?? 0).toBeCloseTo(0);
    expect(turned.dy).toBeCloseTo(25);
  });

  it('a shape that grows from its left edge keeps that edge in place', () => {
    // A 240 px bar (scale 2) hugging 20 px of text: 40 px wide, its left edge still at -120.
    const { adjustments } = layout([text('Hi'), bar({ scaleX: 2, fitToText: { textLayerId: 'title', padding: 10, anchor: 'left' } })]);
    expect(adjustments.bar.scaleXFactor).toBeCloseTo(40 / 240);
    expect(adjustments.bar.dx).toBeCloseTo(-100);
    const right = layout([text('Hi'), bar({ scaleX: 2, fitToText: { textLayerId: 'title', padding: 10, anchor: 'right' } })]).adjustments;
    expect(right.bar.dx).toBeCloseTo(100);
  });

  it('an empty text with Hide When Empty hides itself and the shapes sized to it', () => {
    const { adjustments } = layout([text('  ', { textFit: { hideWhenEmpty: true } }), bar()]);
    expect(adjustments.title.hidden).toBe(true);
    expect(adjustments.bar.hidden).toBe(true);
    const scene = applyLayoutToScene({
      layers: [{ ...text('', { textFit: { hideWhenEmpty: true } }), opacity: 1 }],
      tracks: [{ partId: 'title', channels: { opacity: [{ frame: 0, value: 0 }, { frame: 5, value: 1 }] } }],
    }, measure);
    expect(scene.layers[0].opacity).toBe(0);
    expect((scene.tracks![0].channels!.opacity as Array<{ value: number }>).map((key) => key.value)).toEqual([0, 0]);
    // Not empty: shown as usual.
    expect(layout([text('On', { textFit: { hideWhenEmpty: true } }), bar()]).adjustments.title).toBeUndefined();
  });
});

describe('auto follow', () => {
  // A 60 px box whose x is its gap to the text's edge.
  const tag = (extra: Record<string, unknown> = {}) => ({ id: 'tag', type: 'custom_box', x: 8, follow: { targetLayerId: 'title' }, ...extra });

  it("sits right of the target's edge, its x the gap, and moves as the text grows", () => {
    // "Hi" is 20 px: its right edge at 10; the box's left edge at 10 + 8.
    expect(layout([text('Hi'), tag()]).adjustments.tag.dx).toBeCloseTo(10 + 30);
    expect(layout([text('Hello'), tag()]).adjustments.tag.dx).toBeCloseTo(25 + 30);
    // Left of it: its right edge at the text's left edge plus x.
    expect(layout([text('Hi'), tag({ x: -8, follow: { targetLayerId: 'title', side: 'left' } })]).adjustments.tag.dx).toBeCloseTo(-10 - 30);
  });

  it('follows a laid-out target, through a chain, and leaves a cycle or another parent alone', () => {
    // The bar (40 px wide after sizing, centred on 0) ends at 20.
    const sized = layout([text('Hi'), bar(), tag({ follow: { targetLayerId: 'bar' } })]).adjustments;
    expect(sized.tag.dx).toBeCloseTo(20 + 30);
    // A chain: the second box follows the first, whose own edge moved.
    const chain = layout([text('Hi'), tag({ x: 0 }), { id: 'tag2', type: 'custom_box', x: 0, follow: { targetLayerId: 'tag' } }]).adjustments;
    expect(chain.tag.dx).toBeCloseTo(40);
    expect(chain.tag2.dx).toBeCloseTo(40 + 30 + 30);
    const cycle = layout([{ id: 'a', type: 'custom_box', follow: { targetLayerId: 'b' } }, { id: 'b', type: 'custom_box', follow: { targetLayerId: 'a' } }]).adjustments;
    expect(cycle).toEqual({});
    expect(layout([text('Hi'), tag({ parentId: 'group' })]).adjustments.tag).toBeUndefined();
  });

  it('a hidden target collapses to its x, so the follower takes its place', () => {
    expect(layout([text('', { textFit: { hideWhenEmpty: true } }), tag()]).adjustments.tag.dx).toBeCloseTo(30);
  });
});

describe('justify', () => {
  const group = (horizontal: string) => ({ id: 'group', type: 'custom_box', isGroup: true, justify: { horizontal } });
  // "Hi" spans -10..10 and a 60 px box at 100 spans 70..130: together -10..130.
  const children = [text('Hi', { parentId: 'group' }), { id: 'box', type: 'custom_box', x: 100, parentId: 'group' }];

  it("keeps the children's combined bounds centred, left or right on the group's origin", () => {
    expect(layout([group('center'), ...children]).adjustments.box.dx).toBeCloseTo(-60);
    expect(layout([group('left'), ...children]).adjustments.title.dx).toBeCloseTo(10);
    const right = layout([group('right'), ...children]);
    expect(right.adjustments.box.dx).toBeCloseTo(-130);
    expect(right.justifyShifts.group).toBeCloseTo(-130);
  });

  it('leaves a hidden child out of the bounds', () => {
    const hidden = layout([group('left'), text('', { parentId: 'group', textFit: { hideWhenEmpty: true } }), { id: 'box', type: 'custom_box', x: 100, parentId: 'group' }]);
    expect(hidden.adjustments.box.dx).toBeCloseTo(-70);
  });
});

describe('repeater', () => {
  it('copies a layer in a line, each a step further, behind the layer', () => {
    const scene = applyLayoutToScene({
      layers: [{ id: 'dot', type: 'custom_circle', name: 'Dot', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, zIndex: 1, repeater: { count: 3, offsetX: 50, rotation: 10, scale: 0.5, fade: 0.25, delay: 5 } }],
      tracks: [{ id: 't', partId: 'dot', channels: { x: [{ frame: 0, value: 0 }, { frame: 10, value: 20 }] } }],
    }, measure);
    expect(scene.layers.map((layer) => layer.id)).toEqual(['dot__copy2', 'dot__copy1', 'dot']);
    const first = scene.layers[1];
    expect(first).toMatchObject({ x: 50, rotation: 10, scaleX: 0.5, scaleY: 0.5, opacity: 0.75, repeatSourceId: 'dot', name: 'Dot 2' });
    expect(scene.layers[0]).toMatchObject({ x: 100, rotation: 20, scaleX: 0.25, opacity: 0.5 });
    expect(first.repeater).toBeUndefined();
    const copyTrack = scene.tracks!.find((track) => track.partId === 'dot__copy1')!;
    expect(copyTrack.id).toBe('t__copy1');
    expect(copyTrack.channels!.x).toEqual([{ frame: 5, value: 50 }, { frame: 15, value: 70 }]);
  });

  it('lays copies out in a grid or a ring centred on the layer', () => {
    const grid = layout([{ id: 'dot', type: 'custom_circle', repeater: { count: 4, layout: 'grid', columns: 2, offsetX: 10, offsetY: 20 } }]);
    expect(grid.copies.map((copy) => [copy.dx, copy.dy])).toEqual([[10, 0], [0, 20], [10, 20]]);
    const ring = layout([{ id: 'dot', type: 'custom_circle', repeater: { count: 4, layout: 'radial', radius: 100 } }]);
    // The layer itself is the ring's top.
    expect(ring.adjustments.dot.dy).toBeCloseTo(-100);
    expect(ring.copies[0].dx).toBeCloseTo(100);
    expect(ring.copies[0].dy).toBeCloseTo(100);
  });

  it('marks copies in the editor so the stage picks the layer they repeat', () => {
    const parts = [{ id: 'dot', type: 'custom_circle', name: 'Dot', zIndex: 1, baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }, repeater: { count: 2, offsetX: 40 } }];
    const laid = applyLayoutToParts(parts as never, [] as never, measure);
    expect((laid.parts as Array<{ id: string; repeatSourceId?: string; baseTransform: { x: number } }>).map((part) => [part.id, part.repeatSourceId, part.baseTransform.x])).toEqual([['dot__copy1', 'dot', 40], ['dot', undefined, 0]]);
  });
});

describe('settings edits keep the picture still', () => {
  const part = (id: string, type: string, x: number, extra: Record<string, unknown> = {}) => ({
    id, type, name: id, zIndex: 1, textValue: extra.textValue as string | undefined, fontSize: 20,
    baseTransform: { x, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }, ...extra,
  });

  it('binding a follow turns the x into the gap and moves its keys with it', () => {
    const before = [part('title', 'custom_text', 0, { textValue: 'Hi' }), part('tag', 'custom_box', 60)];
    const after = before.map((item) => (item.id === 'tag' ? { ...item, follow: { targetLayerId: 'title' } } : item));
    const tracks = [{ id: 't', partId: 'tag', channels: { x: [{ frame: 0, value: 60 }, { frame: 10, value: 80 }] } }];
    const settled = compensateLayoutChange(before as never, after as never, tracks, measure);
    const tag = (settled.parts as typeof after).find((item) => item.id === 'tag')!;
    // dx is 40 (edge 10 + half width 30): the gap is 60 - 40.
    expect(tag.baseTransform.x).toBeCloseTo(20);
    expect((settled.tracks[0].channels.x as Array<{ value: number }>).map((key) => key.value)).toEqual([20, 40]);
    // Laid out, it is where it was.
    const shown = resolveLayout(settled.parts as never, ((layer: { baseTransform: unknown }) => layer.baseTransform) as never, measure);
    expect(tag.baseTransform.x + (shown.adjustments.tag.dx ?? 0)).toBeCloseTo(60);
  });

  it("changing a followed text's alignment moves neither the text nor its follower", () => {
    const before = [part('title', 'custom_text', 0, { textValue: 'Hello' }), part('tag', 'custom_box', 0, { follow: { targetLayerId: 'title' } })];
    const after = before.map((item) => (item.id === 'title' ? { ...item, textFit: { align: 'left' } } : item));
    const settled = compensateLayoutChange(before as never, after as never, [], measure).parts as typeof after;
    const shownOf = (parts: typeof after) => {
      const { adjustments } = resolveLayout(parts as never, ((layer: { baseTransform: unknown }) => layer.baseTransform) as never, measure);
      return parts.map((item) => item.baseTransform.x + (adjustments[item.id]?.dx ?? 0));
    };
    expect(shownOf(settled)).toEqual(shownOf(before).map((value) => expect.closeTo(value, 6)));
    expect(settled[0].baseTransform.x).toBeCloseTo(-25);
  });

  it("justifying a group moves the group's origin, not its layers", () => {
    const before = [
      part('group', 'custom_box', 500, { isGroup: true }),
      part('title', 'custom_text', 0, { textValue: 'Hi', parentId: 'group' }),
      part('box', 'custom_box', 100, { parentId: 'group' }),
    ];
    const after = before.map((item) => (item.id === 'group' ? { ...item, justify: { horizontal: 'center' } } : item));
    const settled = compensateLayoutChange(before as never, after as never, [], measure).parts as typeof after;
    // The children (-10..130) are centred: shifted by -60, so the group moves by +60.
    expect(settled.find((item) => item.id === 'group')!.baseTransform.x).toBeCloseTo(560);
    expect(settled.find((item) => item.id === 'box')!.baseTransform.x).toBe(100);
  });
});

describe('deleting a layer a modifier reads', () => {
  it('lets the follower and the sized shape go, each left where it is', () => {
    const base = (x: number) => ({ x, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 });
    const parts = [
      { id: 'title', type: 'custom_text', name: 'Title', zIndex: 3, textValue: 'Hi', fontSize: 20, pivot: { x: 0, y: 0 }, fillColor: '#fff', strokeColor: '#000', baseTransform: base(0) },
      { id: 'tag', type: 'custom_box', name: 'Tag', zIndex: 2, pivot: { x: 0, y: 0 }, fillColor: '#fff', strokeColor: '#000', baseTransform: base(8), follow: { targetLayerId: 'title' } },
      { id: 'bar', type: 'custom_rect', name: 'Bar', zIndex: 1, pivot: { x: 0, y: 0 }, fillColor: '#fff', strokeColor: '#000', baseTransform: base(0), fitToText: { textLayerId: 'title' } },
    ];
    const tracks = parts.map((part) => ({ id: `t-${part.id}`, partId: part.id, name: part.name, keyframes: [], channels: {}, color: '#fff', visible: true, locked: false }));
    const plan = planPartDeletion(parts as never, tracks as never, ['title']);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const tag = plan.parts.find((part) => part.id === 'tag')!;
    expect(tag.follow).toBeUndefined();
    // jsdom measures "Hi" at 20 px 0.56 em: its edge at 11.2; the box sat 30 + 8 past it.
    expect(tag.baseTransform.x).toBeCloseTo(11.2 + 30 + 8);
    const bar = plan.parts.find((part) => part.id === 'bar')!;
    expect(bar.fitToText).toBeUndefined();
    // It keeps the width it had: 22.4 px of text + 2 x 24 padding on its 120 px primitive.
    expect(bar.baseTransform.scaleX).toBeCloseTo((22.4 + 48) / 120);
  });
});
