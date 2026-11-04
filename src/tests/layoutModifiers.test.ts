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

  it('a shape sized to two texts takes the widest, and hides only when both are hidden', () => {
    const subtitle = (textValue: string, extra: Record<string, unknown> = {}) => ({ id: 'sub', type: 'custom_text', textValue, fontSize: 20, ...extra });
    const twoTexts = bar({ fitToText: { textLayerId: 'title', extraTextLayerIds: ['sub'], padding: 10, maxWidth: 220 } });
    // Title 20 px, subtitle 80 px: 80 + 2 x 10.
    expect(layout([text('Hi'), subtitle('x'.repeat(8)), twoTexts]).adjustments.bar.scaleXFactor).toBeCloseTo(100 / 120);
    // Both fit the same room: a long subtitle shrinks like the title would.
    expect(layout([text('Hi'), subtitle('x'.repeat(30)), twoTexts]).adjustments.sub.fontSize).toBeCloseTo(20 * (200 / 300));
    const hide = { textFit: { hideWhenEmpty: true } };
    const oneEmpty = layout([text('', hide), subtitle('x'.repeat(8)), twoTexts]).adjustments;
    expect(oneEmpty.bar.hidden).toBeUndefined();
    expect(oneEmpty.bar.scaleXFactor).toBeCloseTo(100 / 120);
    expect(layout([text('', hide), subtitle('', hide), twoTexts]).adjustments.bar.hidden).toBe(true);
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

describe('auto size height', () => {
  // Title (20 px, baseline origin) at y 0 and a 10 px subtitle at y 40: their
  // boxes span -18.14 .. 42.15 (half height 0.561 em, centre 0.346 em up).
  const sub = { id: 'sub', type: 'custom_text', textValue: 'Sub', fontSize: 10, y: 40 };
  const fit = (extra: Record<string, unknown> = {}) => bar({ fitToText: { textLayerId: 'title', extraTextLayerIds: ['sub'], padding: 10, vertical: true, ...extra } });

  it('wraps the title and the subtitle with paddingY, centred on them', () => {
    const { adjustments } = layout([text('Hi'), sub, fit()]);
    const top = -0.346 * 20 - 0.561 * 20;
    const bottom = 40 - 0.346 * 10 + 0.561 * 10;
    // custom_rect is 60 high: the factor is the wanted height over it.
    expect(adjustments.bar.scaleYFactor).toBeCloseTo((bottom - top + 24) / 60);
    expect(adjustments.bar.dy).toBeCloseTo((top + bottom) / 2);
    // paddingY 0 hugs the texts.
    expect(layout([text('Hi'), sub, fit({ paddingY: 0 })]).adjustments.bar.scaleYFactor).toBeCloseTo((bottom - top) / 60);
  });

  it('a centre-origin text is centred on its own position; off, the height is left alone', () => {
    const centred = layout([text('Hi', { textOrigin: 'center' }), bar({ fitToText: { textLayerId: 'title', padding: 10, vertical: true, paddingY: 0 } })]).adjustments;
    expect(centred.bar.scaleYFactor).toBeCloseTo((2 * 0.561 * 20) / 60);
    expect(centred.bar.dy ?? 0).toBeCloseTo(0);
    expect(layout([text('Hi'), sub, bar({ fitToText: { textLayerId: 'title', extraTextLayerIds: ['sub'], padding: 10 } })]).adjustments.bar.scaleYFactor).toBeUndefined();
  });

  it('scales the scaleY keys with the base pose', () => {
    const scene = applyLayoutToScene({
      layers: [text('Hi', { textOrigin: 'center' }), bar({ fitToText: { textLayerId: 'title', padding: 10, vertical: true, paddingY: 0 } })],
      tracks: [{ id: 't', partId: 'bar', channels: { scaleY: [{ frame: 0, value: 1 }, { frame: 10, value: 2 }] } }],
    }, measure);
    const factor = (2 * 0.561 * 20) / 60;
    expect(scene.layers[1].scaleY).toBeCloseTo(factor);
    expect((scene.tracks![0].channels!.scaleY as Array<{ value: number }>).map((key) => key.value)).toEqual([factor, 2 * factor].map((value) => expect.closeTo(value)) as never);
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

  it('with vertical on, the y is the offset from the target and moves with it; off, the y stays', () => {
    const vertical = { follow: { targetLayerId: 'title', vertical: true } };
    expect(layout([text('Hi', { y: 120 }), tag({ y: -5, ...vertical })]).adjustments.tag.dy).toBeCloseTo(120);
    expect(layout([text('Hi', { y: -40 }), tag({ y: -5, ...vertical })]).adjustments.tag.dy).toBeCloseTo(-40);
    expect(layout([text('Hi', { y: 120 }), tag({ y: -5 })]).adjustments.tag.dy).toBeUndefined();
  });
});

describe('look at', () => {
  const arrow = (extra: Record<string, unknown> = {}) => ({ id: 'arrow', type: 'custom_triangle', x: 0, y: 0, lookAt: { targetLayerId: 'goal' }, ...extra });
  const goal = (x: number, y: number, extra: Record<string, unknown> = {}) => ({ id: 'goal', type: 'custom_circle', x, y, ...extra });

  it('turns the layer to face the target, plus its offset, by the nearest turn', () => {
    expect(layout([arrow(), goal(100, 0)]).adjustments.arrow).toBeUndefined();
    expect(layout([arrow(), goal(0, 100)]).adjustments.arrow.rotation).toBeCloseTo(90);
    expect(Math.abs(layout([arrow(), goal(-100, 0)]).adjustments.arrow.rotation!)).toBeCloseTo(180);
    expect(layout([arrow({ lookAt: { targetLayerId: 'goal', offset: -90 } }), goal(0, 100)]).adjustments.arrow).toBeUndefined();
    // Already turned 350°: facing 0° is a +10° turn, not -350°.
    expect(layout([arrow({ rotation: 350 }), goal(100, 0)]).adjustments.arrow.rotation).toBeCloseTo(10);
  });

  it("faces the target's laid-out place, and leaves another parent or a missing target alone", () => {
    // The goal follows a text: it ends 40 px further right than authored.
    const followed = layout([text('Hi'), arrow({ y: 100 }), goal(8, 0, { type: 'custom_box', follow: { targetLayerId: 'title' } })]).adjustments;
    expect(followed.arrow.rotation).toBeCloseTo((Math.atan2(-100, 48) * 180) / Math.PI);
    expect(layout([arrow({ parentId: 'g' }), goal(0, 100)]).adjustments.arrow).toBeUndefined();
    expect(layout([arrow()]).adjustments.arrow).toBeUndefined();
  });

  it('adds its turn to the rotation keys', () => {
    const scene = applyLayoutToScene({
      layers: [arrow(), goal(0, 100)],
      tracks: [{ id: 't', partId: 'arrow', channels: { rotation: [{ frame: 0, value: 0 }, { frame: 10, value: 30 }] } }],
    }, measure);
    expect(scene.layers[0].rotation).toBeCloseTo(90);
    expect((scene.tracks![0].channels!.rotation as Array<{ value: number }>).map((key) => key.value)).toEqual([90, 120]);
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

  it('turning on vertical follow turns the y into the offset and keeps the box where it is', () => {
    const before = [
      part('title', 'custom_text', 0, { textValue: 'Hi', baseTransform: { x: 0, y: 100, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } }),
      part('tag', 'custom_box', 60, { baseTransform: { x: 60, y: 130, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } }),
    ];
    const after = before.map((item) => (item.id === 'tag' ? { ...item, follow: { targetLayerId: 'title', vertical: true } } : item));
    const tracks = [{ id: 't', partId: 'tag', channels: { y: [{ frame: 0, value: 130 }, { frame: 10, value: 150 }] } }];
    const settled = compensateLayoutChange(before as never, after as never, tracks, measure);
    const tag = (settled.parts as typeof after).find((item) => item.id === 'tag')!;
    expect(tag.baseTransform.y).toBeCloseTo(30);
    expect((settled.tracks[0].channels.y as Array<{ value: number }>).map((key) => key.value)).toEqual([30, 50]);
    // Moving the text down 50 moves the box down 50.
    const moved = (settled.parts as typeof after).map((item) => (item.id === 'title' ? { ...item, baseTransform: { ...item.baseTransform, y: 150 } } : item));
    const shown = resolveLayout(moved as never, ((layer: { baseTransform: unknown }) => layer.baseTransform) as never, measure);
    expect(tag.baseTransform.y + (shown.adjustments.tag.dy ?? 0)).toBeCloseTo(180);
  });

  it('turning on the height fit moves the shape onto its texts instead of keeping it where it was', () => {
    const before = [
      part('title', 'custom_text', 0, { textValue: 'Hi', textOrigin: 'center', baseTransform: { x: 0, y: 50, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } }),
      part('bar', 'custom_rect', 0, { fitToText: { textLayerId: 'title', padding: 10 }, baseTransform: { x: 0, y: 200, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } }),
    ];
    const after = before.map((item) => (item.id === 'bar' ? { ...item, fitToText: { textLayerId: 'title', padding: 10, vertical: true, paddingY: 0 } } : item));
    const settled = compensateLayoutChange(before as never, after as never, [], measure);
    const bar = (settled.parts as typeof after).find((item) => item.id === 'bar')!;
    expect(bar.baseTransform.y).toBe(200);
    const shown = resolveLayout(settled.parts as never, ((layer: { baseTransform: unknown }) => layer.baseTransform) as never, measure);
    expect(bar.baseTransform.y + (shown.adjustments.bar.dy ?? 0)).toBeCloseTo(50);
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
  it('a layer facing a deleted layer keeps the turn it had, keys included', () => {
    const base = (x: number, y: number) => ({ x, y, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 });
    const parts = [
      { id: 'goal', type: 'custom_circle', name: 'Goal', zIndex: 2, pivot: { x: 0, y: 0 }, fillColor: '#fff', strokeColor: '#000', baseTransform: base(0, 100) },
      { id: 'arrow', type: 'custom_triangle', name: 'Arrow', zIndex: 1, pivot: { x: 0, y: 0 }, fillColor: '#fff', strokeColor: '#000', baseTransform: base(0, 0), lookAt: { targetLayerId: 'goal' } },
    ];
    const tracks = parts.map((part) => ({ id: `t-${part.id}`, partId: part.id, name: part.name, keyframes: [], channels: part.id === 'arrow' ? { rotation: [{ id: 'r0', frame: 0, value: 0, easing: 'linear' }, { id: 'r10', frame: 10, value: 30, easing: 'linear' }] } : {}, color: '#fff', visible: true, locked: false }));
    const plan = planPartDeletion(parts as never, tracks as never, ['goal']);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const arrow = plan.parts.find((part) => part.id === 'arrow')!;
    expect(arrow.lookAt).toBeUndefined();
    expect(arrow.baseTransform.rotation).toBeCloseTo(90);
    const keys = (plan.tracks.find((track) => track.partId === 'arrow')!.channels.rotation as Array<{ value: number }>).map((key) => key.value);
    expect(keys).toEqual([90, 120]);
  });

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

  it('a shape sized to two texts keeps the other one when one is deleted', () => {
    const base = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };
    const common = { pivot: { x: 0, y: 0 }, fillColor: '#fff', strokeColor: '#000', baseTransform: base };
    const parts = [
      { id: 'title', type: 'custom_text', name: 'Title', zIndex: 3, textValue: 'Hi', fontSize: 20, ...common },
      { id: 'sub', type: 'custom_text', name: 'Sub', zIndex: 2, textValue: 'Subtitle', fontSize: 20, ...common },
      { id: 'bar', type: 'custom_rect', name: 'Bar', zIndex: 1, ...common, fitToText: { textLayerId: 'title', extraTextLayerIds: ['sub'], padding: 10 } },
    ];
    const tracks = parts.map((part) => ({ id: `t-${part.id}`, partId: part.id, name: part.name, keyframes: [], channels: {}, color: '#fff', visible: true, locked: false }));
    const plan = planPartDeletion(parts as never, tracks as never, ['title']);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.parts.find((part) => part.id === 'bar')!.fitToText).toEqual({ textLayerId: 'sub', padding: 10 });
  });
});
