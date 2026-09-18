import { describe, expect, it } from 'vitest';
import { validateImportedDocument } from '../utils/importValidation';

/**
 * The compatibility matrix from `docs/design/KCS_MILESTONE_F_INTEROP_STUDY.md` §4,
 * executed as fixtures: one document per supported kind, asserting the decision
 * (apply) and the report the user sees (refusal code, or the migration warning).
 */
const SCENE_V1 = {
  version: 1,
  name: 'Fixture Scene',
  fps: 30,
  totalFrames: 90,
  projectResolution: { width: 1920, height: 1080 },
  coordinateSystem: 'project-unit-center-v1',
  layers: [{ id: 'part-1', name: 'Box', type: 'custom', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 0, fillColor: '#fff', strokeColor: '#000' }],
  tracks: [{ partId: 'part-1', channels: { x: [{ id: 'kf-1', frame: 0, value: 0, easing: 'linear' }] } }],
};

const SCENE_V2 = { ...SCENE_V1, version: 2, name: 'Fixture Scene v2' };

const LEGACY_PROJECT = {
  sceneTitle: 'Legacy Fixture',
  fps: 24,
  totalFrames: 48,
  characterParts: [{ id: 'part-1', name: 'Head', type: 'head' }],
  tracks: [{ id: 'track-1', partId: 'part-1', channels: {}, keyframes: [] }],
  motionTemplates: [{ id: 'seq-1', name: 'Sequence' }],
};

describe('project import compatibility matrix', () => {
  it('applies a current scene (v1) with no report', () => {
    const result = validateImportedDocument(JSON.stringify(SCENE_V1));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.kind).toBe('scene');
      expect(result.diagnostics).toEqual([]);
    }
  });

  it('applies a current scene (v2) with no report', () => {
    const result = validateImportedDocument(JSON.stringify(SCENE_V2));

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.document.kind).toBe('scene');
  });

  it('applies a legacy project and reports the migration it will run', () => {
    const result = validateImportedDocument(JSON.stringify(LEGACY_PROJECT));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.kind).toBe('legacy-project');
      expect(result.diagnostics.map((entry) => entry.code)).toEqual(['KCS_IMPORT_LEGACY_MIGRATED']);
      expect(result.diagnostics[0].severity).toBe('warning');
      expect(result.diagnostics[0].action.length).toBeGreaterThan(0);
    }
  });

  it('does not report a migration for a scene document', () => {
    const result = validateImportedDocument(JSON.stringify(SCENE_V1));

    expect(result.diagnostics.some((entry) => entry.code === 'KCS_IMPORT_LEGACY_MIGRATED')).toBe(false);
  });

  it('refuses a document that is not a project of either kind', () => {
    const result = validateImportedDocument(JSON.stringify({ version: 'one', hello: 'world' }));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.diagnostics[0].code).toBe('KCS_IMPORT_UNKNOWN_SHAPE');
  });
});
