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
    const result = validateImportedDocument(scene({ version: 3 }));

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
  it('accepts a current scene document', () => {
    const result = validateImportedDocument(JSON.stringify({ version: 1, name: 'Scene', layers: [], tracks: [] }));

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.document.kind).toBe('scene');
  });

  it('accepts a legacy project document', () => {
    const result = validateImportedDocument(JSON.stringify({ characterParts: [{ id: 'p1' }], tracks: [{ partId: 'p1', channels: {} }] }));

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
