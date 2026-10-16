import { useCallback, useRef, useState } from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useHistory, type HistoryDocumentState } from '../hooks/useHistory';
import { useSerialization } from '../hooks/useSerialization';
import { AUTOSAVE_STORAGE_KEY } from '../utils/constants';
import type { CharacterPart, MotionTemplate, Track } from '../types/animator';
import type { SceneCoordinateSystem } from '../types/composition';

/**
 * N1 — restore/undo S0 data-loss-looking bug.
 *
 * Loading the autosaved project into a fresh session is INITIALIZATION, not a
 * user-undoable edit. The history baseline (S0) must therefore be the RESTORED
 * scene, never the empty mount-time document: Ctrl+Z with zero user edits must
 * be inert, and the undo ladder must stop AT the restored scene — not below it.
 * These tests pin that boundary against the real useHistory/useSerialization
 * pairing (ephemeral jsdom storage only) plus the documented import/reset
 * contracts the fix must not disturb.
 */

interface EditorApi {
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  startBatchInteraction: () => void;
  endBatchInteraction: () => void;
  importProject: (jsonStr: string, defaultName?: string) => { ok: boolean };
  resetProject: () => void;
  exportProject: () => string;
  restoredFromLocalStorage: boolean;
  tracks: Track[];
  characterParts: CharacterPart[];
  setCharacterParts: React.Dispatch<React.SetStateAction<CharacterPart[]>>;
  sceneTitle: string;
  fps: number;
  totalFrames: number;
  projectResolution: { width: number; height: number };
}

const rectPart = (id: string, x = 0): CharacterPart => ({
  id,
  name: id,
  type: 'custom_rect',
  x,
  y: 0,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
  visible: true,
  zIndex: 1,
  fillColor: '#22d3ee',
  strokeColor: '#101218',
  fillEnabled: true,
  strokeEnabled: false,
  width: 120,
  height: 90,
});

/** A representative SceneData v2 autosave: shape group with a child, a rect, a text, keyed tracks. */
const autosaveScene = () => ({
  version: 2,
  coordinateSystem: 'project-unit-center-v1',
  name: 'N1 Fixture',
  width: 1280,
  height: 720,
  fps: 30,
  totalFrames: 60,
  layers: [
    { id: 'n1-group', name: 'Group', type: 'custom_box', x: 0, y: 0, rotation: 0, scaleX: 2, scaleY: 2, opacity: 1, visible: true, zIndex: 1, fillColor: '#ffffff', strokeColor: '#000000' },
    { id: 'n1-child', name: 'Child', type: 'custom_rect', parentId: 'n1-group', x: 30, y: 10, rotation: 15, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 2, fillColor: '#3a86ff', strokeColor: '#000000', width: 40, height: 40 },
    { id: 'n1-rect', name: 'Rect', type: 'custom_rect', x: -200, y: -60, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 3, fillColor: '#ff006d', strokeColor: '#000000', width: 80, height: 80 },
    { id: 'n1-text', name: 'Greeting', type: 'text', textValue: 'Restore me', fontFamily: 'Inter', x: 120, y: 90, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, visible: true, zIndex: 4, fillColor: '#ffffff', strokeColor: '#000000' },
  ],
  tracks: [
    {
      id: 'n1-track-rect', partId: 'n1-rect', name: 'Rect', color: '#fff', visible: true, locked: false,
      channels: {
        x: [
          { id: 'n1-k1', frame: 0, value: -200, easing: 'linear' },
          { id: 'n1-k2', frame: 30, value: -160, easing: 'ease-in' },
          { id: 'n1-k3', frame: 60, value: -240, easing: 'linear' },
        ],
      },
    },
    {
      id: 'n1-track-child', partId: 'n1-child', name: 'Child', color: '#eee', visible: true, locked: false,
      channels: {
        rotation: [
          { id: 'n1-k4', frame: 0, value: 15, easing: 'linear' },
          { id: 'n1-k5', frame: 30, value: -15, easing: 'linear' },
        ],
      },
    },
  ],
});

const restoredIds = ['n1-group', 'n1-child', 'n1-rect', 'n1-text'];
/** A representative legacy AnimationProject autosave (version is a string, so the
 * boundary routes it to the legacy apply path; fields follow legacyPartProblem and
 * trackProblem — exactly what the validator accepts today). */
const legacyPart = (id: string, x: number) => ({
  id,
  name: id,
  type: 'custom_rect',
  zIndex: 1,
  baseTransform: { x, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
  width: 80,
  height: 60,
});

const LEGACY_DOCUMENT = {
  version: '5.0',
  idCounter: 12,
  fps: 25,
  totalFrames: 96,
  projectResolution: { width: 1024, height: 768 },
  sceneTitle: 'Legacy QA Scene',
  lastSavedTime: '2026-10-16T09:00:00.000Z',
  characterParts: [legacyPart('p1', -140), legacyPart('p2', 90)],
  tracks: [
    {
      id: 'track_p1',
      partId: 'p1',
      name: 'Track p1',
      color: '#3b82f6',
      keyframes: [
        { id: 'kf_1', frame: 0, transform: { x: -140, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } },
        { id: 'kf_2', frame: 24, transform: { x: -40, y: 20, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } },
      ],
      channels: {
        x: [
          { id: 'ck_1', frame: 0, value: -140, easing: 'linear' },
          { id: 'ck_2', frame: 24, value: -40, easing: 'linear' },
        ],
        y: [
          { id: 'ck_3', frame: 0, value: 0, easing: 'linear' },
          { id: 'ck_4', frame: 24, value: 20, easing: 'linear' },
        ],
      },
    },
  ],
};

const legacyAutosave = (project: Record<string, unknown> = {}) =>
  JSON.stringify({ ...LEGACY_DOCUMENT, ...project });


/** Renders the two hooks as the provider wires them (live document state derived per render). */
const renderEditor = (options: { seed?: boolean; rawSeed?: string; strict?: boolean } = {}): EditorApi => {
  if (options.seed || options.rawSeed !== undefined) {
    window.localStorage.setItem(AUTOSAVE_STORAGE_KEY, options.rawSeed ?? JSON.stringify(autosaveScene()));
  }
  let api!: EditorApi;
  renderHook(
    () => {
      const [tracks, setTracks] = useState<Track[]>([]);
      const [characterParts, setCharacterParts] = useState<CharacterPart[]>([]);
      const tracksRef = useRef(tracks);
      const partsRef = useRef(characterParts);
      // oxlint-disable-next-line react/refs
      tracksRef.current = tracks;
      // oxlint-disable-next-line react/refs
      partsRef.current = characterParts;

      const [fps, setFps] = useState(24);
      const [totalFrames, setTotalFrames] = useState(48);
      const [projectResolution, setProjectResolution] = useState({ width: 1920, height: 1080 });
      const [coordinateSystem, setCoordinateSystem] = useState<SceneCoordinateSystem>('project-unit-center-v1');
      const [sceneTitle, setSceneTitleState] = useState('Fixture');
      const [activeTemplateId, setActiveTemplateIdState] = useState('Sequence');
      const [motionTemplates, setMotionTemplates] = useState<MotionTemplate[]>([]);
      const [activeProjectTemplateId, setActiveProjectTemplateIdState] = useState('default');
      const [projectTemplates, setProjectTemplates] = useState([]);
      const [templateCanvasStore, setTemplateCanvasStore] = useState(null);
      // The import/reset paths below touch these stores; the assertions read the
      // visible document instead, so the values themselves stay unreferenced.
      void projectTemplates;
      void templateCanvasStore;

      // Same contract as the provider: a fresh derived object per render, which
      // useHistory deduplicates by CONTENT (documentStateKey), not identity.
      const documentState: HistoryDocumentState = {
        fps, totalFrames, projectResolution, coordinateSystem, sceneTitle, activeTemplateId,
      };
      const restoreDocumentState = useCallback((next: HistoryDocumentState) => {
        setFps(next.fps);
        setTotalFrames(next.totalFrames);
        setProjectResolution(next.projectResolution);
        setCoordinateSystem(next.coordinateSystem);
        setSceneTitleState(next.sceneTitle);
        setActiveTemplateIdState(next.activeTemplateId);
      }, []);

      const history = useHistory({
        tracks,
        setTracks,
        tracksRef,
        characterParts,
        setCharacterParts,
        characterPartsRef: partsRef,
        documentState,
        restoreDocumentState,
      });
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
        requestHistoryBaseline: history.requestBaselineReset,
      });

      api = {
        ...history,
        importProject: serialization.importProject,
        resetProject: serialization.resetProject,
        exportProject: serialization.exportProject,
        restoredFromLocalStorage: serialization.restoredFromLocalStorage,
        tracks,
        characterParts,
        setCharacterParts,
        sceneTitle,
      fps,
      totalFrames,
      projectResolution,
      };
      return null;
    },
    { reactStrictMode: options.strict === true },
  );
  // Read through getters: the hooks settle into further renders after the
  // assertions start, and the tests must observe the CURRENT render's state.
  return {
    get undo() { return api.undo; },
    get redo() { return api.redo; },
    get canUndo() { return api.canUndo; },
    get canRedo() { return api.canRedo; },
    get startBatchInteraction() { return api.startBatchInteraction; },
    get endBatchInteraction() { return api.endBatchInteraction; },
    get importProject() { return api.importProject; },
    get resetProject() { return api.resetProject; },
    get exportProject() { return api.exportProject; },
    get restoredFromLocalStorage() { return api.restoredFromLocalStorage; },
    get tracks() { return api.tracks; },
    get characterParts() { return api.characterParts; },
    get setCharacterParts() { return api.setCharacterParts; },
    get sceneTitle() { return api.sceneTitle; },
    get fps() { return api.fps; },
    get totalFrames() { return api.totalFrames; },
    get projectResolution() { return api.projectResolution; },
  };
};

describe('N1 — restored project is the history baseline (restore is initialization)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('A. a restored scene with zero user edits is NOT undoable — Ctrl+Z cannot empty it', () => {
    const api = renderEditor({ seed: true });
    expect(api.restoredFromLocalStorage).toBe(true);
    expect(api.characterParts.map((part) => part.id)).toEqual(restoredIds);
    // The scene on screen IS the baseline: nothing to undo, and undo is inert.
    expect(api.canUndo).toBe(false);
    act(() => api.undo());
    expect(api.characterParts.map((part) => part.id)).toEqual(restoredIds);
  });

  it('B. one own edit undoes back to the RESTORED scene, and redo returns the edit', () => {
    const api = renderEditor({ seed: true });
    act(() => api.setCharacterParts([...api.characterParts, rectPart('n1-mine')]));
    expect(api.characterParts.map((part) => part.id)).toContain('n1-mine');
    expect(api.canUndo).toBe(true);
    act(() => api.undo());
    // Not the empty mount-time document — exactly the restored scene.
    expect(api.characterParts.map((part) => part.id)).toEqual(restoredIds);
    act(() => api.redo());
    expect(api.characterParts.map((part) => part.id)).toEqual([...restoredIds, 'n1-mine']);
  });

  it('C. repeated undo stops AT the restored baseline and redo replays edits in order', () => {
    const api = renderEditor({ seed: true });
    act(() => api.setCharacterParts([...api.characterParts, rectPart('a')]));
    act(() => api.setCharacterParts([...api.characterParts, rectPart('b')]));
    act(() => api.setCharacterParts([...api.characterParts, rectPart('c')]));
    expect(api.characterParts.map((part) => part.id)).toEqual([...restoredIds, 'a', 'b', 'c']);
    act(() => { api.undo(); api.undo(); api.undo(); });
    expect(api.characterParts.map((part) => part.id)).toEqual(restoredIds);
    // The baseline is the floor: one more undo cannot reach a pre-restore state.
    expect(api.canUndo).toBe(false);
    act(() => api.undo());
    expect(api.characterParts.map((part) => part.id)).toEqual(restoredIds);
    act(() => { api.redo(); api.redo(); api.redo(); });
    expect(api.characterParts.map((part) => part.id)).toEqual([...restoredIds, 'a', 'b', 'c']);
  });

  it('D. editing after undo discards the redo branch without touching restored layers', () => {
    const api = renderEditor({ seed: true });
    act(() => api.setCharacterParts([...api.characterParts, rectPart('a')]));
    act(() => api.setCharacterParts([...api.characterParts, rectPart('b')]));
    act(() => api.undo());
    expect(api.characterParts.map((part) => part.id)).toEqual([...restoredIds, 'a']);
    act(() => api.setCharacterParts([...api.characterParts, rectPart('d')]));
    expect(api.canRedo).toBe(false);
    expect(api.characterParts.map((part) => part.id)).toEqual([...restoredIds, 'a', 'd']);
    act(() => api.undo());
    expect(api.characterParts.map((part) => part.id)).toEqual([...restoredIds, 'a']);
    act(() => api.undo());
    expect(api.characterParts.map((part) => part.id)).toEqual(restoredIds);
  });

  it('E. one batched gesture is exactly one undo entry over the restored baseline', () => {
    const api = renderEditor({ seed: true });
    // Production pacing: the batch opens, state settles through real renders
    // (the mousemove frames), and the batch closes after — each in its own task.
    act(() => api.startBatchInteraction());
    act(() => api.setCharacterParts((prev) => [...prev, rectPart('g1', 10)]));
    act(() => api.setCharacterParts((prev) => [...prev, rectPart('g2', 20)]));
    act(() => api.endBatchInteraction());
    expect(api.characterParts.map((part) => part.id)).toEqual([...restoredIds, 'g1', 'g2']);
    expect(api.canUndo).toBe(true);
    // ONE undo retires the whole gesture — straight back to the restored scene.
    act(() => api.undo());
    expect(api.characterParts.map((part) => part.id)).toEqual(restoredIds);
    expect(api.canUndo).toBe(false);
  });

  it('F1. a corrupted autosave is refused and the empty default stays the baseline', () => {
    window.localStorage.setItem(AUTOSAVE_STORAGE_KEY, '{"layers":"not-an-array"');
    const api = renderEditor({});
    expect(api.restoredFromLocalStorage).toBe(false);
    expect(api.characterParts).toEqual([]);
    expect(api.canUndo).toBe(false);
    act(() => api.undo());
    expect(api.characterParts).toEqual([]);
  });

  it('F2. an explicit import stays one undoable transaction (documented contract)', () => {
    const api = renderEditor({});
    act(() => {
      const result = api.importProject(JSON.stringify(autosaveScene()));
      expect(result.ok).toBe(true);
    });
    expect(api.characterParts.map((part) => part.id)).toEqual(restoredIds);
    // Unlike the startup restore, an import IS user-undoable.
    expect(api.canUndo).toBe(true);
    act(() => api.undo());
    expect(api.characterParts).toEqual([]);
  });

  it('G. StrictMode double mount does not reseed or duplicate the restore baseline', () => {
    const api = renderEditor({ seed: true, strict: true });
    expect(api.restoredFromLocalStorage).toBe(true);
    expect(api.characterParts.map((part) => part.id)).toEqual(restoredIds);
    expect(api.canUndo).toBe(false);
    act(() => api.setCharacterParts([...api.characterParts, rectPart('a')]));
    act(() => api.undo());
    // Still ONE undo to the restored scene — no double-seeded empty floor.
    expect(api.characterParts.map((part) => part.id)).toEqual(restoredIds);
    expect(api.canUndo).toBe(false);
  });

  it('H. the restored scene keeps semantic parity — parts, parenting, text, channels', () => {
    const api = renderEditor({ seed: true });
    const partsById = new Map(api.characterParts.map((part) => [part.id, part]));
    expect([...partsById.keys()].sort()).toEqual([...restoredIds].sort());
    expect(partsById.get('n1-child')?.parentId).toBe('n1-group');
    const textPart = partsById.get('n1-text');
    expect(textPart && 'textValue' in textPart ? textPart.textValue : undefined).toBe('Restore me');
    const rect = api.tracks.find((track) => track.partId === 'n1-rect');
    expect(rect?.channels?.x?.map((key) => [key.frame, key.value, key.easing, key.id])).toEqual([
      [0, -200, 'linear', 'n1-k1'],
      [30, -160, 'ease-in', 'n1-k2'],
      [60, -240, 'linear', 'n1-k3'],
    ]);
    const child = api.tracks.find((track) => track.partId === 'n1-child');
    expect(child?.channels?.rotation?.length).toBe(2);
    // Document-level fields travel with the restore and the undo floor.
    expect(api.sceneTitle).toBe('N1 Fixture');
  });
});

describe('N1-legacy — the legacy AnimationProject autosave is initialization too', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('F3. a restored legacy project is the baseline: zero-edit Ctrl+Z is inert and the ladder floors at the restored scene', () => {
    const api = renderEditor({ rawSeed: legacyAutosave() });
    expect(api.restoredFromLocalStorage).toBe(true);
    expect(api.characterParts.map((part) => part.id)).toEqual(['p1', 'p2']);
    expect(api.tracks.map((track) => track.id)).toEqual(['track_p1']);
    expect(api.fps).toBe(25);
    expect(api.totalFrames).toBe(96);
    expect(api.projectResolution).toEqual({ width: 1024, height: 768 });
    // Pre-N1 contract, pinned unchanged: the legacy STARTUP path never
    // restores the scene title (only explicit import does).
    expect(api.sceneTitle).toBe('Fixture');
    // Same contract as the SceneData path: the restore is the baseline, not an edit.
    expect(api.canUndo).toBe(false);
    act(() => api.undo());
    expect(api.characterParts.map((part) => part.id)).toEqual(['p1', 'p2']);
    expect(api.fps).toBe(25);

    // One own edit undoes back to EXACTLY the restored document; redo replays it.
    act(() => api.setCharacterParts((prev) => [...prev, rectPart('legacy-mine')]));
    expect(api.canUndo).toBe(true);
    act(() => api.undo());
    expect(api.characterParts.map((part) => part.id)).toEqual(['p1', 'p2']);
    expect(api.fps).toBe(25);
    expect(api.canRedo).toBe(true);
    act(() => api.redo());
    expect(api.characterParts.map((part) => part.id)).toEqual(['p1', 'p2', 'legacy-mine']);

    // Excessive undo stops AT the restored floor and goes inert.
    act(() => {
      api.undo();
      api.undo();
      api.undo();
      api.undo();
    });
    expect(api.characterParts.map((part) => part.id)).toEqual(['p1', 'p2']);
    expect(api.totalFrames).toBe(96);
    expect(api.canUndo).toBe(false);
  });

  it('F3b. StrictMode double mount does not reseed or duplicate the legacy baseline', () => {
    const api = renderEditor({ rawSeed: legacyAutosave(), strict: true });
    expect(api.restoredFromLocalStorage).toBe(true);
    expect(api.characterParts.map((part) => part.id)).toEqual(['p1', 'p2']);
    expect(api.tracks).toHaveLength(1);
    expect(api.canUndo).toBe(false);
  });

  it('F4. a validator-accepted legacy document whose keyframes omit ids still restores as the baseline', () => {
    // trackProblem/legacyKeyframeProblem require frame+transform but NOT ids, and
    // the legacy id sweep reads them — absence must not turn into a thrown
    // half-restore (history left at [default, applied] with a phantom undo).
    const keyframe = { id: 'kf_9', frame: 12, transform: { x: 5, y: 6, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } };
    const { id: _omit, ...keyframeWithoutId } = keyframe;
    void _omit;
    const channelKey = { id: 'ck_9', frame: 12, value: 33, easing: 'linear' };
    const { id: _omit2, ...channelKeyWithoutId } = channelKey;
    void _omit2;
    const seed = legacyAutosave({
      tracks: [
        {
          id: 'track_p1',
          partId: 'p1',
          name: 'Track p1',
          color: '#3b82f6',
          keyframes: [keyframeWithoutId],
          channels: { x: [channelKeyWithoutId] },
        },
      ],
    });
    const api = renderEditor({ rawSeed: seed });
    expect(api.restoredFromLocalStorage).toBe(true);
    expect(api.characterParts.map((part) => part.id)).toEqual(['p1', 'p2']);
    expect(api.fps).toBe(25);
    expect(api.canUndo).toBe(false);
  });

  it('F5. a legacy track without channels restores fully (empty channels injected) and floors undo at the restored scene', () => {
    // The validator accepts a track without `channels` and the legacy migrator
    // injects empty ones — the documented behavior of BOTH apply paths
    // (startup and import), which the baseline fix must preserve.
    const noChannels = legacyAutosave({
      tracks: [
        {
          id: 'track_p1',
          partId: 'p1',
          name: 'Track p1',
          color: '#3b82f6',
          keyframes: [
            { id: 'kf_1', frame: 0, transform: { x: 1, y: 2, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } },
          ],
        },
      ],
    });
    const api = renderEditor({ rawSeed: noChannels });
    expect(api.restoredFromLocalStorage).toBe(true);
    expect(api.characterParts.map((part) => part.id)).toEqual(['p1', 'p2']);
    expect(api.tracks.map((track) => track.id)).toEqual(['track_p1']);
    expect(api.tracks[0]?.channels?.x).toEqual([]);
    expect(api.fps).toBe(25);
    expect(api.canUndo).toBe(false);
    act(() => api.undo());
    expect(api.characterParts.map((part) => part.id)).toEqual(['p1', 'p2']);
    // The stored autosave survives a successful restore untouched.
    expect(window.localStorage.getItem(AUTOSAVE_STORAGE_KEY)).not.toBeNull();
    // Parity with the startup path: the same document via import is accepted.
    let imported: { ok: boolean } | undefined;
    act(() => {
      imported = api.importProject(noChannels);
    });
    expect(imported?.ok).toBe(true);
  });
});
