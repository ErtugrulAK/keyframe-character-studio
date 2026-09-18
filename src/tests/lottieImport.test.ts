import { describe, expect, it } from 'vitest';
import { importLottieDocument } from '../interop/lottie/mapDocument';
import { LOTTIE_IMPORT_LIMITS } from '../interop/lottie/diagnostics';

/**
 * Contract tests for the Lottie import core (Milestone F, item 10, first slice).
 *
 * They pin the decisions the design fixes: document timing, the segment-to-keyframe
 * easing split, hold segments, the linear fallback for unsupported segments, and
 * that everything the slice does not convert is *reported* rather than guessed.
 */
const baseDocument = (layers: unknown[], overrides: Record<string, unknown> = {}) => ({
  v: '5.7.4',
  fr: 24,
  ip: 0,
  op: 48,
  w: 800,
  h: 600,
  nm: 'Fixture',
  layers,
  ...overrides,
});

const solidLayer = (overrides: Record<string, unknown> = {}) => ({
  ty: 1,
  nm: 'Solid',
  sc: '#336699',
  sw: 100,
  sh: 100,
  ks: {
    o: { k: 100 },
    r: { k: 0 },
    p: { k: 10 },
    s: { k: 200 },
  },
  ...overrides,
});

const codes = (diagnostics: { code: string }[]) => diagnostics.map((entry) => entry.code);

describe('Lottie import — document level', () => {
  it('maps timing, size and name into a KCS scene', () => {
    const result = importLottieDocument(JSON.stringify(baseDocument([solidLayer()])));

    expect(result.ok).toBe(true);
    expect(result.scene?.fps).toBe(24);
    expect(result.scene?.totalFrames).toBe(48);
    expect(result.scene?.width).toBe(800);
    expect(result.scene?.height).toBe(600);
    expect(result.scene?.name).toBe('Fixture');
  });

  it('rounds a fractional frame rate and reports it', () => {
    const result = importLottieDocument(JSON.stringify(baseDocument([solidLayer()], { fr: 23.976 })));

    expect(result.scene?.fps).toBe(24);
    expect(codes(result.diagnostics)).toContain('LOTTIE_FRACTIONAL_FPS');
  });

  it('shifts keyframes when the document starts after frame 0 and reports it', () => {
    const result = importLottieDocument(JSON.stringify(baseDocument([solidLayer()], { ip: 24, op: 72 })));

    expect(result.scene?.totalFrames).toBe(48);
    expect(codes(result.diagnostics)).toContain('LOTTIE_IN_POINT_SHIFT');
  });

  it('refuses a document without usable timing', () => {
    const result = importLottieDocument(JSON.stringify({ nm: 'broken' }));

    expect(result.ok).toBe(false);
    expect(codes(result.diagnostics)).toEqual(['LOTTIE_MISSING_TIMING']);
  });
});

describe('Lottie import — transforms', () => {
  it('maps static transform values with percent scaling', () => {
    const result = importLottieDocument(JSON.stringify(baseDocument([solidLayer()])));
    const layer = result.scene?.layers[0];

    expect(layer?.x).toBe(10);
    expect(layer?.scaleX).toBe(2);
    expect(layer?.opacity).toBe(1);
    expect(result.scene?.tracks).toHaveLength(0);
  });

  it('splits one Lottie segment across the two keyframes it connects', () => {
    const layer = solidLayer({
      ks: {
        o: { k: 100 },
        r: { k: 0 },
        s: { k: 100 },
        p: {
          a: 0,
          k: [
            { t: 0, s: [0], e: [100], o: { x: 0.25, y: 0.1 }, i: { x: 0.75, y: 0.9 } },
            { t: 24, s: [100] },
          ],
        },
      },
    });
    const result = importLottieDocument(JSON.stringify(baseDocument([layer])));
    const track = result.scene?.tracks[0];
    const xKeyframes = track?.channels.x ?? [];

    expect(xKeyframes).toHaveLength(2);
    expect(xKeyframes[0]).toMatchObject({ frame: 0, value: 0, easing: 'bezier', bezierOut: { x: 0.25, y: 0.1 } });
    expect(xKeyframes[1]).toMatchObject({ frame: 24, value: 100, easing: 'bezier', bezierIn: { x: 0.75, y: 0.9 } });
  });

  it('maps a hold segment to the hold easing without inventing handles', () => {
    const layer = solidLayer({
      ks: {
        o: { k: 100 },
        r: { k: 0 },
        s: { k: 100 },
        p: { a: 0, k: [{ t: 0, s: [0], h: 1, o: { x: 0, y: 0 }, i: { x: 1, y: 1 } }, { t: 12, s: [50] }] },
      },
    });
    const result = importLottieDocument(JSON.stringify(baseDocument([layer])));
    const first = result.scene?.tracks[0]?.channels.x?.[0];

    expect(first?.easing).toBe('hold');
    expect(first?.bezierOut).toBeUndefined();
  });

  it('falls back to linear and reports a roving segment', () => {
    const layer = solidLayer({
      ks: {
        o: { k: 100 },
        r: { k: 0 },
        s: { k: 100 },
        p: { a: 0, k: [{ t: 0, s: [0], r: 1 }, { t: 12, s: [50] }] },
      },
    });
    const result = importLottieDocument(JSON.stringify(baseDocument([layer])));

    expect(result.scene?.tracks[0]?.channels.x?.[0]?.easing).toBe('linear');
    expect(codes(result.diagnostics)).toContain('LOTTIE_ROVING_KEYFRAME');
  });

  it('reports when a channel exceeds the keyframe limit and keeps the first keyframes', () => {
    const keyframes = Array.from({ length: LOTTIE_IMPORT_LIMITS.keyframesPerChannel + 5 }, (_, index) => ({ t: index, s: [index] }));
    const layer = solidLayer({
      ks: { o: { k: 100 }, r: { k: 0 }, s: { k: 100 }, p: { a: 0, k: keyframes } },
    });
    const result = importLottieDocument(JSON.stringify(baseDocument([layer])));

    expect(result.scene?.tracks[0]?.channels.x).toHaveLength(LOTTIE_IMPORT_LIMITS.keyframesPerChannel);
    expect(codes(result.diagnostics)).toContain('LOTTIE_KEYFRAME_LIMIT');
  });
});

describe('Lottie import — shapes and unsupported constructs', () => {
  it('maps a path, a rectangle, a fill, a stroke and a trim item', () => {
    const shapeLayer = {
      ty: 4,
      nm: 'Shape',
      ks: { o: { k: 50 }, r: { k: 0 }, s: { k: 100 }, p: { k: 0 } },
      shapes: [
        { ty: 'rc', s: { k: [120, 80] } },
        { ty: 'fl', c: { k: [1, 0, 0] }, o: { k: 50 } },
        { ty: 'st', w: { k: 3 } },
        { ty: 'tm', s: { k: 10 }, e: { k: 90 }, o: { k: 5 } },
        { ty: 'sh', ks: { k: { c: true, v: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], i: [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }], o: [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }] } } },
      ],
    };
    const result = importLottieDocument(JSON.stringify(baseDocument([shapeLayer])));
    const layer = result.scene?.layers[0];

    expect(layer?.width).toBe(120);
    expect(layer?.height).toBe(80);
    expect(layer?.fillColor).toBe('#ff0000');
    expect(layer?.fillOpacity).toBe(0.5);
    expect(layer?.strokeWidth).toBe(3);
    expect(layer?.trimPathStart).toBe(0.1);
    expect(layer?.trimPathEnabled).toBe(true);
    expect(layer?.path?.points).toHaveLength(3);
  });

  it('reports unsupported layer types instead of importing them', () => {
    const result = importLottieDocument(JSON.stringify(baseDocument([{ ty: 0, nm: 'Precomp', refId: 'comp_0', ks: {} }])));

    expect(result.ok).toBe(false);
    expect(codes(result.diagnostics)).toContain('LOTTIE_UNSUPPORTED_LAYER_TYPE');
    expect(codes(result.diagnostics)).toContain('LOTTIE_EMPTY_SCENE');
  });

  it('reports effects, expressions, masks and track mattes on a supported layer', () => {
    const layer = solidLayer({ ef: [{ nm: 'Blur' }], hasExpressions: true, hasMask: true, tt: 1, td: 1 });
    const result = importLottieDocument(JSON.stringify(baseDocument([layer])));

    expect(codes(result.diagnostics)).toEqual(
      expect.arrayContaining(['LOTTIE_UNSUPPORTED_EFFECT', 'LOTTIE_UNSUPPORTED_EXPRESSION', 'LOTTIE_UNSUPPORTED_MASK', 'LOTTIE_UNSUPPORTED_TRACK_MATTE']),
    );
    expect(result.scene?.layers).toHaveLength(1);
  });

  it('reports an unsupported shape item and still imports the layer', () => {
    const shapeLayer = { ty: 4, nm: 'Shape', ks: { o: { k: 100 }, r: { k: 0 }, s: { k: 100 }, p: { k: 0 } }, shapes: [{ ty: 'rp', c: { k: 3 } }] };
    const result = importLottieDocument(JSON.stringify(baseDocument([shapeLayer])));

    expect(codes(result.diagnostics)).toContain('LOTTIE_UNSUPPORTED_SHAPE');
    expect(result.scene?.layers).toHaveLength(1);
  });
});

describe('Lottie import — untrusted input', () => {
  it('refuses malformed JSON', () => {
    expect(codes(importLottieDocument('{ nope').diagnostics)).toEqual(['LOTTIE_MALFORMED_JSON']);
  });

  it('refuses a prototype-sensitive key', () => {
    const result = importLottieDocument('{"fr":24,"op":10,"__proto__":{"x":1}}');

    expect(result.ok).toBe(false);
    expect(codes(result.diagnostics)).toEqual(['LOTTIE_UNSAFE_KEY']);
  });

  it('refuses a document above the size limit before parsing it', () => {
    const oversized = `{"pad":"${'x'.repeat(LOTTIE_IMPORT_LIMITS.characters)}"}`;

    expect(codes(importLottieDocument(oversized).diagnostics)).toEqual(['LOTTIE_DOCUMENT_TOO_LARGE']);
  });

  it('reports a parent that is not an already-imported layer', () => {
    const result = importLottieDocument(JSON.stringify(baseDocument([solidLayer({ parent: 5 })])));

    expect(codes(result.diagnostics)).toContain('LOTTIE_BROKEN_PARENT');
    expect(result.scene?.layers[0]?.parentId).toBeUndefined();
  });
});
