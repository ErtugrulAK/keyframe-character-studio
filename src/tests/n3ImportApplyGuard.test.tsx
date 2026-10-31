import { useCallback, useState } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSerialization } from '../hooks/useSerialization';
import { AUTOSAVE_STORAGE_KEY } from '../utils/editor/constants';
import type { CharacterPart, MotionTemplate, Track } from '../types/animator';
import type { SceneCoordinateSystem } from '../types/composition';

/**
 * N3 PR-1 — a refused import must be a true no-op.
 *
 * The boundary refuses hostile timeline/canvas numbers (see
 * importValidation.test.ts); these tests pin the APPLY side against the real
 * hook: a refused document fires ZERO state setters and never re-requests the
 * history baseline, and a tampered autosave (the fps 0.4 freeze payload) is
 * refused at restore so the session keeps documented defaults, leaves the
 * storage bytes untouched, and does not adopt the hostile document.
 */

interface WriteCounts {
  fps: number;
  totalFrames: number;
  resolution: number;
  tracks: number;
  parts: number;
}

const sceneDocument = (overrides: Record<string, unknown> = {}) => JSON.stringify({
  version: 1,
  coordinateSystem: 'project-unit-center-v1',
  name: 'N3',
  width: 1920,
  height: 1080,
  fps: 30,
  totalFrames: 60,
  layers: [],
  tracks: [],
  ...overrides,
});

const renderGuardedEditor = (rawSeed?: string) => {
  if (rawSeed !== undefined) window.localStorage.setItem(AUTOSAVE_STORAGE_KEY, rawSeed);
  const counts: WriteCounts = { fps: 0, totalFrames: 0, resolution: 0, tracks: 0, parts: 0 };
  const baselineCalls = { count: 0 };
  let latest!: {
    importProject: (json: string) => { ok: boolean; diagnostics: { code: string; path: string; severity: string }[] };
    fps: number;
    totalFrames: number;
    projectResolution: { width: number; height: number };
    tracks: Track[];
    characterParts: CharacterPart[];
    restoredFromLocalStorage: boolean;
    lastSavedAt: Date | null;
  };

  renderHook(() => {
    const [fps, setFpsState] = useState(24);
    const [totalFrames, setTotalFramesState] = useState(48);
    const [projectResolution, setProjectResolutionState] = useState({ width: 1920, height: 1080 });
    const [tracks, setTracksState] = useState<Track[]>([]);
    const [characterParts, setCharacterPartsState] = useState<CharacterPart[]>([]);
    const [coordinateSystem, setCoordinateSystem] = useState<SceneCoordinateSystem>('project-unit-center-v1');
    const [projectTemplates, setProjectTemplates] = useState<any[]>([]);
    const [templateCanvasStore, setTemplateCanvasStore] = useState<any>(null);
    const [sceneTitle, setSceneTitleState] = useState('Guard');
    const [activeTemplateId, setActiveTemplateIdState] = useState('A');
    const [motionTemplates, setMotionTemplates] = useState<MotionTemplate[]>([]);
    const [activeProjectTemplateId, setActiveProjectTemplateIdState] = useState('default');
    void projectTemplates;
    void templateCanvasStore;
    const setFps = useCallback((next: number | ((prev: number) => number)) => {
      counts.fps += 1;
      setFpsState(next);
    }, []);
    const setTotalFrames = useCallback((next: number | ((prev: number) => number)) => {
      counts.totalFrames += 1;
      setTotalFramesState(next);
    }, []);
    const setProjectResolution = useCallback(
      (next: { width: number; height: number } | ((prev: { width: number; height: number }) => { width: number; height: number })) => {
      counts.resolution += 1;
      setProjectResolutionState(next);
    }, []);
    const setTracks = useCallback((next: Track[] | ((prev: Track[]) => Track[])) => {
      counts.tracks += 1;
      setTracksState(next);
    }, []);
    const setCharacterParts = useCallback((next: CharacterPart[] | ((prev: CharacterPart[]) => CharacterPart[])) => {
      counts.parts += 1;
      setCharacterPartsState(next);
    }, []);
    const requestHistoryBaseline = useCallback(() => {
      baselineCalls.count += 1;
    }, []);
    // The hooks settle through renders; assertions must read the CURRENT render.
    const serialization = useSerialization({
      fps, setFps,
      totalFrames, setTotalFrames,
      projectResolution, setProjectResolution,
      coordinateSystem, setCoordinateSystem,
      tracks, setTracks,
      characterParts, setCharacterParts,
      activeProjectTemplateId, setActiveProjectTemplateIdState,
      motionTemplates, setMotionTemplates,
      activeTemplateId, setActiveTemplateIdState,
      sceneTitle, setSceneTitleState,
      setProjectTemplates, setTemplateCanvasStore,
      setCurrentFrame: () => undefined,
      setIsPlaying: () => undefined,
      requestHistoryBaseline,
    });
    latest = {
      importProject: serialization.importProject,
      fps,
      totalFrames,
      projectResolution,
      tracks,
      characterParts,
      restoredFromLocalStorage: serialization.restoredFromLocalStorage,
      lastSavedAt: serialization.lastSavedAt,
    };
    return null;
  });
  // Flush the mount-time restore effects and their queued state updates so
  // `latest` reflects the settled document rather than the first render.
  act(() => undefined);

  return { counts, baselineCalls, read: () => latest };
};

describe('N3 PR-1 — refused imports are true no-ops at the apply path', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('T11 applies zero state setters for a document refused on canvas bounds', () => {
    const editor = renderGuardedEditor();
    const before = editor.read();

    const result = editor.read().importProject(sceneDocument({ width: 1e9 }));

    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe('KCS_IMPORT_INVALID_CANVAS');
    expect(result.diagnostics[0]?.path).toBe('$.width');
    expect(editor.counts).toEqual({ fps: 0, totalFrames: 0, resolution: 0, tracks: 0, parts: 0 });
    expect(editor.baselineCalls.count).toBe(0);
    const after = editor.read();
    expect(after.fps).toBe(before.fps);
    expect(after.totalFrames).toBe(before.totalFrames);
    expect(after.projectResolution).toEqual(before.projectResolution);
  });

  it('T11b refuses the fps freeze payload and mutates nothing', () => {
    const editor = renderGuardedEditor();

    const result = editor.read().importProject(sceneDocument({ fps: 0.4 }));

    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe('KCS_IMPORT_INVALID_TIMELINE');
    expect(result.diagnostics[0]?.path).toBe('$.fps');
    expect(editor.counts.fps).toBe(0);
    expect(editor.counts.totalFrames).toBe(0);
    expect(editor.baselineCalls.count).toBe(0);
  });

  it('T12 restores defaults — not the tampered autosave — and keeps the storage bytes', () => {
    const tampered = sceneDocument({ fps: 0.4 });
    const editor = renderGuardedEditor(tampered);

    const after = editor.read();
    expect(after.restoredFromLocalStorage).toBe(false);
    expect(after.fps).toBe(24);
    expect(after.totalFrames).toBe(48);
    expect(after.projectResolution).toEqual({ width: 1920, height: 1080 });
    expect(after.tracks).toHaveLength(0);
    expect(after.characterParts).toHaveLength(0);
    expect(after.lastSavedAt).toBeNull();
    expect(editor.counts).toEqual({ fps: 0, totalFrames: 0, resolution: 0, tracks: 0, parts: 0 });
    expect(editor.baselineCalls.count).toBe(0);
    expect(window.localStorage.getItem(AUTOSAVE_STORAGE_KEY)).toBe(tampered);
  });

  it('T12b restores a legitimate autosave document normally (no over-refusal)', () => {
    const editor = renderGuardedEditor(sceneDocument({ fps: 60, totalFrames: 90, width: 1920.5 }));

    const after = editor.read();
    expect(after.fps).toBe(60);
    expect(after.totalFrames).toBe(90);
    expect(after.projectResolution).toEqual({ width: 1920.5, height: 1080 });
  });
});

describe('N3 PR-2d — refused id-integrity documents are true no-ops too', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('T13 applies zero state setters for a document refused on duplicate track targets', () => {
    const editor = renderGuardedEditor();
    const before = editor.read();

    const result = editor.read().importProject(sceneDocument({
      layers: [
        { id: 'L1', name: 'A', type: 'custom_box', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 0, fillColor: '#fff', strokeColor: '#000' },
      ],
      tracks: [{ partId: 'L1', channels: {} }, { partId: 'L1', channels: {} }],
    }));

    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe('KCS_IMPORT_DUPLICATE_TRACK_TARGET');
    expect(result.diagnostics[0]?.path).toBe('$.tracks[1].partId');
    expect(editor.counts).toEqual({ fps: 0, totalFrames: 0, resolution: 0, tracks: 0, parts: 0 });
    expect(editor.baselineCalls.count).toBe(0);
    const after = editor.read();
    expect(after.tracks).toBe(before.tracks);
    expect(after.characterParts).toBe(before.characterParts);
  });
});
