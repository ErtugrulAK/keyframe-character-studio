import { describe, expect, it } from 'vitest';
import { applyTextFitToScene, limitLength, resolveTextFit } from '../utils/layers/textFit';

// 10 px per character at size 20 (0.5 em), linear in the size.
const measure = (text: string, size: number) => Array.from(text).length * size * 0.5;
const text = (textValue: string, extra: Record<string, unknown> = {}) => ({ id: 'title', type: 'custom_text', textValue, fontSize: 20, ...extra });
const bar = (extra: Record<string, unknown> = {}) => ({ id: 'bar', type: 'custom_rect', fitToText: { textLayerId: 'title', padding: 10, maxWidth: 220 }, ...extra });
const scaleOne = () => 1;

describe('text fit', () => {
  it('a short text keeps its size and the shape hugs it with its padding', () => {
    const result = resolveTextFit([text('Hi'), bar()], scaleOne, measure);
    expect(result.title).toBeUndefined();
    // 20 px of text + 2 x 10 padding = 40 px on a 120 px primitive.
    expect(result.bar.scaleXFactor).toBeCloseTo(40 / 120);
  });

  it('past the max width the text shrinks and the shape stops growing', () => {
    // 30 chars = 300 px; room = 220 - 20 = 200 px -> size 20 * 200/300.
    const result = resolveTextFit([text('x'.repeat(30)), bar()], scaleOne, measure);
    expect(result.title.fontSize).toBeCloseTo(20 * (200 / 300));
    expect(result.title.scaleXFactor).toBeUndefined();
    expect(result.bar.scaleXFactor).toBeCloseTo(220 / 120);
  });

  it('stops at the min size, then squeezes so the text never leaves the box', () => {
    // 80 chars = 800 px; min 50 % -> 400 px > 200 px room -> squeeze 0.5.
    const result = resolveTextFit([text('x'.repeat(80)), bar()], scaleOne, measure);
    expect(result.title.fontSize).toBe(10);
    expect(result.title.scaleXFactor).toBeCloseTo(0.5);
    expect(result.bar.scaleXFactor).toBeCloseTo(220 / 120);
  });

  it('caps the characters, and honours the shape min width', () => {
    const result = resolveTextFit([text('abcdef', { textFit: { maxLength: 3 } }), bar({ fitToText: { textLayerId: 'title', padding: 10, minWidth: 120 } })], scaleOne, measure);
    expect(result.title.textValue).toBe('abc');
    expect(result.bar).toBeUndefined(); // 120 px = the primitive width: nothing to change
    expect(limitLength('🙂🙂🙂', 2)).toBe('🙂🙂');
  });

  it('applies to SceneData: base scaleX and every scaleX key keep the reveal proportions', () => {
    const scene = {
      layers: [{ ...text('Hi'), scaleX: 1 }, { ...bar(), scaleX: 2 }],
      tracks: [{ partId: 'bar', channels: { scaleX: [{ value: 0 }, { value: 2 }] } }],
    };
    const fitted = applyTextFitToScene(scene, measure);
    const factor = 40 / 240;
    expect(fitted.layers[1].scaleX).toBeCloseTo(2 * factor);
    expect((fitted.tracks![0].channels!.scaleX as Array<{ value: number }>).map((key) => key.value)).toEqual([0, 2 * factor]);
    // Nothing to fit: the same object.
    const plain = { layers: [{ id: 'a', type: 'custom_rect', scaleX: 1 }], tracks: [] };
    expect(applyTextFitToScene(plain, measure)).toBe(plain);
  });
});
