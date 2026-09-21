import { describe, expect, it, vi } from 'vitest';
import { importLottieDocument } from '../interop/lottie/mapDocument';
import { LOTTIE_IMPORT_LIMITS } from '../interop/lottie/diagnostics';
import { validateImportedDocument } from '../utils/importValidation';
import { validateSceneForOGraf } from '../ograf/validation';
import { buildBezierPathD } from '../utils/bezierPath';

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

describe('Lottie import — dimensions and fallbacks (review round)', () => {
  it('maps each vector dimension to its own channel instead of aliasing x into y', () => {
    const layer = solidLayer({ ks: { o: { k: 100 }, r: { k: 0 }, s: { k: [100, 200] }, p: { k: [15, 25] } } });
    const result = importLottieDocument(JSON.stringify(baseDocument([layer])));
    const imported = result.scene?.layers[0];

    expect(imported?.x).toBe(15);
    expect(imported?.y).toBe(25);
    expect(imported?.scaleX).toBe(1);
    expect(imported?.scaleY).toBe(2);
  });

  it('maps non-uniform keyframed scale per dimension', () => {
    const layer = solidLayer({
      ks: {
        o: { k: 100 },
        r: { k: 0 },
        p: { k: 0 },
        s: { k: [{ t: 0, s: [100, 200] }, { t: 12, s: [300, 400] }] },
      },
    });
    const result = importLottieDocument(JSON.stringify(baseDocument([layer])));
    const track = result.scene?.tracks[0];

    expect(track?.channels.scaleX?.map((keyframe) => keyframe.value)).toEqual([1, 3]);
    expect(track?.channels.scaleY?.map((keyframe) => keyframe.value)).toEqual([2, 4]);
  });

  it('keeps a roving segment linear even when it carries handles, and reports it', () => {
    const layer = solidLayer({
      ks: {
        o: { k: 100 },
        r: { k: 0 },
        s: { k: 100 },
        p: { k: [{ t: 0, s: [0], r: 1, o: { x: 0.25, y: 0.1 }, i: { x: 0.75, y: 0.9 } }, { t: 12, s: [50] }] },
      },
    });
    const result = importLottieDocument(JSON.stringify(baseDocument([layer])));
    const keyframes = result.scene?.tracks[0]?.channels.x ?? [];

    expect(codes(result.diagnostics)).toContain('LOTTIE_ROVING_KEYFRAME');
    expect(keyframes[0]?.easing).toBe('linear');
    expect(keyframes[0]?.bezierOut).toBeUndefined();
    expect(keyframes[1]?.bezierIn).toBeUndefined();
  });

  it('pins both handles on the middle keyframe of a two-segment curve', () => {
    const layer = solidLayer({
      ks: {
        o: { k: 100 },
        r: { k: 0 },
        s: { k: 100 },
        p: {
          k: [
            { t: 0, s: [0], o: { x: 0.1, y: 0.2 }, i: { x: 0.3, y: 0.4 } },
            { t: 12, s: [50], o: { x: 0.5, y: 0.6 }, i: { x: 0.7, y: 0.8 } },
            { t: 24, s: [100] },
          ],
        },
      },
    });
    const result = importLottieDocument(JSON.stringify(baseDocument([layer])));
    const keyframes = result.scene?.tracks[0]?.channels.x ?? [];

    expect(keyframes[1]).toMatchObject({ frame: 12, value: 50, bezierIn: { x: 0.3, y: 0.4 }, bezierOut: { x: 0.5, y: 0.6 } });
  });

  it('subtracts the layer start time and clamps pre-in-point keyframes to frame 0', () => {
    const layer = solidLayer({ st: 6, ks: { o: { k: 100 }, r: { k: 0 }, s: { k: 100 }, p: { k: [{ t: 0, s: [0] }, { t: 20, s: [80] }] } } });
    const result = importLottieDocument(JSON.stringify(baseDocument([layer])));
    const keyframes = result.scene?.tracks[0]?.channels.x ?? [];

    expect(keyframes.map((keyframe) => keyframe.frame)).toEqual([0, 14]);
  });

  it('reports a parent chain deeper than the hierarchy limit', () => {
    const deepLayers = Array.from({ length: 40 }, (_, index) => solidLayer({ parent: index === 0 ? undefined : index - 1 }));
    const result = importLottieDocument(JSON.stringify(baseDocument(deepLayers)));

    expect(codes(result.diagnostics)).toContain('LOTTIE_HIERARCHY_LIMIT');
  });

  it('reports a layer in/out range, a skewed layer and auto-orient instead of ignoring them', () => {
    const layer = solidLayer({ ip: 6, op: 40, ao: 1, ks: { o: { k: 100 }, r: { k: 0 }, s: { k: 100 }, p: { k: 0 }, sk: { k: 10 }, sa: { k: 5 } } });
    const result = importLottieDocument(JSON.stringify(baseDocument([layer])));

    expect(codes(result.diagnostics)).toEqual(
      expect.arrayContaining(['LOTTIE_LAYER_TIMING', 'LOTTIE_UNSUPPORTED_SKEW', 'LOTTIE_UNSUPPORTED_AUTO_ORIENT']),
    );
  });

  it('reports unreadable shape payloads instead of keeping silent defaults', () => {
    const shapeLayer = {
      ty: 4,
      nm: 'Shape',
      ks: { o: { k: 100 }, r: { k: 0 }, s: { k: 100 }, p: { k: 0 } },
      shapes: [{ ty: 'rc' }, { ty: 'fl' }, { ty: 'st' }, { nm: 'no type' }, { ty: 'sh', ks: { k: { c: true, v: [] } } }],
    };
    const result = importLottieDocument(JSON.stringify(baseDocument([shapeLayer])));

    expect(codes(result.diagnostics)).toEqual(
      expect.arrayContaining(['LOTTIE_UNREADABLE_SIZE', 'LOTTIE_UNREADABLE_COLOUR', 'LOTTIE_UNREADABLE_STROKE_WIDTH', 'LOTTIE_UNREADABLE_SHAPE', 'LOTTIE_UNREADABLE_PATH']),
    );
  });

  it('reports a document without a declared size and a solid without its paint', () => {
    const document = baseDocument([{ ty: 1, nm: 'Block', ks: { o: { k: 100 }, r: { k: 0 }, s: { k: 100 }, p: { k: 0 } } }]) as Record<string, unknown>;
    delete document.w;
    delete document.h;

    const codes = importLottieDocument(JSON.stringify(document)).diagnostics.map((entry) => entry.code);

    expect(codes.filter((code) => code === 'LOTTIE_MISSING_DOCUMENT_SIZE')).toHaveLength(1);
    expect(codes.filter((code) => code === 'LOTTIE_MISSING_SOLID_PAINT')).toHaveLength(1);

    const halfSized = baseDocument([{ ty: 3, nm: 'Null', ks: { o: { k: 100 }, r: { k: 0 }, s: { k: 100 }, p: { k: 0 } } }]) as Record<string, unknown>;
    delete halfSized.h;
    const halfCodes = importLottieDocument(JSON.stringify(halfSized)).diagnostics.map((entry) => entry.code);

    expect(halfCodes.filter((code) => code === 'LOTTIE_MISSING_DOCUMENT_SIZE')).toHaveLength(1);
    // A layer type that has no solid paint at all must not be reported for one.
    expect(halfCodes).not.toContain('LOTTIE_MISSING_SOLID_PAINT');
  });

  it('stays silent when a document declares its size and its solids are complete', () => {
    const document = baseDocument([
      { ty: 1, nm: 'Block', sc: '#336699', sw: 320, sh: 180, ks: { o: { k: 100 }, r: { k: 0 }, s: { k: 100 }, p: { k: 0 } } },
    ]);
    const codes = importLottieDocument(JSON.stringify(document)).diagnostics.map((entry) => entry.code);

    expect(codes).not.toContain('LOTTIE_MISSING_DOCUMENT_SIZE');
    expect(codes).not.toContain('LOTTIE_MISSING_SOLID_PAINT');
  });

  it('stays silent for default stroke styles and reports dashes, trim modes and a missing stroke colour', () => {
    const defaultStroke = {
      ty: 4,
      nm: 'Default',
      ks: { o: { k: 100 }, r: { k: 0 }, s: { k: 100 }, p: { k: 0 } },
      shapes: [{ ty: 'st', w: { k: 2 }, o: { k: 100 }, c: { k: [0, 0, 1] }, lc: { k: 2 }, lj: { k: 2 } }],
    };
    const special = {
      ty: 4,
      nm: 'Special',
      ks: { o: { k: 100 }, r: { k: 0 }, s: { k: 100 }, p: { k: 0 } },
      shapes: [
        { ty: 'st', w: { k: 2 }, o: { k: 100 }, c: { k: [0, 0, 1] }, d: { k: [3, 2] } },
        { ty: 'st', w: { k: 2 }, o: { k: 100 }, c: { k: 'red' } },
        { ty: 'tm', s: { k: 0 }, e: { k: 100 }, m: 2 },
      ],
    };

    const plain = importLottieDocument(JSON.stringify(baseDocument([defaultStroke])));
    expect(plain.diagnostics.filter((entry) => entry.code === 'LOTTIE_UNSUPPORTED_STROKE_STYLE')).toHaveLength(0);

    const codes = importLottieDocument(JSON.stringify(baseDocument([special]))).diagnostics.map((entry) => entry.code);
    expect(codes).toContain('LOTTIE_UNSUPPORTED_STROKE_DASH');
    expect(codes).toContain('LOTTIE_UNREADABLE_COLOUR');
    expect(codes).toContain('LOTTIE_UNSUPPORTED_TRIM_MODE');
  });

  it('reports an animated path as animated rather than unreadable', () => {
    const animatedPath = {
      ty: 4,
      nm: 'Animated path',
      ks: { o: { k: 100 }, r: { k: 0 }, s: { k: 100 }, p: { k: 0 } },
      shapes: [
        {
          ty: 'sh',
          ks: {
            k: [
              { t: 0, s: [{ v: [[0, 0], [10, 0], [10, 10]], i: [[0, 0], [0, 0], [0, 0]], o: [[0, 0], [0, 0], [0, 0]], c: true }] },
              { t: 10, s: [{ v: [[0, 0], [20, 0], [20, 20]], i: [[0, 0], [0, 0], [0, 0]], o: [[0, 0], [0, 0], [0, 0]], c: true }] },
            ],
          },
        },
      ],
    };
    const result = importLottieDocument(JSON.stringify(baseDocument([animatedPath])));
    const codes = result.diagnostics.map((entry) => entry.code);

    expect(codes).toContain('LOTTIE_UNSUPPORTED_ANIMATED_SHAPE');
    expect(codes).not.toContain('LOTTIE_UNREADABLE_PATH');
  });

  it('does not report a static shape as animated', () => {
    const shapeLayer = {
      ty: 4,
      nm: 'Shape',
      ks: { o: { k: 100 }, r: { k: 0 }, s: { k: 100 }, p: { k: 0 } },
      shapes: [{ ty: 'fl', c: { k: [1, 0, 0] }, o: { k: 100 } }, { ty: 'st', w: { k: 2 }, o: { k: 100 }, c: { k: [0, 0, 1] } }],
    };
    const result = importLottieDocument(JSON.stringify(baseDocument([shapeLayer])));

    expect(result.diagnostics.filter((entry) => entry.code === 'LOTTIE_UNSUPPORTED_ANIMATED_SHAPE')).toHaveLength(0);
  });

  it('reports an animated fill opacity, stroke opacity, corner radius and trim offset', () => {
    const animated = { k: [{ t: 0, s: [0] }, { t: 10, s: [50] }] };
    const shapeLayer = {
      ty: 4,
      nm: 'Shape',
      ks: { o: { k: 100 }, r: { k: 0 }, s: { k: 100 }, p: { k: 0 } },
      shapes: [
        { ty: 'fl', c: { k: [1, 0, 0] }, o: animated },
        { ty: 'st', w: { k: 2 }, o: animated },
        { ty: 'rc', s: { k: [10, 10] }, r: animated },
        { ty: 'tm', s: { k: 0 }, e: { k: 100 }, o: animated },
      ],
    };
    const result = importLottieDocument(JSON.stringify(baseDocument([shapeLayer])));
    const reported = result.diagnostics.filter((entry) => entry.code === 'LOTTIE_UNSUPPORTED_ANIMATED_SHAPE');

    expect(reported).toHaveLength(4);
  });

  it('maps a solid layer colour and size, and reports its anchor', () => {
    const layer = solidLayer({ sc: '#123456', sw: 320, sh: 180, ks: { a: { k: [10, 10] }, o: { k: 100 }, r: { k: 0 }, s: { k: 100 }, p: { k: 0 } } });
    const result = importLottieDocument(JSON.stringify(baseDocument([layer])));
    const imported = result.scene?.layers[0];

    expect(imported?.fillColor).toBe('#123456');
    expect(imported?.width).toBe(320);
    expect(imported?.height).toBe(180);
    expect(codes(result.diagnostics)).toContain('LOTTIE_UNSUPPORTED_ANCHOR');
  });

  it('maps stroke opacity and rect corner radius, and reports cap/join and shape position', () => {
    const shapeLayer = {
      ty: 4,
      nm: 'Shape',
      ks: { o: { k: 100 }, r: { k: 0 }, s: { k: 100 }, p: { k: 0 } },
      shapes: [
        { ty: 'rc', s: { k: [100, 50] }, r: { k: 8 }, p: { k: [5, 5] } },
        { ty: 'st', w: { k: 2 }, o: { k: 40 }, lc: 2, lj: 3 },
      ],
    };
    const result = importLottieDocument(JSON.stringify(baseDocument([shapeLayer])));
    const imported = result.scene?.layers[0];

    expect(imported?.borderRadius).toBe(8);
    expect(imported?.strokeOpacity).toBe(0.4);
    expect(codes(result.diagnostics)).toEqual(expect.arrayContaining(['LOTTIE_UNSUPPORTED_SHAPE_POSITION', 'LOTTIE_UNSUPPORTED_STROKE_STYLE']));
  });

  it('reports an animated trim and an animated fill instead of reading them as static', () => {
    const shapeLayer = {
      ty: 4,
      nm: 'Shape',
      ks: { o: { k: 100 }, r: { k: 0 }, s: { k: 100 }, p: { k: 0 } },
      shapes: [{ ty: 'tm', s: { k: [{ t: 0, s: [0] }, { t: 10, s: [50] }] }, e: { k: 100 } }, { ty: 'fl', c: { k: [{ t: 0, s: [1, 0, 0] }] } }],
    };
    const result = importLottieDocument(JSON.stringify(baseDocument([shapeLayer])));
    const animated = result.diagnostics.filter((entry) => entry.code === 'LOTTIE_UNSUPPORTED_ANIMATED_SHAPE');

    expect(animated).toHaveLength(2);
  });

  it('converts keyframed opacity from percent to a factor', () => {
    const layer = solidLayer({ ks: { o: { k: [{ t: 0, s: [100] }, { t: 12, s: [50] }] }, r: { k: 0 }, s: { k: 100 }, p: { k: 0 } } });
    const result = importLottieDocument(JSON.stringify(baseDocument([layer])));

    expect(result.scene?.tracks[0]?.channels.opacity?.map((keyframe) => keyframe.value)).toEqual([1, 0.5]);
  });

  it('reports a path above the vertex limit instead of importing it', () => {
    const vertices = Array.from({ length: 5000 }, (_, index) => ({ x: index, y: index }));
    const shapeLayer = {
      ty: 4,
      nm: 'Shape',
      ks: { o: { k: 100 }, r: { k: 0 }, s: { k: 100 }, p: { k: 0 } },
      shapes: [{ ty: 'sh', ks: { k: { c: true, v: vertices, i: vertices, o: vertices } } }],
    };
    const result = importLottieDocument(JSON.stringify(baseDocument([shapeLayer])));

    expect(codes(result.diagnostics)).toContain('LOTTIE_PATH_LIMIT');
    expect(result.scene?.layers[0]?.path).toBeUndefined();
  });

  it('maps the stroke colour when the document provides one', () => {
    const shapeLayer = {
      ty: 4,
      nm: 'Shape',
      ks: { o: { k: 100 }, r: { k: 0 }, s: { k: 100 }, p: { k: 0 } },
      shapes: [{ ty: 'st', w: { k: 2 }, c: { k: [0, 0, 1] } }],
    };
    const result = importLottieDocument(JSON.stringify(baseDocument([shapeLayer])));

    expect(result.scene?.layers[0]?.strokeColor).toBe('#0000ff');
    expect(result.scene?.layers[0]?.strokeWidth).toBe(2);
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
    const result = importLottieDocument(JSON.stringify(baseDocument([{ ty: 6, nm: 'Audio', ks: {} }])));

    expect(result.ok).toBe(false);
    expect(codes(result.diagnostics)).toContain('LOTTIE_UNSUPPORTED_LAYER_TYPE');
    expect(codes(result.diagnostics)).toContain('LOTTIE_EMPTY_SCENE');
  });

  it('reports effects and expressions on a supported layer', () => {
    const layer = solidLayer({ ef: [{ nm: 'Blur' }], hasExpressions: true });
    const result = importLottieDocument(JSON.stringify(baseDocument([layer])));

    expect(codes(result.diagnostics)).toEqual(
      expect.arrayContaining(['LOTTIE_UNSUPPORTED_EFFECT', 'LOTTIE_UNSUPPORTED_EXPRESSION']),
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

describe('Lottie import — layer types the editor and the exporter both accept', () => {
  it('gives every imported layer a supported type instead of a generic placeholder', () => {
    const shapeLayer = {
      ty: 4,
      nm: 'Shape',
      ks: { o: { k: 100 }, r: { k: 0 }, s: { k: 100 }, p: { k: 0 } },
      shapes: [{ ty: 'sh', ks: { k: { c: true, v: [[0, 0], [10, 0], [10, 10]], i: [[0, 0], [0, 0], [0, 0]], o: [[0, 0], [0, 0], [0, 0]] } } }],
    };
    const rectLayer = {
      ty: 4,
      nm: 'Rect',
      ks: { o: { k: 100 }, r: { k: 0 }, s: { k: 100 }, p: { k: 0 } },
      shapes: [{ ty: 'rc', s: { k: [120, 80] } }],
    };
    const ellipseLayer = {
      ty: 4,
      nm: 'Ellipse',
      ks: { o: { k: 100 }, r: { k: 0 }, s: { k: 100 }, p: { k: 0 } },
      shapes: [{ ty: 'el', s: { k: [30, 30] } }],
    };
    const geometryless = { ty: 4, nm: 'Empty', ks: { o: { k: 100 }, r: { k: 0 }, s: { k: 100 }, p: { k: 0 } }, shapes: [] };
    const nullLayer = { ty: 3, nm: 'Rig', ks: { o: { k: 100 }, r: { k: 0 }, s: { k: 100 }, p: { k: 0 } } };

    const result = importLottieDocument(JSON.stringify(baseDocument([
      shapeLayer,
      rectLayer,
      ellipseLayer,
      geometryless,
      nullLayer,
      solidLayer(),
      textLayer({}),
      imageLayer('image_0'),
    ], { assets: [{ id: 'image_0', w: 10, h: 10, u: '', p: PNG_DATA_URL }] })));

    const types = result.scene?.layers.map((layer) => layer.type);
    // Every imported shape, solid and null layer is a freeform path: it is the one
    // supported type whose renderer draws the imported geometry itself.
    expect(types).toEqual([
      'custom_freeform',
      'custom_freeform',
      'custom_freeform',
      'custom_freeform',
      'custom_freeform',
      'custom_freeform',
      'custom_text',
      'custom_image',
    ]);
    // The rectangles and the ellipse carry the path that draws them at their size.
    const [importedPath, importedRect, importedEllipse] = result.scene?.layers ?? [];
    expect(importedPath?.path?.points).toHaveLength(3);
    expect(importedRect?.path?.points.map((point) => [point.x, point.y])).toEqual([[-60, -40], [60, -40], [60, 40], [-60, 40]]);
    expect(importedEllipse?.path?.points.map((point) => [point.x, point.y])).toEqual([[0, -15], [15, 0], [0, 15], [-15, 0]]);
    expect(importedEllipse?.width).toBe(30);
    expect(importedEllipse?.height).toBe(30);
  });

  it('draws the generated rectangle, rounded rectangle and ellipse as curves', () => {
    const rounded = {
      ty: 4,
      nm: 'Rounded',
      ks: { o: { k: 100 }, r: { k: 0 }, s: { k: 100 }, p: { k: 0 } },
      shapes: [{ ty: 'rc', s: { k: [100, 60] }, r: { k: 10 } }],
    };
    const ellipse = {
      ty: 4,
      nm: 'Ellipse',
      ks: { o: { k: 100 }, r: { k: 0 }, s: { k: 100 }, p: { k: 0 } },
      shapes: [{ ty: 'el', s: { k: [60, 40] } }],
    };
    const result = importLottieDocument(JSON.stringify(baseDocument([solidLayer(), rounded, ellipse])));
    const [solid, roundedLayer, ellipseLayer] = result.scene?.layers ?? [];

    // A plain rectangle is a closed square path with no curves.
    expect(buildBezierPathD(solid?.path)).toBe('M -50 -50 L 50 -50 L 50 50 L -50 50 Z');
    // A rounded rectangle is eight vertices whose corners carry absolute handles.
    expect(roundedLayer?.path?.points).toHaveLength(8);
    expect(roundedLayer?.path?.points[0]).toMatchObject({ x: -40, y: -30, kind: 'smooth' });
    expect(roundedLayer?.path?.points[0]?.handleOut?.x).toBeCloseTo(-45.5228, 3);
    expect(roundedLayer?.path?.points[0]?.handleOut?.y).toBe(-30);
    expect(buildBezierPathD(roundedLayer?.path)).toContain('C');
    // An ellipse is four vertices whose handles make it round, not a diamond.
    expect(ellipseLayer?.path?.points).toHaveLength(4);
    expect(ellipseLayer?.path?.points[0]).toMatchObject({ x: 0, y: -20, kind: 'smooth' });
    expect(ellipseLayer?.path?.points[0]?.handleIn?.x).toBeCloseTo(-16.5685, 3);
    expect(ellipseLayer?.path?.points[0]?.handleOut?.x).toBeCloseTo(16.5685, 3);
    const ellipseD = buildBezierPathD(ellipseLayer?.path);
    expect(ellipseD.match(/C /gu)?.length).toBe(4);
  });

  it('reports a shape whose size is only half readable instead of importing an empty layer', () => {
    const shapeLayer = {
      ty: 4,
      nm: 'Half',
      ks: { o: { k: 100 }, r: { k: 0 }, s: { k: 100 }, p: { k: 0 } },
      shapes: [{ ty: 'rc', s: { k: [120, 'wide'] } }],
    };
    const result = importLottieDocument(JSON.stringify(baseDocument([shapeLayer])));

    expect(codes(result.diagnostics)).toContain('LOTTIE_UNREADABLE_SIZE');
    expect(result.scene?.layers[0]?.path).toBeUndefined();
  });

  it('produces a scene the OGraf export validation accepts on type grounds', () => {
    const result = importLottieDocument(JSON.stringify(baseDocument([
      solidLayer(),
      textLayer({}),
      imageLayer('image_0'),
      { ty: 4, nm: 'Shape', ks: { o: { k: 100 }, r: { k: 0 }, s: { k: 100 }, p: { k: 0 } }, shapes: [{ ty: 'sh', ks: { k: { c: true, v: [[0, 0], [10, 0], [10, 10]], i: [[0, 0], [0, 0], [0, 0]], o: [[0, 0], [0, 0], [0, 0]] } } }] },
    ], { assets: [{ id: 'image_0', w: 10, h: 10, u: '', p: PNG_DATA_URL }] })));

    const unsupportedType = validateSceneForOGraf(result.scene!).diagnostics.filter(
      (entry) => entry.severity === 'ERROR' && /not supported by OGraf Export/iu.test(entry.message),
    );
    expect(unsupportedType).toEqual([]);
  });

  it('keeps a construct it cannot convert reported rather than giving it a supported-looking type', () => {
    const result = importLottieDocument(JSON.stringify(baseDocument([
      { ty: 4, nm: 'Effects only', ks: { o: { k: 100 }, r: { k: 0 }, s: { k: 100 }, p: { k: 0 } }, shapes: [{ ty: 'rp', c: { k: 3 } }] },
    ])));

    expect(codes(result.diagnostics)).toContain('LOTTIE_UNSUPPORTED_SHAPE');
    expect(result.scene?.layers[0]?.type).toBe('custom_freeform');
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

const maskPathShape = (vertices: number[][] = [[0, 0], [10, 0], [10, 10]]) => ({
  c: true,
  v: vertices,
  i: vertices.map(() => [0, 0]),
  o: vertices.map(() => [0, 0]),
});

const maskEntry = (overrides: Record<string, unknown> = {}) => ({
  inv: false,
  mode: 'a',
  pt: { k: maskPathShape() },
  o: { k: 100 },
  x: { k: 0 },
  nm: 'Mask 1',
  ...overrides,
});

const maskedLayer = (masks: unknown[], overrides: Record<string, unknown> = {}) => ({
  ty: 4,
  nm: 'Masked',
  ks: { o: { k: 100 }, r: { k: 0 }, s: { k: 100 }, p: { k: 0 } },
  hasMask: true,
  masksProperties: masks,
  ...overrides,
});

describe('Lottie import — masks and track mattes', () => {
  it('maps a static mask onto the KCS layer mask stack', () => {
    const result = importLottieDocument(JSON.stringify(baseDocument([
      maskedLayer([maskEntry({ mode: 's', inv: true, o: { k: 40 }, f: { k: 3 }, x: { k: 2 } })]),
    ])));
    const mask = result.scene?.layers[0]?.masks?.[0];

    expect(mask?.id).toBe('mask-0');
    expect(mask?.name).toBe('Mask 1');
    expect(mask?.mode).toBe('subtract');
    expect(mask?.inverted).toBe(true);
    expect(mask?.opacity).toBeCloseTo(0.4);
    expect(mask?.feather).toBe(3);
    expect(mask?.expansion).toBe(2);
    expect(mask?.path.points).toHaveLength(3);
    expect(codes(result.diagnostics)).not.toContain('LOTTIE_UNREADABLE_MASK');
  });

  it('reports the mask modes KCS cannot represent and skips those masks', () => {
    const result = importLottieDocument(JSON.stringify(baseDocument([
      maskedLayer([maskEntry({ mode: 'n' }), maskEntry({ mode: 'f' }), maskEntry({ mode: 'i' })]),
    ])));

    expect(result.diagnostics.filter((entry) => entry.code === 'LOTTIE_UNSUPPORTED_MASK_MODE')).toHaveLength(2);
    expect(result.scene?.layers[0]?.masks).toHaveLength(1);
    expect(result.scene?.layers[0]?.masks?.[0]?.mode).toBe('intersect');
  });

  it('maps an animated mask path onto the existing mask path channel', () => {
    const animated = {
      k: [
        { t: 0, s: [maskPathShape([[0, 0], [10, 0], [10, 10]])], o: { x: 0.5, y: 0.5 }, i: { x: 0.5, y: 0.5 } },
        { t: 12, s: [maskPathShape([[0, 0], [20, 0], [20, 20]])] },
      ],
    };
    const result = importLottieDocument(JSON.stringify(baseDocument([
      maskedLayer([maskEntry({ pt: animated })], { st: 2 }),
    ])));
    const channel = result.scene?.tracks[0]?.maskPathChannels?.['mask-0:path'];

    expect(channel).toHaveLength(2);
    expect(channel?.[0]?.frame).toBe(0);
    expect(channel?.[1]?.frame).toBe(10);
    expect(channel?.[0]?.easing).toBe('bezier');
    expect(channel?.[0]?.bezierOut).toEqual({ x: 0.5, y: 0.5 });
    expect(channel?.[1]?.bezierIn).toEqual({ x: 0.5, y: 0.5 });
    expect(channel?.[1]?.value.points[1]).toMatchObject({ x: 20, y: 0 });
    expect(result.scene?.layers[0]?.masks?.[0]?.path.points[1]).toMatchObject({ x: 10, y: 0 });
    expect(codes(result.diagnostics)).not.toContain('LOTTIE_UNREADABLE_MASK');
  });

  it('maps an animated mask opacity onto the existing mask channel', () => {
    const result = importLottieDocument(JSON.stringify(baseDocument([
      maskedLayer([maskEntry({ o: { k: [{ t: 0, s: [100] }, { t: 12, s: [50] }] } })]),
    ])));
    const channel = result.scene?.tracks[0]?.maskChannels?.['mask-0:opacity'];

    expect(channel?.map((keyframe) => keyframe.value)).toEqual([1, 0.5]);
    expect(result.scene?.layers[0]?.masks?.[0]?.opacity).toBe(1);
  });

  it('reads the spec path form: vertices and tangents as [x, y] pairs', () => {
    const shapeLayer = {
      ty: 4,
      nm: 'Shape',
      ks: { o: { k: 100 }, r: { k: 0 }, s: { k: 100 }, p: { k: 0 } },
      shapes: [{ ty: 'sh', ks: { k: { c: true, v: [[0, 0], [10, 0], [10, 10]], i: [[-1, 0], [0, 0], [0, 0]], o: [[1, 0], [0, 0], [0, 0]] } } }],
    };
    const result = importLottieDocument(JSON.stringify(baseDocument([shapeLayer])));
    const points = result.scene?.layers[0]?.path?.points;

    expect(points).toHaveLength(3);
    // Lottie's offsets become the absolute control points the renderer reads.
    expect(points?.[0]).toMatchObject({ x: 0, y: 0, handleIn: { x: -1, y: 0 }, handleOut: { x: 1, y: 0 }, kind: 'smooth' });
    expect(points?.[2]).toMatchObject({ x: 10, y: 10 });
    // A curve must survive into the path data the renderer builds.
    expect(buildBezierPathD(result.scene?.layers[0]?.path)).toContain('C 1 0, 10 0, 10 0');
  });

  it('reports a mask whose animated geometry carries unsupported segments', () => {
    const animated = {
      k: [
        { t: 0, s: [maskPathShape()], r: 1 },
        { t: 12, s: [maskPathShape([[0, 0], [20, 0], [20, 20]])] },
      ],
    };
    const result = importLottieDocument(JSON.stringify(baseDocument([maskedLayer([maskEntry({ pt: animated })])])));

    expect(codes(result.diagnostics)).toContain('LOTTIE_ROVING_KEYFRAME');
    expect(result.scene?.tracks[0]?.maskPathChannels?.['mask-0:path']).toHaveLength(2);
  });

  it('reports an unreadable mask field instead of defaulting it', () => {
    const result = importLottieDocument(JSON.stringify(baseDocument([
      maskedLayer([maskEntry({ inv: 'yes', o: 'half', nm: 7 })]),
    ])));

    const paths = result.diagnostics.filter((entry) => entry.code === 'LOTTIE_UNREADABLE_MASK').map((entry) => entry.path);
    expect(paths).toEqual(expect.arrayContaining(['layers[0].masksProperties[0].inv', 'layers[0].masksProperties[0].o', 'layers[0].masksProperties[0].nm']));
    expect(result.scene?.layers[0]?.masks?.[0]?.name).toBe('Mask 1');
  });

  it('reports a broken or missing mask list in both flag states', () => {
    const withoutFlag = { ty: 4, nm: 'Broken', ks: { o: { k: 100 }, r: { k: 0 }, s: { k: 100 }, p: { k: 0 } }, masksProperties: 'nope' };
    const missingList = { ty: 4, nm: 'Flagged', ks: { o: { k: 100 }, r: { k: 0 }, s: { k: 100 }, p: { k: 0 } }, hasMask: true };

    for (const layer of [maskedLayer([], { masksProperties: 'nope' }), withoutFlag, missingList]) {
      const result = importLottieDocument(JSON.stringify(baseDocument([layer])));

      expect(codes(result.diagnostics)).toContain('LOTTIE_UNREADABLE_MASK');
    }
  });

  it('reports an animated mask scalar whose keyframes carry no value', () => {
    const result = importLottieDocument(JSON.stringify(baseDocument([
      maskedLayer([maskEntry({ o: { k: [{ t: 0, s: ['bad'] }] } })]),
    ])));

    const reported = result.diagnostics.filter((entry) => entry.code === 'LOTTIE_UNREADABLE_MASK');
    expect(reported.map((entry) => entry.path)).toContain('layers[0].masksProperties[0].o');
    expect(result.scene?.layers[0]?.masks).toHaveLength(1);
  });

  it('reports masks above the per-layer limit and imports the first ones', () => {
    const masks = Array.from({ length: LOTTIE_IMPORT_LIMITS.masksPerLayer + 1 }, () => maskEntry());
    const result = importLottieDocument(JSON.stringify(baseDocument([maskedLayer(masks)])));

    expect(result.scene?.layers[0]?.masks).toHaveLength(LOTTIE_IMPORT_LIMITS.masksPerLayer);
    expect(result.diagnostics.filter((entry) => entry.code === 'LOTTIE_MASK_LIMIT')).toHaveLength(1);
  });

  it('reports a mask with no readable path instead of importing an empty one', () => {
    const result = importLottieDocument(JSON.stringify(baseDocument([
      maskedLayer([maskEntry({ pt: { k: { c: true, v: [], i: [], o: [] } } })]),
    ])));

    expect(codes(result.diagnostics)).toContain('LOTTIE_UNREADABLE_MASK');
    expect(result.scene?.layers[0]?.masks).toBeUndefined();
  });

  it('maps the four track matte types onto the existing track matte relation', () => {
    const expectations: [number, 'alpha' | 'luminance', boolean][] = [[1, 'alpha', false], [2, 'alpha', true], [3, 'luminance', false], [4, 'luminance', true]];

    for (const [tt, mode, inverted] of expectations) {
      const result = importLottieDocument(JSON.stringify(baseDocument([
        solidLayer({ nm: 'Source', td: 1 }),
        maskedLayer([], { nm: 'Target', tt }),
      ])));
      const target = result.scene?.layers.find((layer) => layer.name === 'Target');

      expect(target?.trackMatte).toMatchObject({ sourceLayerId: 'lottie-layer-0', mode, enabled: true, sourceVisible: false });
      expect(target?.trackMatte?.inverted === true).toBe(inverted);
      expect(codes(result.diagnostics).filter((code) => code.startsWith('LOTTIE_TRACK_MATTE'))).toEqual([]);
    }
  });

  it('reports a track matte whose source layer was not imported', () => {
    const result = importLottieDocument(JSON.stringify(baseDocument([
      { ty: 0, nm: 'Precomp', refId: 'comp_0', ks: {} },
      maskedLayer([], { nm: 'Target', tt: 1 }),
    ])));

    expect(codes(result.diagnostics)).toContain('LOTTIE_TRACK_MATTE_MISSING_SOURCE');
    expect(result.scene?.layers[0]?.trackMatte).toBeUndefined();
  });

  it('reports a matte whose source layer denies being a matte target', () => {
    const result = importLottieDocument(JSON.stringify(baseDocument([
      solidLayer({ nm: 'Source', td: 0 }),
      maskedLayer([], { nm: 'Target', tt: 1 }),
    ])));

    expect(codes(result.diagnostics)).toContain('LOTTIE_TRACK_MATTE_AMBIGUOUS');
    expect(result.diagnostics.find((entry) => entry.code === 'LOTTIE_TRACK_MATTE_AMBIGUOUS')?.path).toBe('layers[0].td');
    expect(result.scene?.layers[1]?.trackMatte).toBeUndefined();
  });

  it('reports an explicit matte parent instead of guessing which layer is the source', () => {
    const result = importLottieDocument(JSON.stringify(baseDocument([
      solidLayer({ nm: 'Source' }),
      maskedLayer([], { nm: 'Target', tt: 1, tp: 0 }),
    ])));

    expect(result.diagnostics.filter((entry) => entry.code === 'LOTTIE_TRACK_MATTE_UNSUPPORTED')).toHaveLength(1);
    expect(result.scene?.layers[1]?.trackMatte).toBeUndefined();
  });

  it('reports a matte flag on a layer whose neighbour declares no matte', () => {
    const result = importLottieDocument(JSON.stringify(baseDocument([
      solidLayer({ nm: 'Source', td: 1 }),
      solidLayer({ nm: 'Plain' }),
    ])));

    const reported = result.diagnostics.filter((entry) => entry.code === 'LOTTIE_TRACK_MATTE_UNSUPPORTED');
    expect(reported).toHaveLength(1);
    expect(reported[0]?.path).toBe('layers[0].td');
  });

  it('produces a masked scene the existing import boundary accepts', () => {
    const result = importLottieDocument(JSON.stringify(baseDocument([
      solidLayer({ nm: 'Source' }),
      maskedLayer([maskEntry(), maskEntry({ mode: 'i', pt: { k: [{ t: 0, s: [maskPathShape()] }] } })], { nm: 'Target', tt: 2 }),
    ])));
    const validated = validateImportedDocument(JSON.stringify(result.scene));

    expect(validated.ok).toBe(true);
    expect(result.scene?.layers[1]?.trackMatte?.mode).toBe('alpha');
    expect(result.scene?.layers[1]?.masks).toHaveLength(2);
  });

  it('produces a masked, matted scene the OGraf export validation accepts', () => {
    const result = importLottieDocument(JSON.stringify(baseDocument([
      solidLayer({ nm: 'Source' }),
      maskedLayer([maskEntry({ mode: 'i' })], { nm: 'Target', tt: 3 }),
    ])));
    const validated = validateSceneForOGraf(result.scene!);
    const matteOrMaskErrors = validated.diagnostics.filter(
      (entry) => entry.severity === 'ERROR' && /matte|mask/iu.test(entry.message),
    );

    // The layer type itself is a separate, pre-existing gap (`custom` is not an
    // OGraf type); what this slice must not do is produce an invalid relation.
    expect(matteOrMaskErrors).toEqual([]);
    expect(validated.diagnostics.map((entry) => entry.code)).not.toContain('OGRAF_INVALID_TRACK_MATTE');
  });

  it('reports an unknown track matte type', () => {
    const result = importLottieDocument(JSON.stringify(baseDocument([
      solidLayer({ nm: 'Source' }),
      maskedLayer([], { nm: 'Target', tt: 9 }),
    ])));

    expect(codes(result.diagnostics)).toContain('LOTTIE_TRACK_MATTE_UNSUPPORTED');
    expect(result.scene?.layers[1]?.trackMatte).toBeUndefined();
  });
});

const PNG_DATA_URL = 'data:image/png;base64,iVBORw0KGgo=';

const textLayer = (document: Record<string, unknown>, overrides: Record<string, unknown> = {}) => ({
  ty: 5,
  nm: 'Title',
  ks: { o: { k: 100 }, r: { k: 0 }, s: { k: 100 }, p: { k: 0 } },
  t: { d: { k: [{ t: 0, s: { t: 'Hello', f: 'Roboto-Bold', s: 32, fc: [1, 0, 0], j: 0, ...document } }] } },
  ...overrides,
});

const imageLayer = (refId: unknown, overrides: Record<string, unknown> = {}) => ({
  ty: 2,
  nm: 'Bitmap',
  refId,
  ks: { o: { k: 100 }, r: { k: 0 }, s: { k: 100 }, p: { k: 0 } },
  ...overrides,
});

const precompLayer = (refId: unknown, overrides: Record<string, unknown> = {}) => ({
  ty: 0,
  nm: 'Nested',
  refId,
  ks: { o: { k: 100 }, r: { k: 0 }, s: { k: 100 }, p: { k: 0 } },
  ...overrides,
});

describe('Lottie import — text, image and precomp layers', () => {
  it('maps a static text layer onto the KCS text fields', () => {
    const result = importLottieDocument(JSON.stringify(baseDocument([textLayer({})])));
    const layer = result.scene?.layers[0];

    expect(layer?.type).toBe('custom_text');
    expect(layer?.textValue).toBe('Hello');
    expect(layer?.fontFamily).toBe('Roboto');
    expect(layer?.fontSize).toBe(32);
    expect(layer?.fillColor).toBe('#ff0000');
    expect(codes(result.diagnostics)).not.toContain('LOTTIE_UNKNOWN_FONT');
    expect(codes(result.diagnostics)).not.toContain('LOTTIE_UNREADABLE_TEXT');
  });

  it('falls back to the default font and reports an unknown family once', () => {
    const result = importLottieDocument(JSON.stringify(baseDocument([
      textLayer({ f: 'Comic Sans MS-Bold' }),
      textLayer({ f: 'Comic Sans MS-Italic' }, { nm: 'Second' }),
    ])));

    const unknown = result.diagnostics.filter((entry) => entry.code === 'LOTTIE_UNKNOWN_FONT');
    expect(unknown).toHaveLength(1);
    expect(result.scene?.layers[0]?.fontFamily).toBeUndefined();
    expect(result.scene?.layers[0]?.textValue).toBe('Hello');
  });

  it('reports a font family the document declares but never uses', () => {
    const result = importLottieDocument(JSON.stringify(baseDocument([solidLayer()], { fonts: { list: [{ fName: 'Arial', fFamily: 'Arial' }] } })));

    expect(codes(result.diagnostics)).toContain('LOTTIE_UNKNOWN_FONT');
  });

  it('reports an animated text document and imports its first document', () => {
    const layer = textLayer({}, {
      t: { d: { k: [{ t: 0, s: { t: 'One', f: 'Inter-Regular', s: 20, fc: [0, 0, 0] } }, { t: 12, s: { t: 'Two', f: 'Inter-Regular', s: 20, fc: [0, 0, 0] } }] } },
    });
    const result = importLottieDocument(JSON.stringify(baseDocument([layer])));

    expect(codes(result.diagnostics)).toContain('LOTTIE_UNSUPPORTED_ANIMATED_TEXT');
    expect(result.scene?.layers[0]?.textValue).toBe('One');
  });

  it('reports the text properties KCS does not model', () => {
    const layer = textLayer({ j: 2, tr: 20, lh: 40 });
    const textProperty = layer.t as { a?: unknown[]; m?: unknown };
    textProperty.a = [{ nm: 'Fade' }];
    textProperty.m = { g: 1 };
    const result = importLottieDocument(JSON.stringify(baseDocument([layer])));

    const reported = codes(result.diagnostics);
    expect(reported).toContain('LOTTIE_UNSUPPORTED_TEXT_STYLE');
    expect(reported).toContain('LOTTIE_UNSUPPORTED_TEXT_ANIMATOR');
    expect(reported).toContain('LOTTIE_UNSUPPORTED_TEXT_LAYOUT');
    expect(result.scene?.layers[0]?.textValue).toBe('Hello');
  });

  it('reports a text layer with no readable document or string', () => {
    const noDocument = { ty: 5, nm: 'Empty', ks: { o: { k: 100 }, r: { k: 0 }, s: { k: 100 }, p: { k: 0 } } };
    const noString = textLayer({}, { t: { d: { k: [{ t: 0, s: { f: 'Inter', s: 20, fc: [0, 0, 0] } }] } } });

    const first = importLottieDocument(JSON.stringify(baseDocument([noDocument])));
    const second = importLottieDocument(JSON.stringify(baseDocument([noString])));

    expect(codes(first.diagnostics)).toContain('LOTTIE_UNREADABLE_TEXT');
    expect(codes(second.diagnostics)).toContain('LOTTIE_UNREADABLE_TEXT');
  });

  it('reports a text layer without a readable colour while the layer keeps the standard colour', () => {
    const layer = textLayer({}, { t: { d: { k: [{ t: 0, s: { t: 'Plain', f: 'Inter', s: 20 } }] } } });
    const result = importLottieDocument(JSON.stringify(baseDocument([layer])));

    const reported = result.diagnostics.find((entry) => entry.code === 'LOTTIE_MISSING_TEXT_COLOUR');
    expect(reported?.path).toBe('layers[0].t.d.k[0].s.fc');
    expect(reported?.action.length).toBeGreaterThan(0);
    expect(result.scene?.layers[0]?.textValue).toBe('Plain');
    expect(result.scene?.layers[0]?.fillColor).toBe('#ffffff');
  });

  it('maps an embedded image asset onto the media layer fields', () => {
    const assets = [{ id: 'image_0', w: 320, h: 180, u: '', p: PNG_DATA_URL, e: 1 }];
    const result = importLottieDocument(JSON.stringify(baseDocument([imageLayer('image_0')], { assets })));
    const layer = result.scene?.layers[0];

    expect(layer?.type).toBe('custom_image');
    expect(layer?.imageUrl).toBe(PNG_DATA_URL);
    expect(layer?.width).toBe(320);
    expect(layer?.height).toBe(180);
  });

  it('reports a missing asset reference and skips the layer', () => {
    const result = importLottieDocument(JSON.stringify(baseDocument([imageLayer('image_9')], { assets: [] })));

    expect(codes(result.diagnostics)).toContain('LOTTIE_MISSING_ASSET');
    expect(result.ok).toBe(false);
    expect(result.scene?.layers).toHaveLength(0);
  });

  it('reports an external image path instead of reading the filesystem', () => {
    const assets = [{ id: 'image_0', w: 10, h: 10, u: 'images/', p: 'img_0.png', e: 0 }];
    const result = importLottieDocument(JSON.stringify(baseDocument([imageLayer('image_0')], { assets })));

    expect(codes(result.diagnostics)).toContain('LOTTIE_UNSUPPORTED_IMAGE_SOURCE');
    expect(result.scene?.layers).toHaveLength(0);
  });

  it('reports an image sequence and an unsupported embedded type', () => {
    const sequence = [{ id: 'seq', w: 10, h: 10, u: '', p: 'data:image/png;base64,frame_%d.png' }];
    const video = [{ id: 'clip', w: 10, h: 10, u: '', p: 'data:video/mp4;base64,AAAA' }];

    const sequenceResult = importLottieDocument(JSON.stringify(baseDocument([imageLayer('seq')], { assets: sequence })));
    const videoResult = importLottieDocument(JSON.stringify(baseDocument([imageLayer('clip')], { assets: video })));

    expect(codes(sequenceResult.diagnostics)).toContain('LOTTIE_UNSUPPORTED_IMAGE_SEQUENCE');
    expect(codes(videoResult.diagnostics)).toContain('LOTTIE_UNSUPPORTED_IMAGE_TYPE');
  });

  it('refuses an embedded SVG that carries a script through the existing image policy', () => {
    const svg = 'data:image/svg+xml;base64,' + Buffer.from('<svg onload="alert(1)"></svg>').toString('base64');
    const assets = [{ id: 'image_0', w: 10, h: 10, u: '', p: svg }];
    const result = importLottieDocument(JSON.stringify(baseDocument([imageLayer('image_0')], { assets })));

    expect(codes(result.diagnostics)).toContain('LOTTIE_UNSUPPORTED_IMAGE_TYPE');
    expect(result.scene?.layers).toHaveLength(0);
  });

  it('reports a precomp layer with its refId and keeps it out of the scene', () => {
    const result = importLottieDocument(JSON.stringify(baseDocument([precompLayer('comp_0')], { assets: [{ id: 'comp_0', layers: [] }] })));

    expect(codes(result.diagnostics)).toContain('LOTTIE_PRECOMP_UNMAPPED');
    expect(result.diagnostics.find((entry) => entry.code === 'LOTTIE_PRECOMP_UNMAPPED')?.message).toContain('comp_0');
    expect(result.scene?.layers).toHaveLength(0);
    expect(codes(result.diagnostics)).not.toContain('LOTTIE_UNSUPPORTED_LAYER_TYPE');
  });

  it('reports a precomp whose asset the document does not carry', () => {
    const result = importLottieDocument(JSON.stringify(baseDocument([precompLayer('comp_missing')], { assets: [] })));

    expect(codes(result.diagnostics)).toContain('LOTTIE_PRECOMP_MISSING_ASSET');
    expect(codes(result.diagnostics)).toContain('LOTTIE_PRECOMP_UNMAPPED');
  });

  it('reports a precomp cycle and an over-deep precomp nesting', () => {
    const cyclic = [
      { id: 'a', layers: [{ ty: 0, refId: 'b' }] },
      { id: 'b', layers: [{ ty: 0, refId: 'a' }] },
    ];
    const deep = Array.from({ length: LOTTIE_IMPORT_LIMITS.hierarchyDepth + 3 }, (_, index) => ({
      id: 'deep_' + index,
      layers: index + 1 < LOTTIE_IMPORT_LIMITS.hierarchyDepth + 3 ? [{ ty: 0, refId: 'deep_' + (index + 1) }] : [],
    }));

    const cycleResult = importLottieDocument(JSON.stringify(baseDocument([precompLayer('a')], { assets: cyclic })));
    const deepResult = importLottieDocument(JSON.stringify(baseDocument([precompLayer('deep_0')], { assets: deep })));

    expect(codes(cycleResult.diagnostics)).toContain('LOTTIE_PRECOMP_CYCLE');
    expect(codes(deepResult.diagnostics)).toContain('LOTTIE_PRECOMP_DEPTH_LIMIT');
  });

  it('points every text diagnostic at the real document node', () => {
    const layer = textLayer({ j: 2 });
    const textProperty = layer.t as { a?: unknown[]; p?: unknown };
    textProperty.a = [{ nm: 'Fade' }];
    textProperty.p = { m: 1 };
    const result = importLottieDocument(JSON.stringify(baseDocument([layer])));
    const pathOf = (code: string) => result.diagnostics.find((entry) => entry.code === code)?.path;

    expect(pathOf('LOTTIE_UNSUPPORTED_TEXT_STYLE')).toBe('layers[0].t.d.k[0].s');
    expect(pathOf('LOTTIE_UNSUPPORTED_TEXT_ANIMATOR')).toBe('layers[0].t.a');
    expect(pathOf('LOTTIE_UNSUPPORTED_TEXT_LAYOUT')).toBe('layers[0].t.p');
  });

  it('points image diagnostics at the asset node and precomp diagnostics at the asset list', () => {
    const image = importLottieDocument(JSON.stringify(baseDocument([imageLayer('image_0')], {
      assets: [{ id: 'image_0', w: 10, h: 10, u: 'images/', p: 'img_0.png' }],
    })));
    const precomp = importLottieDocument(JSON.stringify(baseDocument([precompLayer('comp_0')], {
      assets: [{ id: 'comp_0', layers: [{ ty: 0, refId: 'gone' }] }],
    })));

    expect(image.diagnostics.find((entry) => entry.code === 'LOTTIE_UNSUPPORTED_IMAGE_SOURCE')?.path).toBe('assets[0].p');
    expect(precomp.diagnostics.find((entry) => entry.code === 'LOTTIE_PRECOMP_MISSING_ASSET')?.path).toBe('assets[0].layers[0].refId');
  });

  it('reports every construct once, with the report contract shape', () => {
    const cyclic = [
      { id: 'a', layers: [{ ty: 0, refId: 'b' }] },
      { id: 'b', layers: [{ ty: 0, refId: 'a' }] },
    ];
    const result = importLottieDocument(JSON.stringify(baseDocument([
      precompLayer('a'),
      precompLayer('b', { nm: 'Second' }),
    ], { assets: cyclic })));

    const cycles = result.diagnostics.filter((entry) => entry.code === 'LOTTIE_PRECOMP_CYCLE');
    expect(cycles).toHaveLength(1);
    for (const entry of result.diagnostics) {
      expect(entry.severity).toBe('warning');
      expect(entry.feature).toBe('lottie-import');
      expect(entry.path.length).toBeGreaterThan(0);
      expect(entry.message.length).toBeGreaterThan(0);
      expect(entry.action.length).toBeGreaterThan(0);
    }
  });

  it('reports an unreadable precomp reference and asset list', () => {
    const noRef = importLottieDocument(JSON.stringify(baseDocument([precompLayer(undefined)], { assets: [] })));
    const brokenList = importLottieDocument(JSON.stringify(baseDocument([precompLayer('bad')], { assets: [{ id: 'bad', layers: 'nope' }] })));

    expect(codes(noRef.diagnostics)).toContain('LOTTIE_UNREADABLE_PRECOMP');
    expect(codes(brokenList.diagnostics)).toContain('LOTTIE_UNREADABLE_PRECOMP');
  });

  it('reads a quoted multi-word family name and reports unreadable text fields', () => {
    const quoted = importLottieDocument(JSON.stringify(baseDocument([textLayer({ f: 'BebasNeue-Regular' })])));
    const broken = importLottieDocument(JSON.stringify(baseDocument([textLayer({ f: 7, j: 'wide' })])));

    expect(quoted.scene?.layers[0]?.fontFamily).toBe("'Bebas Neue'");
    expect(codes(quoted.diagnostics)).not.toContain('LOTTIE_UNKNOWN_FONT');
    const unreadable = broken.diagnostics.filter((entry) => entry.code === 'LOTTIE_UNREADABLE_TEXT').map((entry) => entry.path);
    expect(unreadable).toContain('layers[0].t.d.k[0].s.f');
    expect(unreadable).toContain('layers[0].t.d.k[0].s');
  });

  it('never reaches for the network when an image asset lives outside the document', () => {
    const fetchSpy = vi.fn(() => {
      throw new Error('the importer must not fetch');
    });
    vi.stubGlobal('fetch', fetchSpy);

    try {
      const result = importLottieDocument(JSON.stringify(baseDocument([imageLayer('image_0')], {
        assets: [{ id: 'image_0', w: 10, h: 10, u: 'file:///C:/secret/', p: 'photo.png' }],
      })));

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(result.scene?.layers).toHaveLength(0);
      expect(codes(result.diagnostics)).toContain('LOTTIE_UNSUPPORTED_IMAGE_SOURCE');
      expect(result.diagnostics.some((entry) => entry.message.includes('file:///'))).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('keeps a skipped image layer out of every parent reference', () => {
    const result = importLottieDocument(JSON.stringify(baseDocument([
      imageLayer('gone'),
      solidLayer({ nm: 'Child', parent: 0 }),
    ], { assets: [] })));

    expect(result.scene?.layers.map((layer) => layer.name)).toEqual(['Child']);
    expect(result.scene?.layers[0]?.parentId).toBeUndefined();
    expect(codes(result.diagnostics)).toContain('LOTTIE_BROKEN_PARENT');
  });

  it('does not report the shared child of a diamond precomp graph as a cycle', () => {
    const diamond = [
      { id: 'a', layers: [{ ty: 0, refId: 'b' }, { ty: 0, refId: 'c' }] },
      { id: 'b', layers: [{ ty: 0, refId: 'c' }] },
      { id: 'c', layers: [] },
    ];
    const result = importLottieDocument(JSON.stringify(baseDocument([precompLayer('a')], { assets: diamond })));

    expect(codes(result.diagnostics)).not.toContain('LOTTIE_PRECOMP_CYCLE');
    expect(codes(result.diagnostics)).not.toContain('LOTTIE_PRECOMP_DEPTH_LIMIT');
  });

  it('reports the precomp depth limit exactly at the boundary', () => {
    const chain = (length: number) => Array.from({ length }, (_, index) => ({
      id: 'node_' + index,
      layers: index + 1 < length ? [{ ty: 0, refId: 'node_' + (index + 1) }] : [],
    }));
    // The limit counts nesting levels below the first precomposition, the same
    // way the layer parent chain counts ancestors.
    const atLimit = importLottieDocument(JSON.stringify(baseDocument([precompLayer('node_0')], { assets: chain(LOTTIE_IMPORT_LIMITS.hierarchyDepth + 1) })));
    const overLimit = importLottieDocument(JSON.stringify(baseDocument([precompLayer('node_0')], { assets: chain(LOTTIE_IMPORT_LIMITS.hierarchyDepth + 2) })));

    expect(codes(atLimit.diagnostics)).not.toContain('LOTTIE_PRECOMP_DEPTH_LIMIT');
    expect(codes(overLimit.diagnostics)).toContain('LOTTIE_PRECOMP_DEPTH_LIMIT');
  });

  it('reports an unreadable asset height at the height and an unreadable family in the font table', () => {
    const image = importLottieDocument(JSON.stringify(baseDocument([imageLayer('image_0')], {
      assets: [{ id: 'image_0', w: 320, h: 'tall', u: '', p: PNG_DATA_URL }],
    })));
    const fonts = importLottieDocument(JSON.stringify(baseDocument([solidLayer()], { fonts: { list: [{ fFamily: 42 }] } })));

    expect(image.diagnostics.find((entry) => entry.code === 'LOTTIE_UNREADABLE_IMAGE_ASSET')?.path).toBe('assets[0].h');
    expect(codes(fonts.diagnostics)).toContain('LOTTIE_UNREADABLE_TEXT');
    expect(fonts.diagnostics.find((entry) => entry.code === 'LOTTIE_UNREADABLE_TEXT')?.path).toBe('$.fonts.list[0].fFamily');
  });

  it('reports a late precomp component even after a dense graph has been walked', () => {
    // A Fibonacci-shaped (dense but acyclic) component followed by one asset that
    // references a missing precomp: the walk must not stop before the last asset.
    const dense = Array.from({ length: 20 }, (_, index) => ({
      id: 'a' + index,
      layers: [
        ...(index + 1 < 20 ? [{ ty: 0, refId: 'a' + (index + 1) }] : []),
        ...(index + 2 < 20 ? [{ ty: 0, refId: 'a' + (index + 2) }] : []),
      ],
    }));
    const late = { id: 'zzz', layers: [{ ty: 0, refId: 'gone' }] };
    const result = importLottieDocument(JSON.stringify(baseDocument([precompLayer('a0')], { assets: [...dense, late] })));

    const missing = result.diagnostics.filter((entry) => entry.code === 'LOTTIE_PRECOMP_MISSING_ASSET');
    expect(missing).toHaveLength(1);
    expect(missing[0]?.path).toBe('assets[20].layers[0].refId');
    expect(codes(result.diagnostics)).not.toContain('LOTTIE_PRECOMP_DEPTH_LIMIT');
  });

  it('keeps the layer order and transform of an image and a text layer deterministic', () => {
    const assets = [{ id: 'image_0', w: 20, h: 10, u: '', p: PNG_DATA_URL }];
    const result = importLottieDocument(JSON.stringify(baseDocument([
      imageLayer('image_0', { nm: 'Top' }),
      textLayer({ t: 'Below' }, { nm: 'Bottom', ks: { o: { k: 50 }, r: { k: 0 }, s: { k: 100 }, p: { k: 30 } } }),
    ], { assets })));

    expect(result.scene?.layers.map((layer) => layer.name)).toEqual(['Top', 'Bottom']);
    expect(result.scene?.layers.map((layer) => layer.zIndex)).toEqual([2, 1]);
    expect(result.scene?.layers[1]?.y).toBe(30);
    expect(result.scene?.layers[1]?.opacity).toBe(0.5);
  });
});
