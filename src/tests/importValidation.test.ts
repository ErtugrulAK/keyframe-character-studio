import { describe, expect, it } from 'vitest';
import {
  MAX_IMPORT_CHARACTERS,
  MAX_IMPORT_LAYERS,
  validateImportedDocument,
} from '../utils/importValidation';

/**
 * The import boundary is the only place untrusted project text becomes a typed
 * document, so these cases pin the refusal contract: what is refused, with which
 * code, and that a legitimate document of either kind still passes.
 */
const refusalCode = (text: string): string | undefined => {
  const result = validateImportedDocument(text);
  return result.ok ? undefined : result.diagnostics[0]?.code;
};

describe('KCS import boundary — scene fields the apply path consumes after it queues its updates', () => {
  it('refuses a scene whose motion templates are not a list', () => {
    const result = validateImportedDocument(JSON.stringify({ version: 1, layers: [], tracks: [], motionTemplates: { length: 1 } }));

    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe('KCS_IMPORT_INVALID_SCENE_FIELD');
    expect(result.diagnostics[0]?.path).toBe('$.motionTemplates');
  });

  it('refuses a document that nests deeper than the walk can check', () => {
    let nested: unknown = 1;
    for (let depth = 0; depth < 70; depth += 1) nested = { child: nested };
    const result = validateImportedDocument(JSON.stringify({ version: 1, layers: [], tracks: [], sceneTitle: nested }));

    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe('KCS_IMPORT_TOO_DEEP');
  });

  it('refuses a scene with an unknown coordinate system or a non-text active template', () => {
    const coordinate = validateImportedDocument(JSON.stringify({ version: 1, layers: [], tracks: [], coordinateSystem: 'not-a-system' }));
    const active = validateImportedDocument(JSON.stringify({ version: 1, layers: [], tracks: [], activeTemplateId: 7 }));

    expect(coordinate.diagnostics[0]?.path).toBe('$.coordinateSystem');
    expect(active.diagnostics[0]?.path).toBe('$.activeTemplateId');
  });
});

/**
 * The second pass checks the values the renderers and the evaluator read at
 * frame time. Those are reached long after the import returned, so a wrong
 * shape there used to surface as a blank stage or a component crash rather than
 * as a refused file.
 */
describe('KCS import boundary — values the renderers and the evaluator read', () => {
  /** A minimal applyable scene; each case breaks exactly one field. */
  const scene = (overrides: Record<string, unknown> = {}) => JSON.stringify({
    version: 2,
    fps: 30,
    totalFrames: 90,
    width: 1920,
    height: 1080,
    layers: [],
    tracks: [],
    ...overrides,
  });

  const layer = (overrides: Record<string, unknown> = {}) => ({ id: 'L1', zIndex: 0, type: 'custom_box', ...overrides });

  it('refuses a scene version this build does not know', () => {
    // WP-08: 3 is known (scenes that use effects); the next one is not.
    const result = validateImportedDocument(scene({ version: 4 }));

    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe('KCS_IMPORT_UNSUPPORTED_VERSION');
    expect(result.diagnostics[0]?.path).toBe('$.version');
  });

  it.each([
    ['a negative frame rate', { fps: -10 }, '$.fps'],
    ['a zero frame rate', { fps: 0 }, '$.fps'],
    ['a frame rate that is not a number', { fps: '30' }, '$.fps'],
    ['a zero-length timeline', { totalFrames: 0 }, '$.totalFrames'],
  ])('refuses %s', (_label, overrides, path) => {
    const result = validateImportedDocument(scene(overrides));

    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe('KCS_IMPORT_INVALID_TIMELINE');
    expect(result.diagnostics[0]?.path).toBe(path);
  });

  it.each([
    ['a non-numeric width', { width: 'oops' }, '$.width'],
    ['a negative height', { height: -2 }, '$.height'],
    ['a zero width', { width: 0 }, '$.width'],
  ])('refuses %s', (_label, overrides, path) => {
    const result = validateImportedDocument(scene(overrides));

    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe('KCS_IMPORT_INVALID_CANVAS');
    expect(result.diagnostics[0]?.path).toBe(path);
  });

  it('refuses a layer text value that is not text', () => {
    const result = validateImportedDocument(scene({ layers: [layer({ type: 'custom_text', textValue: { bad: 1 } })] }));

    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe('KCS_IMPORT_INVALID_LAYER');
    expect(result.diagnostics[0]?.path).toBe('$.layers[0].textValue');
  });

  it('refuses a layer without a usable id or z-order', () => {
    const noId = validateImportedDocument(scene({ layers: [{ zIndex: 0 }] }));
    const noZ = validateImportedDocument(scene({ layers: [{ id: 'L1' }] }));

    expect(noId.diagnostics[0]?.path).toBe('$.layers[0].id');
    expect(noZ.diagnostics[0]?.path).toBe('$.layers[0].zIndex');
  });

  it('refuses two layers that share an id', () => {
    const result = validateImportedDocument(scene({ layers: [layer(), layer({ zIndex: 1 })] }));

    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe('KCS_IMPORT_DUPLICATE_LAYER_ID');
    expect(result.diagnostics[0]?.path).toBe('$.layers[1].id');
  });

  it('refuses a non-numeric layer coordinate', () => {
    const result = validateImportedDocument(scene({ layers: [layer({ x: '5' })] }));

    expect(result.diagnostics[0]?.code).toBe('KCS_IMPORT_INVALID_LAYER');
    expect(result.diagnostics[0]?.path).toBe('$.layers[0].x');
  });

  it('refuses a freeform path the geometry builder cannot walk', () => {
    const noPoints = validateImportedDocument(scene({ layers: [layer({ path: { version: 1 } })] }));
    const onePoint = validateImportedDocument(scene({
      layers: [layer({ path: { version: 1, points: [{ x: 0, y: 0 }] } })],
    }));

    expect(noPoints.diagnostics[0]?.path).toBe('$.layers[0].path.points');
    expect(onePoint.diagnostics[0]?.path).toBe('$.layers[0].path');
  });

  it('refuses a mask the mask evaluator would dereference blindly', () => {
    const result = validateImportedDocument(scene({ layers: [layer({ masks: [{ id: 'm1', mode: 'add' }] })] }));

    expect(result.diagnostics[0]?.code).toBe('KCS_IMPORT_INVALID_LAYER');
    expect(result.diagnostics[0]?.path).toBe('$.layers[0].masks[0].path');
  });

  it('refuses a channel that is not a keyframe list', () => {
    const result = validateImportedDocument(scene({ tracks: [{ partId: 'L1', channels: { x: { length: 1 } } }] }));

    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe('KCS_IMPORT_INVALID_TRACK');
    expect(result.diagnostics[0]?.path).toBe('$.tracks[0].channels.x');
  });

  it('refuses a keyframe whose value is not a finite number', () => {
    const result = validateImportedDocument(scene({
      tracks: [{ partId: 'L1', channels: { x: [{ id: 'k', frame: 0, value: 'nope' }] } }],
    }));

    expect(result.diagnostics[0]?.code).toBe('KCS_IMPORT_INVALID_TRACK');
    expect(result.diagnostics[0]?.path).toBe('$.tracks[0].channels.x[0].value');
  });

  it('refuses a track that names no layer', () => {
    const result = validateImportedDocument(scene({ tracks: [{ channels: { x: [] } }] }));

    expect(result.diagnostics[0]?.path).toBe('$.tracks[0].partId');
  });

  it('refuses a sequence entry that is not an object', () => {
    const result = validateImportedDocument(scene({ motionTemplates: [null] }));

    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe('KCS_IMPORT_INVALID_TEMPLATE');
    expect(result.diagnostics[0]?.path).toBe('$.motionTemplates[0]');
  });

  it('accepts a scene that relies on the documented defaults', () => {
    // Absent numerics, canvas and sequence metadata mean "the documented
    // default", which the editor applies today: only a *present* wrong value is
    // malformed.
    const result = validateImportedDocument(JSON.stringify({
      version: 1,
      layers: [{ id: 'L1', zIndex: 0 }],
      tracks: [{ partId: 'L1' }],
    }));

    expect(result.ok).toBe(true);
  });

  it('accepts a scene carrying masks, a freeform path and path channels', () => {
    const path = {
      version: 1,
      coordinateSpace: 'local',
      closed: true,
      points: [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 40 }],
    };
    const result = validateImportedDocument(scene({
      layers: [layer({
        masks: [{ id: 'm1', mode: 'add', inverted: false, opacity: 1, feather: 0, expansion: 0, path }],
        path,
        points: [{ x: 0, y: 0 }, { x: 5, y: 5 }],
      })],
      tracks: [{
        partId: 'L1',
        channels: { x: [{ id: 'k', frame: 0, value: 1, easing: 'linear' }] },
        maskChannels: { 'm1:opacity': [{ id: 'mk', frame: 0, value: 1, easing: 'linear' }] },
        maskPathChannels: { 'm1:path': [{ id: 'pk', frame: 0, value: path, easing: 'linear' }] },
      }],
    }));

    expect(result.ok).toBe(true);
  });
});

describe('project import boundary', () => {
  /** The smallest legacy project the editor can actually apply. */
  const legacyProject = (overrides: Record<string, unknown> = {}) => JSON.stringify({
    characterParts: [{
      id: 'p1', name: 'Part', type: 'custom_rect', zIndex: 1,
      baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    }],
    tracks: [{ partId: 'p1', channels: {} }],
    ...overrides,
  });

  it('accepts a current scene document', () => {
    const result = validateImportedDocument(JSON.stringify({ version: 1, name: 'Scene', layers: [], tracks: [] }));

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.document.kind).toBe('scene');
  });

  it('accepts a legacy project document', () => {
    const result = validateImportedDocument(legacyProject());

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.document.kind).toBe('legacy-project');
  });

  it('refuses malformed JSON with a stable code', () => {
    expect(refusalCode('{ not json')).toBe('KCS_IMPORT_MALFORMED_JSON');
  });

  it('refuses a document that is neither scene nor legacy project', () => {
    expect(refusalCode(JSON.stringify({ hello: 'world' }))).toBe('KCS_IMPORT_UNKNOWN_SHAPE');
  });

  it('refuses a document larger than the import limit before parsing it', () => {
    const oversized = `{"pad":"${'x'.repeat(MAX_IMPORT_CHARACTERS)}"}`;

    expect(refusalCode(oversized)).toBe('KCS_IMPORT_TOO_LARGE');
  });

  it('refuses a prototype-sensitive key at the top level', () => {
    expect(refusalCode('{"__proto__": {"polluted": true}}')).toBe('KCS_IMPORT_UNSAFE_KEY');
  });

  it('refuses a prototype-sensitive key nested inside the document', () => {
    const document = JSON.stringify({ version: 1, layers: [{ id: 'l1', nested: { list: [{ constructor: {} }] } }], tracks: [] });

    expect(refusalCode(document)).toBe('KCS_IMPORT_UNSAFE_KEY');
  });

  it('names the offending path so the author can find it', () => {
    const result = validateImportedDocument(JSON.stringify({ version: 1, layers: [{ prototype: {} }], tracks: [] }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics[0].path).toContain('layers');
      expect(result.diagnostics[0].message).toContain('prototype');
      expect(result.diagnostics[0].action.length).toBeGreaterThan(0);
    }
  });

  it('refuses a document above the declared layer limit', () => {
    const characterParts = Array.from({ length: MAX_IMPORT_LAYERS + 1 }, (_, index) => ({ id: `p${index}` }));

    expect(refusalCode(JSON.stringify({ characterParts, tracks: [] }))).toBe('KCS_IMPORT_TOO_MANY_LAYERS');
  });
});

/**
 * A legacy project reaches the stage through its own apply path, which keeps
 * every part verbatim — so a part the renderers cannot lay out used to import
 * "successfully" and only fail later, when the editor tried to draw it.
 */
describe('KCS import boundary — legacy project values the editor applies verbatim', () => {
  const part = (overrides: Record<string, unknown> = {}) => ({
    id: 'p1', name: 'Part', type: 'custom_rect', zIndex: 1,
    fillColor: '#ffffff', strokeColor: '#000000',
    baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    ...overrides,
  });
  const legacyProject = (characterParts: unknown[], tracks: unknown[] = []) =>
    JSON.stringify({ version: '5.0', characterParts, tracks, fps: 30, totalFrames: 60 });

  const refusal = (characterParts: unknown[], tracks: unknown[] = []) => {
    const result = validateImportedDocument(legacyProject(characterParts, tracks));
    return result.ok ? undefined : result.diagnostics[0];
  };

  it('refuses a part that is not an object instead of applying it', () => {
    const diagnostic = refusal([null]);

    expect(diagnostic?.code).toBe('KCS_IMPORT_INVALID_LAYER');
    expect(diagnostic?.path).toBe('$.characterParts[0]');
    expect(diagnostic?.action.length).toBeGreaterThan(0);
  });

  it('refuses a part without a usable id, type or z-order', () => {
    expect(refusal([part({ id: undefined })])?.path).toBe('$.characterParts[0].id');
    expect(refusal([part({ id: '' })])?.path).toBe('$.characterParts[0].id');
    expect(refusal([part({ type: undefined })])?.path).toBe('$.characterParts[0].type');
    expect(refusal([part({ zIndex: 'first' })])?.path).toBe('$.characterParts[0].zIndex');
  });

  it('refuses a part whose base transform the evaluator cannot multiply', () => {
    expect(refusal([part({ baseTransform: undefined })])?.path).toBe('$.characterParts[0].baseTransform');
    expect(refusal([part({ baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } })])?.path)
      .toBe('$.characterParts[0].baseTransform.opacity');
    expect(refusal([part({ baseTransform: { ...part().baseTransform, y: 'top' } })])?.path)
      .toBe('$.characterParts[0].baseTransform.y');
  });

  it('refuses duplicate ids and non-numeric renderer fields', () => {
    expect(refusal([part(), part({ id: 'p1' })])?.code).toBe('KCS_IMPORT_DUPLICATE_LAYER_ID');
    expect(refusal([part({ textValue: { nested: true } })])?.path).toBe('$.characterParts[0].textValue');
    expect(refusal([part({ fontSize: Number.NaN })])?.path).toBe('$.characterParts[0].fontSize');
  });

  it('refuses a track whose channels or keyframes the evaluator cannot read', () => {
    const track = (overrides: Record<string, unknown>) => ({ partId: 'p1', channels: {}, ...overrides });

    expect(refusal([part()], [track({ partId: undefined })])?.path).toBe('$.tracks[0].partId');
    expect(refusal([part()], [track({ channels: { x: [{ id: 'k', frame: 0, value: Number.NaN, easing: 'linear' }] } })])?.path)
      .toBe('$.tracks[0].channels.x[0].value');
    expect(refusal([part()], [track({ keyframes: [{ id: 'k', frame: 'zero', transform: {} }] })])?.path)
      .toBe('$.tracks[0].keyframes[0]');
  });

  it('still accepts a legacy project that carries the values the editor reads', () => {
    const path = {
      version: 1,
      coordinateSpace: 'local',
      closed: true,
      points: [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 40 }],
    };
    const result = validateImportedDocument(legacyProject(
      [part({ path, points: [{ x: 0, y: 0 }, { x: 5, y: 5 }], masks: [{ id: 'm1', path }] })],
      [{
        partId: 'p1',
        channels: { x: [{ id: 'cx', frame: 0, value: 12, easing: 'linear' }] },
        keyframes: [{ id: 'kf', frame: 0, transform: { x: 1, y: 2 }, easing: 'linear' }],
      }],
    ));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.kind).toBe('legacy-project');
      expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain('KCS_IMPORT_LEGACY_MIGRATED');
    }
  });
});

/**
 * N3 PR-1 — bounded numeric acceptance at the single import boundary.
 *
 * A positive fractional fps used to pass the boundary and then round to zero
 * inside the state setter, freezing playback with no diagnostic; oversized
 * canvases and timelines used to be "accepted" and silently rewritten by the
 * state clamp — accepted ≠ applied. The boundary now refuses everything the
 * state could not honestly apply, on BOTH routes (scene and legacy), and a
 * refusal never mutates state or re-requests the history baseline.
 * The ranges mirror the editor's own authored bounds (rates 24/30/60/120,
 * the [10,1200] frame clamp in usePlayback, viewBox-sized canvases) with
 * headroom; fractions stay legal for canvas sizes (Lottie maps them).
 */
describe('N3 PR-1 — timeline and canvas numeric bounds at the import boundary', () => {
  const scene = (overrides: Record<string, unknown> = {}) => JSON.stringify({
    version: 2,
    fps: 30,
    totalFrames: 90,
    width: 1920,
    height: 1080,
    layers: [],
    tracks: [],
    ...overrides,
  });

  const legacy = (overrides: Record<string, unknown> = {}) => JSON.stringify({
    version: '5.0',
    characterParts: [{
      id: 'p1', name: 'Part', type: 'custom_rect', zIndex: 1,
      baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    }],
    tracks: [{ partId: 'p1', channels: {} }],
    fps: 30,
    totalFrames: 60,
    ...overrides,
  });

  const refusalOf = (text: string) => {
    const result = validateImportedDocument(text);
    return result.ok ? undefined : result.diagnostics[0];
  };

  it.each([
    ['fps just under the floor', scene({ fps: 0.4 }), '$.fps'],
    ['fps below the rounding-safe floor', scene({ fps: 0.49 }), '$.fps'],
    ['fps above the supported ceiling', scene({ fps: 240.5 }), '$.fps'],
    ['an absurd fps', scene({ fps: 1e9 }), '$.fps'],
    ['an Infinity fps from raw JSON', '{"version":2,"layers":[],"tracks":[],"fps":1e999}', '$.fps'],
  ])('refuses a scene with %s', (_label, text, path) => {
    const diagnostic = refusalOf(text);

    expect(diagnostic?.code).toBe('KCS_IMPORT_INVALID_TIMELINE');
    expect(diagnostic?.path).toBe(path);
  });

  it.each([
    ['a timeline below the editor minimum', scene({ totalFrames: 9 }), '$.totalFrames'],
    ['a timeline above the editor maximum', scene({ totalFrames: 1201 }), '$.totalFrames'],
    ['an absurd timeline', scene({ totalFrames: 1e7 }), '$.totalFrames'],
    ['a fractional timeline the state would silently round', scene({ totalFrames: 60.5 }), '$.totalFrames'],
  ])('refuses %s', (_label, text, path) => {
    const diagnostic = refusalOf(text);

    expect(diagnostic?.code).toBe('KCS_IMPORT_INVALID_TIMELINE');
    expect(diagnostic?.path).toBe(path);
  });

  it.each([
    ['a one-pixel canvas', scene({ width: 1 }), '$.width'],
    ['a canvas above the supported maximum', scene({ width: 16385 }), '$.width'],
    ['an absurd canvas', scene({ height: 1e9 }), '$.height'],
  ])('refuses %s', (_label, text, path) => {
    const diagnostic = refusalOf(text);

    expect(diagnostic?.code).toBe('KCS_IMPORT_INVALID_CANVAS');
    expect(diagnostic?.path).toBe(path);
  });

  it.each([
    ['fps 0.4 that froze playback', legacy({ fps: 0.4 }), '$.fps'],
    ['fps 1e9', legacy({ fps: 1e9 }), '$.fps'],
    ['a negative timeline', legacy({ totalFrames: -5 }), '$.totalFrames'],
    ['a fractional timeline', legacy({ totalFrames: 60.5 }), '$.totalFrames'],
    ['an oversized canvas width', legacy({ projectResolution: { width: 1e9, height: 1080 } }), '$.projectResolution.width'],
    ['a sub-pixel canvas height', legacy({ projectResolution: { width: 1920, height: 1 } }), '$.projectResolution.height'],
  ])('refuses the same class on the legacy route: %s', (_label, text, path) => {
    const diagnostic = refusalOf(text);

    expect(diagnostic?.code).toBe(
      String(path).startsWith('$.projectResolution') ? 'KCS_IMPORT_INVALID_CANVAS' : 'KCS_IMPORT_INVALID_TIMELINE',
    );
    expect(diagnostic?.path).toBe(path);
  });

  it('refuses a numeric unsupported version wearing the legacy shape (probe R02)', () => {
    const diagnostic = refusalOf(legacy({ version: 99 }));

    expect(diagnostic?.code).toBe('KCS_IMPORT_UNSUPPORTED_VERSION');
    expect(diagnostic?.path).toBe('$.version');
  });

  it('still refuses nothing a compatible legacy document carries', () => {
    expect(validateImportedDocument(legacy()).ok).toBe(true);
    expect(validateImportedDocument(legacy({ version: undefined })).ok).toBe(true);
    // A junk resolution object keeps the documented drop-to-default narrowing.
    expect(validateImportedDocument(legacy({ projectResolution: 'auto' })).ok).toBe(true);
    // Numeric version 1 is a supported schema, so the legacy guard accepts it.
    expect(validateImportedDocument(legacy({ version: 1 })).ok).toBe(true);
  });

  it.each([
    ['the floor rate', scene({ fps: 0.5 })],
    ['the ceiling rate', scene({ fps: 240 })],
    ['a mapped fractional rate', scene({ fps: 29.97 })],
    ['the minimum timeline', scene({ totalFrames: 10 })],
    ['the maximum timeline', scene({ totalFrames: 1200 })],
    ['a two-pixel canvas', scene({ width: 2, height: 2 })],
    ['a fractional canvas from Lottie mapping', scene({ width: 1920.5, height: 1080.25 })],
    ['the maximum canvas', scene({ width: 16384, height: 16384 })],
    ['a scene without any timing or canvas fields', '{"version":1,"layers":[],"tracks":[]}'],
  ])('accepts %s', (_label, text) => {
    const result = validateImportedDocument(text);

    expect(result.ok).toBe(true);
  });

  it('emits exactly one error diagnostic per refusal', () => {
    const result = validateImportedDocument(scene({ fps: 0.4, totalFrames: 9000 }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')).toHaveLength(1);
      expect(result.diagnostics.filter((diagnostic) => diagnostic.severity === 'warning')).toHaveLength(0);
    }
  });
});

/**
 * N3 PR-2d — structural id integrity at the single import boundary.
 *
 * Confirmed consumer contracts this matrix pins:
 * - The evaluator addresses tracks by `partId` with a first-match `find`, and
 *   the apply path DERIVES `track_${partId}` as the track id, so two tracks
 *   naming one layer mean the second is never evaluated, selected or edited.
 * - `locateKeyframe` searches one track across ALL its stores by id, so a
 *   keyframe id repeated inside one track (same or different channel, same or
 *   legacy store) makes timeline edits address the wrong keyframe.
 * - Layer masks are dereferenced by `mask.id` (channel key `${id}:opacity`,
 *   DOM id `kcs-layer-mask-<part>-<id>`), so duplicate mask ids inside one
 *   layer collide their animated data and their SVG definitions.
 * The JSON `track.id` field is NOT read by the apply path (the id is derived),
 * so duplicated track ids are pinned as ACCEPTED — refusing them would reject
 * documents nothing breaks on. Missing ids stay accepted (C11 open product
 * decision); only duplicates of present string ids refuse.
 */
describe('N3 PR-2d — structural id integrity at the import boundary', () => {
  const scene = (overrides: Record<string, unknown> = {}) => JSON.stringify({
    version: 2,
    fps: 30,
    totalFrames: 90,
    width: 1920,
    height: 1080,
    layers: [],
    tracks: [],
    ...overrides,
  });
  const layer = (overrides: Record<string, unknown> = {}) => ({ id: 'L1', zIndex: 0, type: 'custom_box', ...overrides });
  const track = (partId: string, channels: Record<string, unknown[]> = {}) => ({ partId, channels });
  const kf = (id: string, frame: number) => ({ id, frame, value: frame, easing: 'linear' });
  const legacy = (characterParts: unknown[], tracks: unknown[]) =>
    JSON.stringify({ version: '5.0', characterParts, tracks, fps: 30, totalFrames: 60 });
  const part = (overrides: Record<string, unknown> = {}) => ({
    id: 'p1', name: 'Part', type: 'custom_rect', zIndex: 1,
    baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    ...overrides,
  });
  const refusal = (text: string) => {
    const result = validateImportedDocument(text);
    return result.ok ? undefined : result.diagnostics[0];
  };
  const maskPath = {
    version: 1, coordinateSpace: 'local', closed: true,
    points: [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 40 }],
  };

  it('refuses two tracks that animate the same layer', () => {
    const result = refusal(scene({
      layers: [layer({ id: 'L1' }), layer({ id: 'L2', zIndex: 1 })],
      tracks: [track('L1'), track('L1', { x: [kf('k1', 0)] })],
    }));

    expect(result?.code).toBe('KCS_IMPORT_DUPLICATE_TRACK_TARGET');
    expect(result?.path).toBe('$.tracks[1].partId');
    expect(result?.action.length).toBeGreaterThan(0);
  });

  it('refuses a second track naming the same layer through the legacy layerId alias', () => {
    const result = refusal(scene({
      layers: [layer({ id: 'L1' })],
      tracks: [track('L1'), { layerId: 'L1', channels: {} }],
    }));

    expect(result?.code).toBe('KCS_IMPORT_DUPLICATE_TRACK_TARGET');
    expect(result?.path).toBe('$.tracks[1].partId');
  });

  it('refuses a duplicate track target before reporting its inner keyframe collision', () => {
    const result = refusal(scene({
      layers: [layer({ id: 'L1' })],
      tracks: [track('L1', { x: [kf('k1', 0)] }), track('L1', { x: [kf('k1', 0)] })],
    }));

    expect(result?.code).toBe('KCS_IMPORT_DUPLICATE_TRACK_TARGET');
    expect(result?.path).toBe('$.tracks[1].partId');
  });

  it('refuses two keyframes sharing an id inside one channel', () => {
    const result = refusal(scene({
      layers: [layer()],
      tracks: [track('L1', { x: [kf('k1', 0), kf('k1', 45)] })],
    }));

    expect(result?.code).toBe('KCS_IMPORT_DUPLICATE_KEYFRAME_ID');
    expect(result?.path).toBe('$.tracks[0].channels.x[1].id');
  });

  it('refuses one id shared across two channels of the same track (locateKeyframe spans stores)', () => {
    const result = refusal(scene({
      layers: [layer()],
      tracks: [track('L1', { x: [kf('k1', 0)], y: [kf('k1', 30)] })],
    }));

    expect(result?.code).toBe('KCS_IMPORT_DUPLICATE_KEYFRAME_ID');
    expect(result?.path).toBe('$.tracks[0].channels.y[0].id');
  });

  it('refuses a channel keyframe reusing a legacy composite id in the same track (legacy store wins locate)', () => {
    const result = refusal(scene({
      layers: [layer()],
      tracks: [{ ...track('L1', { x: [kf('k1', 0)] }), keyframes: [{ id: 'k1', frame: 0, transform: { x: 0, y: 0 }, easing: 'linear' }] }],
    }));

    expect(result?.code).toBe('KCS_IMPORT_DUPLICATE_KEYFRAME_ID');
    expect(result?.path).toBe('$.tracks[0].channels.x[0].id');
  });

  it('refuses duplicate keyframe ids in mask channels and mask path channels of one track', () => {
    const maskDup = refusal(scene({
      layers: [layer()],
      tracks: [{ ...track('L1'), maskChannels: { 'm1:opacity': [kf('k1', 0), kf('k1', 10)] } }],
    }));
    const maskPathDup = refusal(scene({
      layers: [layer()],
      tracks: [{
        ...track('L1'),
        maskPathChannels: { 'm1:path': [
          { id: 'p1', frame: 0, value: maskPath },
          { id: 'p1', frame: 10, value: maskPath },
        ] },
      }],
    }));

    expect(maskDup?.code).toBe('KCS_IMPORT_DUPLICATE_KEYFRAME_ID');
    expect(maskDup?.path).toBe('$.tracks[0].maskChannels.m1:opacity[1].id');
    expect(maskPathDup?.code).toBe('KCS_IMPORT_DUPLICATE_KEYFRAME_ID');
    expect(maskPathDup?.path).toBe('$.tracks[0].maskPathChannels.m1:path[1].id');
  });

  it('accepts the same keyframe id in two different tracks and a distinct-id document throughout', () => {
    const reusedAcrossTracks = validateImportedDocument(scene({
      layers: [layer({ id: 'L1' }), layer({ id: 'L2', zIndex: 1 })],
      tracks: [track('L1', { x: [kf('k1', 0)] }), track('L2', { x: [kf('k1', 0)] })],
    }));
    const distinct = validateImportedDocument(scene({
      layers: [
        layer({ id: 'L1', masks: [{ id: 'm1', mode: 'add', path: maskPath }, { id: 'm2', mode: 'subtract', path: maskPath }] }),
        layer({ id: 'L2', zIndex: 1, masks: [{ id: 'm1', mode: 'add', path: maskPath }] }),
      ],
      tracks: [
        track('L1', { x: [kf('k1', 0), kf('k2', 45)] }),
        track('L2', { x: [kf('k1', 0)] }),
      ],
    }));

    expect(reusedAcrossTracks.ok).toBe(true);
    expect(distinct.ok).toBe(true);
  });

  it('accepts duplicated JSON track id fields because the apply path derives its own ids', () => {
    const result = validateImportedDocument(scene({
      layers: [layer({ id: 'L1' }), layer({ id: 'L2', zIndex: 1 })],
      tracks: [
        { ...track('L1'), id: 'same' },
        { ...track('L2'), id: 'same' },
      ],
    }));

    expect(result.ok).toBe(true);
  });

  it('refuses two masks sharing an id inside one layer but accepts the id across layers', () => {
    const refused = refusal(scene({
      layers: [layer({ masks: [{ id: 'm1', mode: 'add', path: maskPath }, { id: 'm1', mode: 'subtract', path: maskPath }] })],
    }));
    const acrossLayers = validateImportedDocument(scene({
      layers: [
        layer({ id: 'L1', masks: [{ id: 'm1', mode: 'add', path: maskPath }] }),
        layer({ id: 'L2', zIndex: 1, masks: [{ id: 'm1', mode: 'add', path: maskPath }] }),
      ],
    }));

    expect(refused?.code).toBe('KCS_IMPORT_DUPLICATE_MASK_ID');
    expect(refused?.path).toBe('$.layers[0].masks[1].id');
    expect(acrossLayers.ok).toBe(true);
  });

  it('keeps missing ids accepted on every store shape (C11 open decision, duplicates-only rule)', () => {
    const noKeyframeIds = validateImportedDocument(scene({
      layers: [layer()],
      tracks: [{ partId: 'L1', channels: { x: [{ frame: 0, value: 3, easing: 'linear' }] }, keyframes: [{ frame: 0, transform: { x: 0, y: 0 }, easing: 'linear' }] }],
    }));
    const noMaskId = validateImportedDocument(scene({
      layers: [layer({ masks: [{ mode: 'add', path: maskPath }] })],
    }));
    const noTrackIdField = validateImportedDocument(scene({
      layers: [layer()],
      tracks: [{ partId: 'L1', channels: {}, keyframes: [{ frame: 0, transform: { x: 0, y: 0 }, easing: 'linear' }] }],
    }));

    expect(noKeyframeIds.ok).toBe(true);
    expect(noMaskId.ok).toBe(true);
    expect(noTrackIdField.ok).toBe(true);
  });

  it('refuses the same duplicates on the legacy route', () => {
    const duplicateTarget = refusal(legacy([part()], [track('p1'), track('p1')]));
    expect(duplicateTarget?.code).toBe('KCS_IMPORT_DUPLICATE_TRACK_TARGET');
    expect(duplicateTarget?.path).toBe('$.tracks[1].partId');

    const duplicateKeyframe = refusal(legacy([part()], [{ partId: 'p1', channels: { x: [kf('k1', 0), kf('k1', 9)] } }]));
    expect(duplicateKeyframe?.code).toBe('KCS_IMPORT_DUPLICATE_KEYFRAME_ID');
    expect(duplicateKeyframe?.path).toBe('$.tracks[0].channels.x[1].id');

    const duplicateMask = refusal(legacy([part({ masks: [{ id: 'm1', path: maskPath }, { id: 'm1', path: maskPath }] })], []));
    expect(duplicateMask?.code).toBe('KCS_IMPORT_DUPLICATE_MASK_ID');
    expect(duplicateMask?.path).toBe('$.characterParts[0].masks[1].id');
  });

  it('emits exactly one error diagnostic and prefers the earliest refusal class', () => {
    const result = validateImportedDocument(scene({
      layers: [layer({ masks: [{ id: 'm1', mode: 'add', path: maskPath }, { id: 'm1', mode: 'add', path: maskPath }] })],
      tracks: [track('L1'), track('L1')],
    }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const errors = result.diagnostics.filter((diagnostic) => diagnostic.severity === 'error');
      expect(errors).toHaveLength(1);
      expect(errors[0]?.path).toBe('$.layers[0].masks[1].id');
    }
  });
});
