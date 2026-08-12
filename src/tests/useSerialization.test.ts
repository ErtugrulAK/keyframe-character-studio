import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useSerialization } from '../hooks/useSerialization';
import { AnimationProject, Track, Transform, TrackChannel, PropertyKeyframe } from '../types/animator';
import { makeEmptyChannels } from '../utils/defaults';
import { applyTransitionToTrackCanonicalMutator } from '../utils/trackMutations';
import { generateTransitionChannelKeyframes } from '../utils/motionTransitions';
import { normalizeFeather, normalizeGradientAngle, normalizeGradientStops } from '../utils/matte';

describe('useSerialization Hook', () => {
  const mockSetFps = vi.fn();
  const mockSetTotalFrames = vi.fn();
  const mockSetProjectResolution = vi.fn();
  const mockSetTracks = vi.fn();
  const mockSetCharacterParts = vi.fn();
  const mockSetActiveProjectTemplateIdState = vi.fn();
  const mockSetMotionTemplates = vi.fn();
  const mockSetActiveTemplateIdState = vi.fn();
  const mockSetSceneTitleState = vi.fn();
  const mockSetProjectTemplates = vi.fn();
  const mockSetTemplateCanvasStore = vi.fn();
  const mockSetCurrentFrame = vi.fn();
  const mockSetIsPlaying = vi.fn();

  beforeEach(() => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    vi.spyOn(Storage.prototype, 'setItem');
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('triggers manual save to localStorage', () => {
    const { result } = renderHook(() => useSerialization({
      fps: 30, setFps: mockSetFps,
      totalFrames: 100, setTotalFrames: mockSetTotalFrames,
      projectResolution: { width: 800, height: 600 }, setProjectResolution: mockSetProjectResolution,
      tracks: [], setTracks: mockSetTracks,
      characterParts: [], setCharacterParts: mockSetCharacterParts,
      activeProjectTemplateId: 'default', setActiveProjectTemplateIdState: mockSetActiveProjectTemplateIdState,
      motionTemplates: [], setMotionTemplates: mockSetMotionTemplates,
      activeTemplateId: 'Sequence', setActiveTemplateIdState: mockSetActiveTemplateIdState,
      sceneTitle: 'My Scene', setSceneTitleState: mockSetSceneTitleState,
      projectTemplates: [], setProjectTemplates: mockSetProjectTemplates,
      setTemplateCanvasStore: mockSetTemplateCanvasStore,
      setCurrentFrame: mockSetCurrentFrame,
      setIsPlaying: mockSetIsPlaying
    }));

    act(() => {
      result.current.triggerManualSave();
    });

    expect(localStorage.setItem).toHaveBeenCalledWith(
      'SEQUENCER_STUDIO_PRO_V5',
      expect.stringContaining('My Scene')
    );
    expect(result.current.lastSavedAt).toBeInstanceOf(Date);
  });

  it('exports project as string', () => {
    const { result } = renderHook(() => useSerialization({
      fps: 30, setFps: mockSetFps,
      totalFrames: 100, setTotalFrames: mockSetTotalFrames,
      projectResolution: { width: 800, height: 600 }, setProjectResolution: mockSetProjectResolution,
      tracks: [], setTracks: mockSetTracks,
      characterParts: [], setCharacterParts: mockSetCharacterParts,
      activeProjectTemplateId: 'default', setActiveProjectTemplateIdState: mockSetActiveProjectTemplateIdState,
      motionTemplates: [], setMotionTemplates: mockSetMotionTemplates,
      activeTemplateId: 'Sequence', setActiveTemplateIdState: mockSetActiveTemplateIdState,
      sceneTitle: 'My Scene', setSceneTitleState: mockSetSceneTitleState,
      projectTemplates: [], setProjectTemplates: mockSetProjectTemplates,
      setTemplateCanvasStore: mockSetTemplateCanvasStore,
      setCurrentFrame: mockSetCurrentFrame,
      setIsPlaying: mockSetIsPlaying
    }));

    const jsonStr = result.current.exportProject();
    expect(jsonStr).toContain('My Scene');
  });

  it('imports project string', () => {
    const { result } = renderHook(() => useSerialization({
      fps: 30, setFps: mockSetFps,
      totalFrames: 100, setTotalFrames: mockSetTotalFrames,
      projectResolution: { width: 800, height: 600 }, setProjectResolution: mockSetProjectResolution,
      tracks: [], setTracks: mockSetTracks,
      characterParts: [], setCharacterParts: mockSetCharacterParts,
      activeProjectTemplateId: 'default', setActiveProjectTemplateIdState: mockSetActiveProjectTemplateIdState,
      motionTemplates: [], setMotionTemplates: mockSetMotionTemplates,
      activeTemplateId: 'Sequence', setActiveTemplateIdState: mockSetActiveTemplateIdState,
      sceneTitle: 'My Scene', setSceneTitleState: mockSetSceneTitleState,
      projectTemplates: [], setProjectTemplates: mockSetProjectTemplates,
      setTemplateCanvasStore: mockSetTemplateCanvasStore,
      setCurrentFrame: mockSetCurrentFrame,
      setIsPlaying: mockSetIsPlaying
    }));

    const mockProject: AnimationProject = {
      version: '5.0',
      idCounter: 5,
      fps: 24,
      totalFrames: 150,
      projectResolution: { width: 1024, height: 768 },
      characterParts: [],
      tracks: [],
      sceneTitle: 'Imported Scene',
      projectTemplates: [],
      activeProjectTemplateId: 'tmpl',
      motionTemplates: [],
      activeTemplateId: 'Sequence',
      templateCanvasStore: {}
    };

    const success = result.current.importProject(JSON.stringify(mockProject));
    
    expect(success).toBe(true);
    expect(mockSetFps).toHaveBeenCalledWith(24);
    expect(mockSetSceneTitleState).toHaveBeenCalledWith('Imported Scene');
  });

  // ── Phase 3: SceneData format tests ──────────────────────────────

  it('exports with version: 1 in SceneData format', () => {
    const { result } = renderHook(() => useSerialization({
      fps: 30, setFps: mockSetFps,
      totalFrames: 100, setTotalFrames: mockSetTotalFrames,
      projectResolution: { width: 800, height: 600 }, setProjectResolution: mockSetProjectResolution,
      tracks: [], setTracks: mockSetTracks,
      characterParts: [], setCharacterParts: mockSetCharacterParts,
      activeProjectTemplateId: 'default', setActiveProjectTemplateIdState: mockSetActiveProjectTemplateIdState,
      motionTemplates: [], setMotionTemplates: mockSetMotionTemplates,
      activeTemplateId: 'Sequence', setActiveTemplateIdState: mockSetActiveTemplateIdState,
      sceneTitle: 'My Scene', setSceneTitleState: mockSetSceneTitleState,
      projectTemplates: [], setProjectTemplates: mockSetProjectTemplates,
      setTemplateCanvasStore: mockSetTemplateCanvasStore,
      setCurrentFrame: mockSetCurrentFrame,
      setIsPlaying: mockSetIsPlaying
    }));

    const exported = result.current.exportProject();
    const parsed = JSON.parse(exported);

    expect(parsed.version).toBe(1);
    expect(parsed.width).toBe(800);
    expect(parsed.height).toBe(600);
    expect(parsed.fps).toBe(30);
    expect(parsed.totalFrames).toBe(100);
    expect(parsed.name).toBe('My Scene');
    expect(Array.isArray(parsed.layers)).toBe(true);
    expect(Array.isArray(parsed.tracks)).toBe(true);
  });

  it('imports SceneData format', () => {
    const { result } = renderHook(() => useSerialization({
      fps: 30, setFps: mockSetFps,
      totalFrames: 100, setTotalFrames: mockSetTotalFrames,
      projectResolution: { width: 800, height: 600 }, setProjectResolution: mockSetProjectResolution,
      tracks: [], setTracks: mockSetTracks,
      characterParts: [], setCharacterParts: mockSetCharacterParts,
      activeProjectTemplateId: 'default', setActiveProjectTemplateIdState: mockSetActiveProjectTemplateIdState,
      motionTemplates: [], setMotionTemplates: mockSetMotionTemplates,
      activeTemplateId: 'Sequence', setActiveTemplateIdState: mockSetActiveTemplateIdState,
      sceneTitle: 'Old', setSceneTitleState: mockSetSceneTitleState,
      projectTemplates: [], setProjectTemplates: mockSetProjectTemplates,
      setTemplateCanvasStore: mockSetTemplateCanvasStore,
      setCurrentFrame: mockSetCurrentFrame,
      setIsPlaying: mockSetIsPlaying
    }));

    const sceneData = {
      version: 1,
      width: 1024, height: 768,
      fps: 60, totalFrames: 200,
      name: 'SceneData Import',
      layers: [{
        id: 'L1', name: 'Box', type: 'custom_box',
        x: 100, y: 200, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
        visible: true, zIndex: 1, fillColor: '#ff0000', strokeColor: '#000000',
      }],
      tracks: [],
      motionTemplates: [],
    };

    const success = result.current.importProject(JSON.stringify(sceneData));
    expect(success).toBe(true);
    expect(mockSetFps).toHaveBeenCalledWith(60);
    expect(mockSetTotalFrames).toHaveBeenCalledWith(200);
    expect(mockSetCharacterParts).toHaveBeenCalled();
    expect(mockSetTracks).toHaveBeenCalled();
  });

  it('export → import round-trip preserves data', () => {
    const { result } = renderHook(() => useSerialization({
      fps: 30, setFps: mockSetFps,
      totalFrames: 120, setTotalFrames: mockSetTotalFrames,
      projectResolution: { width: 1920, height: 1080 }, setProjectResolution: mockSetProjectResolution,
      tracks: [], setTracks: mockSetTracks,
      characterParts: [], setCharacterParts: mockSetCharacterParts,
      activeProjectTemplateId: 'default', setActiveProjectTemplateIdState: mockSetActiveProjectTemplateIdState,
      motionTemplates: [], setMotionTemplates: mockSetMotionTemplates,
      activeTemplateId: 'Sequence', setActiveTemplateIdState: mockSetActiveTemplateIdState,
      sceneTitle: 'RoundTrip', setSceneTitleState: mockSetSceneTitleState,
      projectTemplates: [], setProjectTemplates: mockSetProjectTemplates,
      setTemplateCanvasStore: mockSetTemplateCanvasStore,
      setCurrentFrame: mockSetCurrentFrame,
      setIsPlaying: mockSetIsPlaying
    }));

    const exported = result.current.exportProject();
    const parsed = JSON.parse(exported);

    // Round-trip: import the exported data back
    const success = result.current.importProject(exported);
    expect(success).toBe(true);

    // Re-export and verify version preserved
    const reExported = result.current.exportProject();
    const reParsed = JSON.parse(reExported);
    expect(reParsed.version).toBe(1);
  });

  it('P4-S3: exports tracks with canonical partId', () => {
    const trackWithId: Track = {
      id: 'trk_1',
      partId: 'L1',
      name: 'T1',
      color: '#fff',
      keyframes: [],
      channels: makeEmptyChannels(),
      visible: true,
      locked: false,
    } as any;

    const { result } = renderHook(() => useSerialization({
      fps: 30, setFps: mockSetFps,
      totalFrames: 100, setTotalFrames: mockSetTotalFrames,
      projectResolution: { width: 800, height: 600 }, setProjectResolution: mockSetProjectResolution,
      tracks: [trackWithId], setTracks: mockSetTracks,
      characterParts: [], setCharacterParts: mockSetCharacterParts,
      activeProjectTemplateId: 'default', setActiveProjectTemplateIdState: mockSetActiveProjectTemplateIdState,
      motionTemplates: [], setMotionTemplates: mockSetMotionTemplates,
      activeTemplateId: 'Sequence', setActiveTemplateIdState: mockSetActiveTemplateIdState,
      sceneTitle: 'PartId Scene', setSceneTitleState: mockSetSceneTitleState,
      projectTemplates: [], setProjectTemplates: mockSetProjectTemplates,
      setTemplateCanvasStore: mockSetTemplateCanvasStore,
      setCurrentFrame: mockSetCurrentFrame,
      setIsPlaying: mockSetIsPlaying
    }));

    const exported = result.current.exportProject();
    const parsed = JSON.parse(exported);

    expect(parsed.tracks).toHaveLength(1);
    expect(parsed.tracks[0].partId).toBe('L1');
    // Legacy layerId field should not be present in canonical export
    expect(parsed.tracks[0].layerId).toBeUndefined();
  });

  it('P4-S3: imports legacy SceneData with layerId (backward compat)', () => {
    const { result } = renderHook(() => useSerialization({
      fps: 30, setFps: mockSetFps,
      totalFrames: 100, setTotalFrames: mockSetTotalFrames,
      projectResolution: { width: 800, height: 600 }, setProjectResolution: mockSetProjectResolution,
      tracks: [], setTracks: mockSetTracks,
      characterParts: [], setCharacterParts: mockSetCharacterParts,
      activeProjectTemplateId: 'default', setActiveProjectTemplateIdState: mockSetActiveProjectTemplateIdState,
      motionTemplates: [], setMotionTemplates: mockSetMotionTemplates,
      activeTemplateId: 'Sequence', setActiveTemplateIdState: mockSetActiveTemplateIdState,
      sceneTitle: 'Legacy', setSceneTitleState: mockSetSceneTitleState,
      projectTemplates: [], setProjectTemplates: mockSetProjectTemplates,
      setTemplateCanvasStore: mockSetTemplateCanvasStore,
      setCurrentFrame: mockSetCurrentFrame,
      setIsPlaying: mockSetIsPlaying
    }));

    // Old format: layerId instead of partId
    const legacyScene = {
      version: 1,
      width: 1024, height: 768,
      fps: 60, totalFrames: 200,
      layers: [{
        id: 'L1', name: 'Box', type: 'custom_box',
        x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
        visible: true, zIndex: 1, fillColor: '#fff', strokeColor: '#000',
      }],
      tracks: [{
        layerId: 'L1',
        channels: {},
        keyframes: [],
      }],
    };

    const success = result.current.importProject(JSON.stringify(legacyScene));
    expect(success).toBe(true);
    expect(mockSetTracks).toHaveBeenCalled();
  });

  it('BUG#1: round-trip preserves canonical channels (export → import)', () => {
    const channelsTrack: Track = {
      id: 'trk_ch',
      partId: 'L1',
      name: 'ChannelTrack',
      color: '#3b82f6',
      keyframes: [], // legacy empty — canonical channels carry the animation
      channels: {
        x: [
          { id: 'pk_x_0', frame: 0, value: 0, easing: 'linear', templateId: 'Sequence' },
          { id: 'pk_x_1', frame: 120, value: 100, easing: 'linear', templateId: 'Sequence' },
        ],
        opacity: [
          { id: 'pk_o_0', frame: 0, value: 1, easing: 'linear', templateId: 'Sequence' },
          { id: 'pk_o_1', frame: 120, value: 0.2, easing: 'linear', templateId: 'Sequence' },
        ],
        y: [],
        rotation: [],
        scaleX: [],
        scaleY: [],
        maskOffsetX: [],
        maskOffsetY: [],
        maskScale: [],
        maskRotation: [],
      },
      visible: true,
      locked: false,
    } as any;

    const { result } = renderHook(() => useSerialization({
      fps: 30, setFps: mockSetFps,
      totalFrames: 120, setTotalFrames: mockSetTotalFrames,
      projectResolution: { width: 1920, height: 1080 }, setProjectResolution: mockSetProjectResolution,
      tracks: [channelsTrack], setTracks: mockSetTracks,
      characterParts: [], setCharacterParts: mockSetCharacterParts,
      activeProjectTemplateId: 'default', setActiveProjectTemplateIdState: mockSetActiveProjectTemplateIdState,
      motionTemplates: [], setMotionTemplates: mockSetMotionTemplates,
      activeTemplateId: 'Sequence', setActiveTemplateIdState: mockSetActiveTemplateIdState,
      sceneTitle: 'Channels', setSceneTitleState: mockSetSceneTitleState,
      projectTemplates: [], setProjectTemplates: mockSetProjectTemplates,
      setTemplateCanvasStore: mockSetTemplateCanvasStore,
      setCurrentFrame: mockSetCurrentFrame,
      setIsPlaying: mockSetIsPlaying
    }));

    // Export
    const exported = result.current.exportProject();
    const parsed = JSON.parse(exported);
    expect(parsed.tracks[0].channels.x).toHaveLength(2);
    expect(parsed.tracks[0].channels.x[0].value).toBe(0);
    expect(parsed.tracks[0].channels.x[1].value).toBe(100);
    expect(parsed.tracks[0].channels.opacity[1].value).toBeCloseTo(0.2, 5);

    // Import (mock captures the restored tracks)
    mockSetTracks.mockClear();
    const success = result.current.importProject(exported);
    expect(success).toBe(true);

    const lastTracks = mockSetTracks.mock.calls.at(-1)?.[0] as Track[];
    expect(lastTracks).toBeDefined();
    const restored = lastTracks.find((t) => t.partId === 'L1')!;
    expect(restored.channels.x).toHaveLength(2);
    expect(restored.channels.x[0].value).toBe(0);
    expect(restored.channels.x[1].value).toBe(100);
    expect(restored.channels.opacity[1].value).toBeCloseTo(0.2, 5);
    // Legacy keyframes untouched
    expect(restored.keyframes).toHaveLength(0);
  });

  it('BUG#2: import restores exported scene name as sceneTitle', () => {
    const { result } = renderHook(() => useSerialization({
      fps: 30, setFps: mockSetFps,
      totalFrames: 100, setTotalFrames: mockSetTotalFrames,
      projectResolution: { width: 800, height: 600 }, setProjectResolution: mockSetProjectResolution,
      tracks: [], setTracks: mockSetTracks,
      characterParts: [], setCharacterParts: mockSetCharacterParts,
      activeProjectTemplateId: 'default', setActiveProjectTemplateIdState: mockSetActiveProjectTemplateIdState,
      motionTemplates: [], setMotionTemplates: mockSetMotionTemplates,
      activeTemplateId: 'Sequence', setActiveTemplateIdState: mockSetActiveTemplateIdState,
      sceneTitle: 'My Scene', setSceneTitleState: mockSetSceneTitleState,
      projectTemplates: [], setProjectTemplates: mockSetProjectTemplates,
      setTemplateCanvasStore: mockSetTemplateCanvasStore,
      setCurrentFrame: mockSetCurrentFrame,
      setIsPlaying: mockSetIsPlaying
    }));

    // Export carries the scene name
    const exported = result.current.exportProject();
    const parsed = JSON.parse(exported);
    expect(parsed.name).toBe('My Scene');

    // Import must restore it via setSceneTitleState
    mockSetSceneTitleState.mockClear();
    const success = result.current.importProject(exported);
    expect(success).toBe(true);
    expect(mockSetSceneTitleState).toHaveBeenCalledWith('My Scene');
  });

  it('BUG#2: import without name keeps current title (no-op)', () => {
    const { result } = renderHook(() => useSerialization({
      fps: 30, setFps: mockSetFps,
      totalFrames: 100, setTotalFrames: mockSetTotalFrames,
      projectResolution: { width: 800, height: 600 }, setProjectResolution: mockSetProjectResolution,
      tracks: [], setTracks: mockSetTracks,
      characterParts: [], setCharacterParts: mockSetCharacterParts,
      activeProjectTemplateId: 'default', setActiveProjectTemplateIdState: mockSetActiveProjectTemplateIdState,
      motionTemplates: [], setMotionTemplates: mockSetMotionTemplates,
      activeTemplateId: 'Sequence', setActiveTemplateIdState: mockSetActiveTemplateIdState,
      sceneTitle: 'Current Title', setSceneTitleState: mockSetSceneTitleState,
      projectTemplates: [], setProjectTemplates: mockSetProjectTemplates,
      setTemplateCanvasStore: mockSetTemplateCanvasStore,
      setCurrentFrame: mockSetCurrentFrame,
      setIsPlaying: mockSetIsPlaying
    }));

    const sceneNoName = {
      version: 1,
      width: 800, height: 600,
      fps: 30, totalFrames: 100,
      layers: [],
      tracks: [],
    };

    mockSetSceneTitleState.mockClear();
    const success = result.current.importProject(JSON.stringify(sceneNoName));
    expect(success).toBe(true);
    // No name in file → sceneTitle must not be touched
    expect(mockSetSceneTitleState).not.toHaveBeenCalled();
  });

  it('BUG#4: legacy keyframe opacity 0 survives round-trip', () => {
    const kfTrack: Track = {
      id: 'trk_kf',
      partId: 'L1',
      name: 'KF',
      color: '#f00',
      keyframes: [
        { id: 'kf_0', frame: 0, transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }, easing: 'linear', templateId: 'Sequence' },
        { id: 'kf_120', frame: 120, transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 0 }, easing: 'linear', templateId: 'Sequence' },
      ],
      channels: makeEmptyChannels(),
      visible: true,
      locked: false,
    } as any;

    const { result } = renderHook(() => useSerialization({
      fps: 30, setFps: mockSetFps,
      totalFrames: 120, setTotalFrames: mockSetTotalFrames,
      projectResolution: { width: 1920, height: 1080 }, setProjectResolution: mockSetProjectResolution,
      tracks: [kfTrack], setTracks: mockSetTracks,
      characterParts: [], setCharacterParts: mockSetCharacterParts,
      activeProjectTemplateId: 'default', setActiveProjectTemplateIdState: mockSetActiveProjectTemplateIdState,
      motionTemplates: [], setMotionTemplates: mockSetMotionTemplates,
      activeTemplateId: 'Sequence', setActiveTemplateIdState: mockSetActiveTemplateIdState,
      sceneTitle: 'KF', setSceneTitleState: mockSetSceneTitleState,
      projectTemplates: [], setProjectTemplates: mockSetProjectTemplates,
      setTemplateCanvasStore: mockSetTemplateCanvasStore,
      setCurrentFrame: mockSetCurrentFrame,
      setIsPlaying: mockSetIsPlaying
    }));

    // M8e: channels-only export — legacy keyframes are converted to channels
    // at export time; opacity 0 survives there (no keyframes[] field).
    const exported = result.current.exportProject();
    const parsed = JSON.parse(exported);
    expect(parsed.tracks[0].keyframes).toBeUndefined();
    expect(parsed.tracks[0].channels.opacity[1].value).toBe(0);

    // Import must preserve it (not coerce 0 → 1)
    mockSetTracks.mockClear();
    const success = result.current.importProject(exported);
    expect(success).toBe(true);

    const restored = (mockSetTracks.mock.calls.at(-1)?.[0] as Track[]).find(t => t.partId === 'L1')!;
    expect(restored.channels.opacity.find((k: any) => k.frame === 120)!.value).toBe(0);
    expect(restored.channels.opacity.find((k: any) => k.frame === 0)!.value).toBe(1);
  });

  it('BUG#4: missing keyframe opacity still defaults to 1', () => {
    const kfNoOpacity: Track = {
      id: 'trk_noop',
      partId: 'L1',
      name: 'KFNO',
      color: '#f00',
      keyframes: [
        { id: 'kf_0', frame: 0, transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }, easing: 'linear' },
      ],
      channels: makeEmptyChannels(),
      visible: true,
      locked: false,
    } as any;

    const { result } = renderHook(() => useSerialization({
      fps: 30, setFps: mockSetFps,
      totalFrames: 120, setTotalFrames: mockSetTotalFrames,
      projectResolution: { width: 1920, height: 1080 }, setProjectResolution: mockSetProjectResolution,
      tracks: [kfNoOpacity], setTracks: mockSetTracks,
      characterParts: [], setCharacterParts: mockSetCharacterParts,
      activeProjectTemplateId: 'default', setActiveProjectTemplateIdState: mockSetActiveProjectTemplateIdState,
      motionTemplates: [], setMotionTemplates: mockSetMotionTemplates,
      activeTemplateId: 'Sequence', setActiveTemplateIdState: mockSetActiveTemplateIdState,
      sceneTitle: 'KFNO', setSceneTitleState: mockSetSceneTitleState,
      projectTemplates: [], setProjectTemplates: mockSetProjectTemplates,
      setTemplateCanvasStore: mockSetTemplateCanvasStore,
      setCurrentFrame: mockSetCurrentFrame,
      setIsPlaying: mockSetIsPlaying
    }));

    mockSetTracks.mockClear();
    const success = result.current.importProject(result.current.exportProject());
    expect(success).toBe(true);

    const restored = (mockSetTracks.mock.calls.at(-1)?.[0] as Track[]).find(t => t.partId === 'L1')!;
    // undefined opacity → default 1 preserved (channels conversion)
    expect(restored.channels.opacity.find((k: any) => k.frame === 0)!.value).toBe(1);
  });

  it('BUG#3: procedural animation config survives round-trip', () => {
    const procPart: CharacterPart = {
      id: 'L1',
      name: 'Proc',
      type: 'custom_box',
      zIndex: 1,
      pivot: { x: 0, y: 0 },
      fillColor: '#fff',
      strokeColor: '#000',
      baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
      inAnimPreset: 'fade',
      outAnimPreset: 'slide-left',
      inAnimDuration: 45,
      outAnimDuration: 20,
    } as any;

    const { result } = renderHook(() => useSerialization({
      fps: 30, setFps: mockSetFps,
      totalFrames: 120, setTotalFrames: mockSetTotalFrames,
      projectResolution: { width: 1920, height: 1080 }, setProjectResolution: mockSetProjectResolution,
      tracks: [], setTracks: mockSetTracks,
      characterParts: [procPart], setCharacterParts: mockSetCharacterParts,
      activeProjectTemplateId: 'default', setActiveProjectTemplateIdState: mockSetActiveProjectTemplateIdState,
      motionTemplates: [], setMotionTemplates: mockSetMotionTemplates,
      activeTemplateId: 'Sequence', setActiveTemplateIdState: mockSetActiveTemplateIdState,
      sceneTitle: 'Proc', setSceneTitleState: mockSetSceneTitleState,
      projectTemplates: [], setProjectTemplates: mockSetProjectTemplates,
      setTemplateCanvasStore: mockSetTemplateCanvasStore,
      setCurrentFrame: mockSetCurrentFrame,
      setIsPlaying: mockSetIsPlaying
    }));

    // Export carries the 4 fields
    const exported = result.current.exportProject();
    const parsed = JSON.parse(exported);
    expect(parsed.layers[0].inAnimPreset).toBe('fade');
    expect(parsed.layers[0].outAnimPreset).toBe('slide-left');
    expect(parsed.layers[0].inAnimDuration).toBe(45);
    expect(parsed.layers[0].outAnimDuration).toBe(20);

    // Import must restore all 4
    mockSetCharacterParts.mockClear();
    const success = result.current.importProject(exported);
    expect(success).toBe(true);

    const restored = (mockSetCharacterParts.mock.calls.at(-1)?.[0] as CharacterPart[]).find(p => p.id === 'L1')!;
    expect(restored.inAnimPreset).toBe('fade');
    expect(restored.outAnimPreset).toBe('slide-left');
    expect(restored.inAnimDuration).toBe(45);
    expect(restored.outAnimDuration).toBe(20);
  });

  it('BUG#5: import restores exported motionTemplates', () => {
    const { result } = renderHook(() => useSerialization({
      fps: 30, setFps: mockSetFps,
      totalFrames: 100, setTotalFrames: mockSetTotalFrames,
      projectResolution: { width: 800, height: 600 }, setProjectResolution: mockSetProjectResolution,
      tracks: [], setTracks: mockSetTracks,
      characterParts: [], setCharacterParts: mockSetCharacterParts,
      activeProjectTemplateId: 'default', setActiveProjectTemplateIdState: mockSetActiveProjectTemplateIdState,
      motionTemplates: [
        { id: 'mt_outro', name: 'Outro', type: 'out', keyframes: [], color: '#f00', isCustom: true } as any,
      ], setMotionTemplates: mockSetMotionTemplates,
      activeTemplateId: 'Sequence', setActiveTemplateIdState: mockSetActiveTemplateIdState,
      sceneTitle: 'MT', setSceneTitleState: mockSetSceneTitleState,
      projectTemplates: [], setProjectTemplates: mockSetProjectTemplates,
      setTemplateCanvasStore: mockSetTemplateCanvasStore,
      setCurrentFrame: mockSetCurrentFrame,
      setIsPlaying: mockSetIsPlaying
    }));

    // Export carries motionTemplates
    const exported = result.current.exportProject();
    const parsed = JSON.parse(exported);
    expect(parsed.motionTemplates).toHaveLength(1);
    expect(parsed.motionTemplates[0].name).toBe('Outro');

    // Import must restore them via setMotionTemplates
    mockSetMotionTemplates.mockClear();
    const success = result.current.importProject(exported);
    expect(success).toBe(true);
    expect(mockSetMotionTemplates).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ name: 'Outro' }),
    ]));
  });

  it('BUG#5: import without motionTemplates keeps current templates (no-op)', () => {
    const { result } = renderHook(() => useSerialization({
      fps: 30, setFps: mockSetFps,
      totalFrames: 100, setTotalFrames: mockSetTotalFrames,
      projectResolution: { width: 800, height: 600 }, setProjectResolution: mockSetProjectResolution,
      tracks: [], setTracks: mockSetTracks,
      characterParts: [], setCharacterParts: mockSetCharacterParts,
      activeProjectTemplateId: 'default', setActiveProjectTemplateIdState: mockSetActiveProjectTemplateIdState,
      motionTemplates: [], setMotionTemplates: mockSetMotionTemplates,
      activeTemplateId: 'Sequence', setActiveTemplateIdState: mockSetActiveTemplateIdState,
      sceneTitle: 'NoMT', setSceneTitleState: mockSetSceneTitleState,
      projectTemplates: [], setProjectTemplates: mockSetProjectTemplates,
      setTemplateCanvasStore: mockSetTemplateCanvasStore,
      setCurrentFrame: mockSetCurrentFrame,
      setIsPlaying: mockSetIsPlaying
    }));

    const sceneNoMT = {
      version: 1,
      width: 800, height: 600,
      fps: 30, totalFrames: 100,
      layers: [],
      tracks: [],
    };

    mockSetMotionTemplates.mockClear();
    const success = result.current.importProject(JSON.stringify(sceneNoMT));
    expect(success).toBe(true);
    expect(mockSetMotionTemplates).not.toHaveBeenCalled();
  });

  it('BUG#6: clonerConfig and particleConfig survive round-trip', () => {
    const clonerCfg = { mode: 'radial', count: 8, spacing: 40 };
    const particleCfg = { count: 50, speed: 3.5, shape: 'circle' };
    const clonerPart: CharacterPart = {
      id: 'L1',
      name: 'Cloner',
      type: 'mograph_cloner',
      zIndex: 1,
      pivot: { x: 0, y: 0 },
      fillColor: '#fff',
      strokeColor: '#000',
      baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
      clonerConfig: clonerCfg,
      particleConfig: particleCfg,
    } as any;

    const { result } = renderHook(() => useSerialization({
      fps: 30, setFps: mockSetFps,
      totalFrames: 120, setTotalFrames: mockSetTotalFrames,
      projectResolution: { width: 1920, height: 1080 }, setProjectResolution: mockSetProjectResolution,
      tracks: [], setTracks: mockSetTracks,
      characterParts: [clonerPart], setCharacterParts: mockSetCharacterParts,
      activeProjectTemplateId: 'default', setActiveProjectTemplateIdState: mockSetActiveProjectTemplateIdState,
      motionTemplates: [], setMotionTemplates: mockSetMotionTemplates,
      activeTemplateId: 'Sequence', setActiveTemplateIdState: mockSetActiveTemplateIdState,
      sceneTitle: 'Cloner', setSceneTitleState: mockSetSceneTitleState,
      projectTemplates: [], setProjectTemplates: mockSetProjectTemplates,
      setTemplateCanvasStore: mockSetTemplateCanvasStore,
      setCurrentFrame: mockSetCurrentFrame,
      setIsPlaying: mockSetIsPlaying
    }));

    // Export carries both configs
    const exported = result.current.exportProject();
    const parsed = JSON.parse(exported);
    expect(parsed.layers[0].clonerConfig).toEqual(clonerCfg);
    expect(parsed.layers[0].particleConfig).toEqual(particleCfg);

    // Import must restore both birebir
    mockSetCharacterParts.mockClear();
    const success = result.current.importProject(exported);
    expect(success).toBe(true);

    const restored = (mockSetCharacterParts.mock.calls.at(-1)?.[0] as CharacterPart[]).find(p => p.id === 'L1')!;
    expect(restored.clonerConfig).toEqual(clonerCfg);
    expect(restored.particleConfig).toEqual(particleCfg);
  });

  it('M8a: canonical transition channels survive round-trip', () => {
    // Simulate a canonical transition (fade): 6 channels with start(0)/end(15)
    // keyframes — what applyTransitionChannelsMutator writes.
    const transitionTrack: Track = {
      id: 'trk_trans',
      partId: 'L1',
      name: 'T',
      color: '#f00',
      keyframes: [],
      channels: {
        x: [
          { id: 'sx', frame: 0, value: 100, easing: 'easeOut', templateId: 'Sequence' },
          { id: 'ex', frame: 15, value: 100, easing: 'linear', templateId: 'Sequence' },
        ],
        y: [
          { id: 'sy', frame: 0, value: 100, easing: 'easeOut', templateId: 'Sequence' },
          { id: 'ey', frame: 15, value: 100, easing: 'linear', templateId: 'Sequence' },
        ],
        rotation: [], scaleX: [], scaleY: [],
        opacity: [
          { id: 'so', frame: 0, value: 0, easing: 'easeOut', templateId: 'Sequence' },
          { id: 'eo', frame: 15, value: 1, easing: 'linear', templateId: 'Sequence' },
        ],
        maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
      },
      visible: true,
      locked: false,
    } as any;

    const { result } = renderHook(() => useSerialization({
      fps: 30, setFps: mockSetFps,
      totalFrames: 120, setTotalFrames: mockSetTotalFrames,
      projectResolution: { width: 1920, height: 1080 }, setProjectResolution: mockSetProjectResolution,
      tracks: [transitionTrack], setTracks: mockSetTracks,
      characterParts: [], setCharacterParts: mockSetCharacterParts,
      activeProjectTemplateId: 'default', setActiveProjectTemplateIdState: mockSetActiveProjectTemplateIdState,
      motionTemplates: [], setMotionTemplates: mockSetMotionTemplates,
      activeTemplateId: 'Sequence', setActiveTemplateIdState: mockSetActiveTemplateIdState,
      sceneTitle: 'Trans', setSceneTitleState: mockSetSceneTitleState,
      projectTemplates: [], setProjectTemplates: mockSetProjectTemplates,
      setTemplateCanvasStore: mockSetTemplateCanvasStore,
      setCurrentFrame: mockSetCurrentFrame,
      setIsPlaying: mockSetIsPlaying
    }));

    // Export carries the transition channels
    const exported = result.current.exportProject();
    const parsed = JSON.parse(exported);
    expect(parsed.tracks[0].channels.opacity).toHaveLength(2);
    expect(parsed.tracks[0].channels.opacity[0].value).toBe(0); // opacity 0 preserved

    // Import must restore the same channel data (transition survives)
    mockSetTracks.mockClear();
    const success = result.current.importProject(exported);
    expect(success).toBe(true);

    const restored = (mockSetTracks.mock.calls.at(-1)?.[0] as Track[]).find(t => t.partId === 'L1')!;
    expect(restored.channels.opacity).toEqual(parsed.tracks[0].channels.opacity);
    expect(restored.channels.x).toEqual(parsed.tracks[0].channels.x);
    expect(restored.channels.opacity[0].value).toBe(0);
  });

  // ─── M8c: dual-format canonical precedence ─────────────────────────

  function makeDualSceneData(tracksData: any[]) {
    return {
      version: 1,
      width: 1920, height: 1080,
      fps: 30, totalFrames: 120,
      layers: [],
      tracks: tracksData,
    };
  }

  function makeEmptyChannelsRecord() {
    return {
      x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
      maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
    };
  }

  it('M8c: dual-format — canonical channels win over legacy keyframes', () => {
    // Same track carries BOTH channels and legacy keyframes with conflicting values.
    const dualTrack = {
      partId: 'L1',
      channels: {
        ...makeEmptyChannelsRecord(),
        x: [
          { id: 'cx0', frame: 0, value: 100, easing: 'linear', templateId: 'Sequence' },
          { id: 'cx1', frame: 60, value: 200, easing: 'linear', templateId: 'Sequence' },
        ],
        opacity: [
          { id: 'co0', frame: 0, value: 0, easing: 'linear', templateId: 'Sequence' },
          { id: 'co1', frame: 60, value: 0.5, easing: 'linear', templateId: 'Sequence' },
        ],
      },
      // legacy keyframes claim x=999, opacity=0.9 — must NOT win
      keyframes: [
        { id: 'kf0', frame: 0, transform: { x: 999, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 0.9 }, easing: 'linear', templateId: 'Sequence' },
        { id: 'kf1', frame: 60, transform: { x: 999, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 0.9 }, easing: 'linear', templateId: 'Sequence' },
      ],
    };

    const { result } = renderHook(() => useSerialization({
      fps: 30, setFps: mockSetFps,
      totalFrames: 120, setTotalFrames: mockSetTotalFrames,
      projectResolution: { width: 1920, height: 1080 }, setProjectResolution: mockSetProjectResolution,
      tracks: [], setTracks: mockSetTracks,
      characterParts: [], setCharacterParts: mockSetCharacterParts,
      activeProjectTemplateId: 'default', setActiveProjectTemplateIdState: mockSetActiveProjectTemplateIdState,
      motionTemplates: [], setMotionTemplates: mockSetMotionTemplates,
      activeTemplateId: 'Sequence', setActiveTemplateIdState: mockSetActiveTemplateIdState,
      sceneTitle: 'Dual', setSceneTitleState: mockSetSceneTitleState,
      projectTemplates: [], setProjectTemplates: mockSetProjectTemplates,
      setTemplateCanvasStore: mockSetTemplateCanvasStore,
      setCurrentFrame: mockSetCurrentFrame,
      setIsPlaying: mockSetIsPlaying
    }));

    mockSetTracks.mockClear();
    const success = result.current.importProject(JSON.stringify(makeDualSceneData([dualTrack])));
    expect(success).toBe(true);

    const restored = (mockSetTracks.mock.calls.at(-1)?.[0] as Track[]).find(t => t.partId === 'L1')!;
    // Canonical channels win — legacy values (999 / 0.9) must not override
    expect(restored.channels.x[0].value).toBe(100);
    expect(restored.channels.x[1].value).toBe(200);
    expect(restored.channels.opacity[0].value).toBe(0);
    expect(restored.channels.opacity[1].value).toBeCloseTo(0.5, 5);
    // No legacy-derived keyframes injected into channels
    expect(restored.channels.y).toHaveLength(0);
    // Legacy keyframes array still preserved verbatim (compat)
    expect(restored.keyframes).toHaveLength(2);
    expect(restored.keyframes[0].transform.x).toBe(999);
  });

  it('M8c: empty channels + legacy keyframes → conversion fallback still works', () => {
    const legacyOnlyTrack = {
      partId: 'L1',
      // channels completely absent → legacy conversion must kick in
      keyframes: [
        { id: 'kf0', frame: 0, transform: { x: 10, y: 20, rotation: 0, scaleX: 1, scaleY: 1, opacity: 0 }, easing: 'easeIn', templateId: 'Sequence' },
        { id: 'kf1', frame: 90, transform: { x: 30, y: 40, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }, easing: 'linear', templateId: 'Outro' },
      ],
    };

    const { result } = renderHook(() => useSerialization({
      fps: 30, setFps: mockSetFps,
      totalFrames: 120, setTotalFrames: mockSetTotalFrames,
      projectResolution: { width: 1920, height: 1080 }, setProjectResolution: mockSetProjectResolution,
      tracks: [], setTracks: mockSetTracks,
      characterParts: [], setCharacterParts: mockSetCharacterParts,
      activeProjectTemplateId: 'default', setActiveProjectTemplateIdState: mockSetActiveProjectTemplateIdState,
      motionTemplates: [], setMotionTemplates: mockSetMotionTemplates,
      activeTemplateId: 'Sequence', setActiveTemplateIdState: mockSetActiveTemplateIdState,
      sceneTitle: 'LegacyOnly', setSceneTitleState: mockSetSceneTitleState,
      projectTemplates: [], setProjectTemplates: mockSetProjectTemplates,
      setTemplateCanvasStore: mockSetTemplateCanvasStore,
      setCurrentFrame: mockSetCurrentFrame,
      setIsPlaying: mockSetIsPlaying
    }));

    mockSetTracks.mockClear();
    const success = result.current.importProject(JSON.stringify(makeDualSceneData([legacyOnlyTrack])));
    expect(success).toBe(true);

    const restored = (mockSetTracks.mock.calls.at(-1)?.[0] as Track[]).find(t => t.partId === 'L1')!;
    // Conversion fallback: legacy values now live in canonical channels
    expect(restored.channels.x).toHaveLength(2);
    expect(restored.channels.x[0].value).toBe(10);
    expect(restored.channels.x[1].value).toBe(30);
    expect(restored.channels.y[0].value).toBe(20);
    // opacity 0 preserved
    expect(restored.channels.opacity[0].value).toBe(0);
    // easing + templateId carried over
    expect(restored.channels.x[0].easing).toBe('easeIn');
    expect(restored.channels.x[0].templateId).toBe('Sequence');
    expect(restored.channels.x[1].templateId).toBe('Outro');
  });

  it('M8c: dual-format precedence is deterministic (same input → same output)', () => {
    const dualTrack = {
      partId: 'L1',
      channels: {
        ...makeEmptyChannelsRecord(),
        x: [{ id: 'cx0', frame: 0, value: 42, easing: 'linear', templateId: 'Sequence' }],
      },
      keyframes: [
        { id: 'kf0', frame: 0, transform: { x: 999, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }, easing: 'linear', templateId: 'Sequence' },
      ],
    };

    const { result } = renderHook(() => useSerialization({
      fps: 30, setFps: mockSetFps,
      totalFrames: 120, setTotalFrames: mockSetTotalFrames,
      projectResolution: { width: 1920, height: 1080 }, setProjectResolution: mockSetProjectResolution,
      tracks: [], setTracks: mockSetTracks,
      characterParts: [], setCharacterParts: mockSetCharacterParts,
      activeProjectTemplateId: 'default', setActiveProjectTemplateIdState: mockSetActiveProjectTemplateIdState,
      motionTemplates: [], setMotionTemplates: mockSetMotionTemplates,
      activeTemplateId: 'Sequence', setActiveTemplateIdState: mockSetActiveTemplateIdState,
      sceneTitle: 'Det', setSceneTitleState: mockSetSceneTitleState,
      projectTemplates: [], setProjectTemplates: mockSetProjectTemplates,
      setTemplateCanvasStore: mockSetTemplateCanvasStore,
      setCurrentFrame: mockSetCurrentFrame,
      setIsPlaying: mockSetIsPlaying
    }));

    mockSetTracks.mockClear();
    result.current.importProject(JSON.stringify(makeDualSceneData([dualTrack])));
    const first = (mockSetTracks.mock.calls.at(-1)?.[0] as Track[]).find(t => t.partId === 'L1')!;

    mockSetTracks.mockClear();
    result.current.importProject(JSON.stringify(makeDualSceneData([dualTrack])));
    const second = (mockSetTracks.mock.calls.at(-1)?.[0] as Track[]).find(t => t.partId === 'L1')!;

    expect(second.channels.x[0].value).toBe(42); // channels win, not 999
    expect(second.channels.x).toEqual(first.channels.x);
    expect(second.keyframes).toEqual(first.keyframes);
  });

  it('M8e-prepB: empty channel structure (all arrays empty) + populated legacy → legacy conversion runs', () => {
    // channels exists but EVERY channel array is empty — legacy keyframes
    // must be converted into channels (current Object.keys check misses this).
    const track = {
      partId: 'L1',
      channels: makeEmptyChannelsRecord(), // 10 keys, all empty arrays
      keyframes: [
        { id: 'kf0', frame: 0, transform: { x: 10, y: 20, rotation: 0, scaleX: 1, scaleY: 1, opacity: 0 }, easing: 'easeIn', templateId: 'Sequence' },
        { id: 'kf1', frame: 90, transform: { x: 30, y: 40, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }, easing: 'linear', templateId: 'Outro' },
      ],
    };

    const { result } = renderHook(() => useSerialization({
      fps: 30, setFps: mockSetFps,
      totalFrames: 120, setTotalFrames: mockSetTotalFrames,
      projectResolution: { width: 1920, height: 1080 }, setProjectResolution: mockSetProjectResolution,
      tracks: [], setTracks: mockSetTracks,
      characterParts: [], setCharacterParts: mockSetCharacterParts,
      activeProjectTemplateId: 'default', setActiveProjectTemplateIdState: mockSetActiveProjectTemplateIdState,
      motionTemplates: [], setMotionTemplates: mockSetMotionTemplates,
      activeTemplateId: 'Sequence', setActiveTemplateIdState: mockSetActiveTemplateIdState,
      sceneTitle: 'EmptyCh', setSceneTitleState: mockSetSceneTitleState,
      projectTemplates: [], setProjectTemplates: mockSetProjectTemplates,
      setTemplateCanvasStore: mockSetTemplateCanvasStore,
      setCurrentFrame: mockSetCurrentFrame,
      setIsPlaying: mockSetIsPlaying
    }));

    mockSetTracks.mockClear();
    const success = result.current.importProject(JSON.stringify(makeDualSceneData([track])));
    expect(success).toBe(true);

    const restored = (mockSetTracks.mock.calls.at(-1)?.[0] as Track[]).find(t => t.partId === 'L1')!;
    // Legacy conversion must have run — channels now carry the legacy values
    expect(restored.channels.x).toHaveLength(2);
    expect(restored.channels.x[0].value).toBe(10);
    expect(restored.channels.x[1].value).toBe(30);
    expect(restored.channels.y[0].value).toBe(20);
    // opacity 0 preserved
    expect(restored.channels.opacity[0].value).toBe(0);
    // easing + templateId carried
    expect(restored.channels.x[0].easing).toBe('easeIn');
    expect(restored.channels.x[0].templateId).toBe('Sequence');
    expect(restored.channels.x[1].templateId).toBe('Outro');
  });

  it('M8e-prepB: partially populated channels + legacy → channels win (legacy does not overwrite)', () => {
    // channels has real data in x only — canonical wins for ALL channels,
    // legacy must not inject its values anywhere
    const track = {
      partId: 'L1',
      channels: {
        ...makeEmptyChannelsRecord(),
        x: [{ id: 'cx0', frame: 0, value: 100, easing: 'linear', templateId: 'Sequence' }],
      },
      keyframes: [
        { id: 'kf0', frame: 0, transform: { x: 999, y: 999, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }, easing: 'linear', templateId: 'Sequence' },
      ],
    };

    const { result } = renderHook(() => useSerialization({
      fps: 30, setFps: mockSetFps,
      totalFrames: 120, setTotalFrames: mockSetTotalFrames,
      projectResolution: { width: 1920, height: 1080 }, setProjectResolution: mockSetProjectResolution,
      tracks: [], setTracks: mockSetTracks,
      characterParts: [], setCharacterParts: mockSetCharacterParts,
      activeProjectTemplateId: 'default', setActiveProjectTemplateIdState: mockSetActiveProjectTemplateIdState,
      motionTemplates: [], setMotionTemplates: mockSetMotionTemplates,
      activeTemplateId: 'Sequence', setActiveTemplateIdState: mockSetActiveTemplateIdState,
      sceneTitle: 'Partial', setSceneTitleState: mockSetSceneTitleState,
      projectTemplates: [], setProjectTemplates: mockSetProjectTemplates,
      setTemplateCanvasStore: mockSetTemplateCanvasStore,
      setCurrentFrame: mockSetCurrentFrame,
      setIsPlaying: mockSetIsPlaying
    }));

    mockSetTracks.mockClear();
    const success = result.current.importProject(JSON.stringify(makeDualSceneData([track])));
    expect(success).toBe(true);

    const restored = (mockSetTracks.mock.calls.at(-1)?.[0] as Track[]).find(t => t.partId === 'L1')!;
    // canonical x preserved; legacy values NOT injected anywhere
    expect(restored.channels.x).toHaveLength(1);
    expect(restored.channels.x[0].value).toBe(100);
    expect(restored.channels.y).toHaveLength(0);
    expect(restored.channels.opacity).toHaveLength(0);
  });

  it('M8e-prepB: empty channels + empty legacy → channels stay empty (no crash)', () => {
    const track = {
      partId: 'L1',
      channels: makeEmptyChannelsRecord(),
      keyframes: [],
    };

    const { result } = renderHook(() => useSerialization({
      fps: 30, setFps: mockSetFps,
      totalFrames: 120, setTotalFrames: mockSetTotalFrames,
      projectResolution: { width: 1920, height: 1080 }, setProjectResolution: mockSetProjectResolution,
      tracks: [], setTracks: mockSetTracks,
      characterParts: [], setCharacterParts: mockSetCharacterParts,
      activeProjectTemplateId: 'default', setActiveProjectTemplateIdState: mockSetActiveProjectTemplateIdState,
      motionTemplates: [], setMotionTemplates: mockSetMotionTemplates,
      activeTemplateId: 'Sequence', setActiveTemplateIdState: mockSetActiveTemplateIdState,
      sceneTitle: 'BothEmpty', setSceneTitleState: mockSetSceneTitleState,
      projectTemplates: [], setProjectTemplates: mockSetProjectTemplates,
      setTemplateCanvasStore: mockSetTemplateCanvasStore,
      setCurrentFrame: mockSetCurrentFrame,
      setIsPlaying: mockSetIsPlaying
    }));

    mockSetTracks.mockClear();
    const success = result.current.importProject(JSON.stringify(makeDualSceneData([track])));
    expect(success).toBe(true);

    const restored = (mockSetTracks.mock.calls.at(-1)?.[0] as Track[]).find(t => t.partId === 'L1')!;
    expect(restored.channels.x).toHaveLength(0);
    expect(restored.channels.opacity).toHaveLength(0);
  });

  // ─── M8e: channels-only export policy ──────────────────────────────

  it('M8e-1: modern channels-only export has NO keyframes field in JSON', () => {
    const modernTrack = {
      id: 'trk_mod', partId: 'L1', name: 'T', color: '#f00',
      keyframes: [], // empty in editor
      channels: {
        ...makeEmptyChannelsRecord(),
        x: [{ id: 'cx0', frame: 0, value: 50, easing: 'linear', templateId: 'Sequence' }],
      },
      visible: true, locked: false,
    } as any;

    const { result } = renderHook(() => useSerialization({
      fps: 30, setFps: mockSetFps,
      totalFrames: 120, setTotalFrames: mockSetTotalFrames,
      projectResolution: { width: 1920, height: 1080 }, setProjectResolution: mockSetProjectResolution,
      tracks: [modernTrack], setTracks: mockSetTracks,
      characterParts: [], setCharacterParts: mockSetCharacterParts,
      activeProjectTemplateId: 'default', setActiveProjectTemplateIdState: mockSetActiveProjectTemplateIdState,
      motionTemplates: [], setMotionTemplates: mockSetMotionTemplates,
      activeTemplateId: 'Sequence', setActiveTemplateIdState: mockSetActiveTemplateIdState,
      sceneTitle: 'Mod', setSceneTitleState: mockSetSceneTitleState,
      projectTemplates: [], setProjectTemplates: mockSetProjectTemplates,
      setTemplateCanvasStore: mockSetTemplateCanvasStore,
      setCurrentFrame: mockSetCurrentFrame,
      setIsPlaying: mockSetIsPlaying
    }));

    const parsed = JSON.parse(result.current.exportProject());
    expect(parsed.tracks[0].keyframes).toBeUndefined();
    expect(parsed.tracks[0].channels.x[0].value).toBe(50);
  });

  it('M8e-2: legacy-only track is converted to channels at EXPORT time (no data loss)', () => {
    // Editor holds a legacy-only track (channels empty, keyframes populated)
    const legacyTrack = {
      id: 'trk_leg', partId: 'L1', name: 'T', color: '#f00',
      keyframes: [
        { id: 'kf0', frame: 0, transform: { x: 10, y: 20, rotation: 0, scaleX: 1, scaleY: 1, opacity: 0 }, easing: 'easeIn' },
        { id: 'kf1', frame: 90, transform: { x: 30, y: 40, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }, easing: 'linear' },
      ],
      channels: makeEmptyChannelsRecord(),
      visible: true, locked: false,
    } as any;

    const { result } = renderHook(() => useSerialization({
      fps: 30, setFps: mockSetFps,
      totalFrames: 120, setTotalFrames: mockSetTotalFrames,
      projectResolution: { width: 1920, height: 1080 }, setProjectResolution: mockSetProjectResolution,
      tracks: [legacyTrack], setTracks: mockSetTracks,
      characterParts: [], setCharacterParts: mockSetCharacterParts,
      activeProjectTemplateId: 'default', setActiveProjectTemplateIdState: mockSetActiveProjectTemplateIdState,
      motionTemplates: [], setMotionTemplates: mockSetMotionTemplates,
      activeTemplateId: 'Sequence', setActiveTemplateIdState: mockSetActiveTemplateIdState,
      sceneTitle: 'Leg', setSceneTitleState: mockSetSceneTitleState,
      projectTemplates: [], setProjectTemplates: mockSetProjectTemplates,
      setTemplateCanvasStore: mockSetTemplateCanvasStore,
      setCurrentFrame: mockSetCurrentFrame,
      setIsPlaying: mockSetIsPlaying
    }));

    const parsed = JSON.parse(result.current.exportProject());
    // channels carry the legacy values; no keyframes field
    expect(parsed.tracks[0].keyframes).toBeUndefined();
    expect(parsed.tracks[0].channels.x[0].value).toBe(10);
    expect(parsed.tracks[0].channels.x[1].value).toBe(30);
    expect(parsed.tracks[0].channels.y[0].value).toBe(20);
    // opacity 0 preserved
    expect(parsed.tracks[0].channels.opacity[0].value).toBe(0);
    // easing carried
    expect(parsed.tracks[0].channels.x[0].easing).toBe('easeIn');

    // Import round-trip restores the same channels
    mockSetTracks.mockClear();
    expect(result.current.importProject(JSON.stringify(parsed))).toBe(true);
    const restored = (mockSetTracks.mock.calls.at(-1)?.[0] as Track[]).find(t => t.partId === 'L1')!;
    expect(restored.channels.x[1].value).toBe(30);
    expect(restored.channels.opacity[0].value).toBe(0);
  });

  it('M8e-8: easing, bezierControlPoints and templateId survive channels-only export', () => {
    const modernTrack = {
      id: 'trk_bz', partId: 'L1', name: 'T', color: '#f00',
      keyframes: [],
      channels: {
        ...makeEmptyChannelsRecord(),
        x: [
          { id: 'cx0', frame: 0, value: 0, easing: 'cubic_bezier', bezierControlPoints: [0.2, 0.4, 0.6, 0.8], templateId: 'Outro' },
        ],
        opacity: [{ id: 'co0', frame: 0, value: 0, easing: 'easeOut', templateId: 'Outro' }],
      },
      visible: true, locked: false,
    } as any;

    const { result } = renderHook(() => useSerialization({
      fps: 30, setFps: mockSetFps,
      totalFrames: 120, setTotalFrames: mockSetTotalFrames,
      projectResolution: { width: 1920, height: 1080 }, setProjectResolution: mockSetProjectResolution,
      tracks: [modernTrack], setTracks: mockSetTracks,
      characterParts: [], setCharacterParts: mockSetCharacterParts,
      activeProjectTemplateId: 'default', setActiveProjectTemplateIdState: mockSetActiveProjectTemplateIdState,
      motionTemplates: [], setMotionTemplates: mockSetMotionTemplates,
      activeTemplateId: 'Sequence', setActiveTemplateIdState: mockSetActiveTemplateIdState,
      sceneTitle: 'Bz', setSceneTitleState: mockSetSceneTitleState,
      projectTemplates: [], setProjectTemplates: mockSetProjectTemplates,
      setTemplateCanvasStore: mockSetTemplateCanvasStore,
      setCurrentFrame: mockSetCurrentFrame,
      setIsPlaying: mockSetIsPlaying
    }));

    const parsed = JSON.parse(result.current.exportProject());
    expect(parsed.tracks[0].channels.x[0].easing).toBe('cubic_bezier');
    expect(parsed.tracks[0].channels.x[0].bezierControlPoints).toEqual([0.2, 0.4, 0.6, 0.8]);
    expect(parsed.tracks[0].channels.x[0].templateId).toBe('Outro');
    expect(parsed.tracks[0].channels.opacity[0].value).toBe(0);

    mockSetTracks.mockClear();
    expect(result.current.importProject(JSON.stringify(parsed))).toBe(true);
    const restored = (mockSetTracks.mock.calls.at(-1)?.[0] as Track[]).find(t => t.partId === 'L1')!;
    expect(restored.channels.x[0].bezierControlPoints).toEqual([0.2, 0.4, 0.6, 0.8]);
    expect(restored.channels.x[0].templateId).toBe('Outro');
  });

  it('M8e-9: legacy maskOffset fields converted at export time into mask channels', () => {
    const legacyTrack = {
      id: 'trk_mask', partId: 'L1', name: 'T', color: '#f00',
      keyframes: [
        { id: 'kf0', frame: 0, transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, maskOffsetX: 25, maskScale: 1.5 }, easing: 'linear' },
      ],
      channels: makeEmptyChannelsRecord(),
      visible: true, locked: false,
    } as any;

    const { result } = renderHook(() => useSerialization({
      fps: 30, setFps: mockSetFps,
      totalFrames: 120, setTotalFrames: mockSetTotalFrames,
      projectResolution: { width: 1920, height: 1080 }, setProjectResolution: mockSetProjectResolution,
      tracks: [legacyTrack], setTracks: mockSetTracks,
      characterParts: [], setCharacterParts: mockSetCharacterParts,
      activeProjectTemplateId: 'default', setActiveProjectTemplateIdState: mockSetActiveProjectTemplateIdState,
      motionTemplates: [], setMotionTemplates: mockSetMotionTemplates,
      activeTemplateId: 'Sequence', setActiveTemplateIdState: mockSetActiveTemplateIdState,
      sceneTitle: 'Mask', setSceneTitleState: mockSetSceneTitleState,
      projectTemplates: [], setProjectTemplates: mockSetProjectTemplates,
      setTemplateCanvasStore: mockSetTemplateCanvasStore,
      setCurrentFrame: mockSetCurrentFrame,
      setIsPlaying: mockSetIsPlaying
    }));

    const parsed = JSON.parse(result.current.exportProject());
    expect(parsed.tracks[0].channels.maskOffsetX[0].value).toBe(25);
    expect(parsed.tracks[0].channels.maskScale[0].value).toBe(1.5);
    expect(parsed.tracks[0].keyframes).toBeUndefined();
  });

  it('M8e-10: channels-only round-trip is deterministic', () => {
    const modernTrack = {
      id: 'trk_det', partId: 'L1', name: 'T', color: '#f00',
      keyframes: [],
      channels: {
        ...makeEmptyChannelsRecord(),
        x: [{ id: 'cx0', frame: 0, value: 7, easing: 'linear', templateId: 'Sequence' }],
      },
      visible: true, locked: false,
    } as any;

    const { result } = renderHook(() => useSerialization({
      fps: 30, setFps: mockSetFps,
      totalFrames: 120, setTotalFrames: mockSetTotalFrames,
      projectResolution: { width: 1920, height: 1080 }, setProjectResolution: mockSetProjectResolution,
      tracks: [modernTrack], setTracks: mockSetTracks,
      characterParts: [], setCharacterParts: mockSetCharacterParts,
      activeProjectTemplateId: 'default', setActiveProjectTemplateIdState: mockSetActiveProjectTemplateIdState,
      motionTemplates: [], setMotionTemplates: mockSetMotionTemplates,
      activeTemplateId: 'Sequence', setActiveTemplateIdState: mockSetActiveTemplateIdState,
      sceneTitle: 'Det2', setSceneTitleState: mockSetSceneTitleState,
      projectTemplates: [], setProjectTemplates: mockSetProjectTemplates,
      setTemplateCanvasStore: mockSetTemplateCanvasStore,
      setCurrentFrame: mockSetCurrentFrame,
      setIsPlaying: mockSetIsPlaying
    }));

    const a = result.current.exportProject();
    const b = result.current.exportProject();
    expect(JSON.parse(a)).toEqual(JSON.parse(b));
    expect(JSON.parse(a).tracks[0].channels.x[0].value).toBe(7);
  });

  // ─── M8f: transition serialization round-trips ─────────────────────

  function makeLegacyOnlyTrack(): Track {
    const channels: Record<TrackChannel, PropertyKeyframe[]> = {
      x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
      maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
    };
    return {
      id: 'trk_leg', partId: 'L1', name: 'T', color: '#f00',
      keyframes: [
        { id: 'kf0', frame: 0, transform: { x: 10, y: 20, rotation: 0, scaleX: 1, scaleY: 1, opacity: 0 }, easing: 'easeIn' },
        { id: 'kf_outro', frame: 90, transform: { x: 30, y: 40, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }, easing: 'linear', templateId: 'Outro' },
      ],
      channels,
      visible: true, locked: false,
    } as Track;
  }

  function renderSerialization(tracks: Track[]) {
    return renderHook(() => useSerialization({
      fps: 30, setFps: mockSetFps,
      totalFrames: 120, setTotalFrames: mockSetTotalFrames,
      projectResolution: { width: 1920, height: 1080 }, setProjectResolution: mockSetProjectResolution,
      tracks, setTracks: mockSetTracks,
      characterParts: [], setCharacterParts: mockSetCharacterParts,
      activeProjectTemplateId: 'default', setActiveProjectTemplateIdState: mockSetActiveProjectTemplateIdState,
      motionTemplates: [], setMotionTemplates: mockSetMotionTemplates,
      activeTemplateId: 'Sequence', setActiveTemplateIdState: mockSetActiveTemplateIdState,
      sceneTitle: 'M8f', setSceneTitleState: mockSetSceneTitleState,
      projectTemplates: [], setProjectTemplates: mockSetProjectTemplates,
      setTemplateCanvasStore: mockSetTemplateCanvasStore,
      setCurrentFrame: mockSetCurrentFrame,
      setIsPlaying: mockSetIsPlaying
    }));
  }

  it('M8f-1: legacy-only transition survives export → import round-trip', () => {
    // Simulate applyMotionTransition on a legacy-only track: convert legacy
    // keyframes to channels, then apply a fade transition (start 30, end 45).
    const legacyTrack = makeLegacyOnlyTrack();
    const base: Transform = { x: 100, y: 50, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };
    const transition = generateTransitionChannelKeyframes(base, 'fade', 30, 45)!;
    const [transitioned] = applyTransitionToTrackCanonicalMutator([legacyTrack], 'trk_leg', transition, 'Sequence');

    const { result } = renderSerialization([transitioned]);

    // Export: channels carry transition + converted legacy data; no keyframes field
    const exported = result.current.exportProject();
    const parsed = JSON.parse(exported);
    expect(parsed.tracks[0].keyframes).toBeUndefined();
    expect(parsed.tracks[0].channels.opacity.some((k: any) => k.frame === 30 && k.value === 0)).toBe(true);
    expect(parsed.tracks[0].channels.opacity.some((k: any) => k.frame === 45 && k.value === 1)).toBe(true);
    // legacy converted data present
    expect(parsed.tracks[0].channels.x.find((k: any) => k.frame === 0)?.value).toBe(10);
    expect(parsed.tracks[0].channels.opacity.find((k: any) => k.frame === 0)?.value).toBe(0);

    // Import restores identical channel data
    mockSetTracks.mockClear();
    expect(result.current.importProject(exported)).toBe(true);
    const restored = (mockSetTracks.mock.calls.at(-1)?.[0] as Track[]).find(t => t.partId === 'L1')!;

    const startOp = restored.channels.opacity.find((k: any) => k.frame === 30)!;
    expect(startOp.value).toBe(0);
    expect(startOp.easing).toBe('easeOut');
    expect(startOp.templateId).toBe('Sequence');
    expect(restored.channels.opacity.find((k: any) => k.frame === 45)!.value).toBe(1);
    expect(restored.channels.x.find((k: any) => k.frame === 0)!.value).toBe(10);
  });

  it('M8f-2: "none" transition stays cleared after export → import; other templates preserved', () => {
    const legacyTrack = makeLegacyOnlyTrack();
    // 'none' → clear active template (Sequence) channels; Outro template kept
    const [cleared] = applyTransitionToTrackCanonicalMutator([legacyTrack], 'trk_leg', null, 'Sequence');

    // Pre-export sanity: Sequence channel keyframes gone, Outro survives
    expect(cleared.channels.opacity.filter((k) => (k.templateId || 'Sequence') === 'Sequence')).toHaveLength(0);
    expect(cleared.channels.x.filter((k) => (k.templateId || 'Sequence') === 'Outro')).toHaveLength(1);

    const { result } = renderSerialization([cleared]);
    const exported = result.current.exportProject();
    const parsed = JSON.parse(exported);
    expect(parsed.tracks[0].channels.opacity.filter((k: any) => (k.templateId || 'Sequence') === 'Sequence')).toHaveLength(0);
    expect(parsed.tracks[0].channels.x.filter((k: any) => (k.templateId || 'Sequence') === 'Outro')).toHaveLength(1);

    // Import keeps it cleared
    mockSetTracks.mockClear();
    expect(result.current.importProject(exported)).toBe(true);
    const restored = (mockSetTracks.mock.calls.at(-1)?.[0] as Track[]).find(t => t.partId === 'L1')!;
    expect(restored.channels.opacity.filter((k) => (k.templateId || 'Sequence') === 'Sequence')).toHaveLength(0);
    expect(restored.channels.x.filter((k) => (k.templateId || 'Sequence') === 'Outro')).toHaveLength(1);
  });

  // ─── M11 Step 2B: track matte serialization ────────────────────────

  function makeMattePart() {
    return {
      id: 'part_m', type: 'custom_box', name: 'M', zIndex: 1,
      baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
      fillColor: '#ff0000', strokeColor: '#101218',
      matte: { sourcePartId: 'part_s', mode: 'clip', enabled: true },
    } as any;
  }

  it('M11: matte is exported in SceneData', () => {
    const { result } = renderSerialization([]);
    // Use a part-bearing scene: exportProject serializes characterParts via layers
    // (renderSerialization passes tracks only; build a full hook instance below)
    const part = makeMattePart();
    const { result: r2 } = renderHook(() => useSerialization({
      fps: 30, setFps: mockSetFps,
      totalFrames: 120, setTotalFrames: mockSetTotalFrames,
      projectResolution: { width: 1920, height: 1080 }, setProjectResolution: mockSetProjectResolution,
      tracks: [], setTracks: mockSetTracks,
      characterParts: [part], setCharacterParts: mockSetCharacterParts,
      activeProjectTemplateId: 'default', setActiveProjectTemplateIdState: mockSetActiveProjectTemplateIdState,
      motionTemplates: [], setMotionTemplates: mockSetMotionTemplates,
      activeTemplateId: 'Sequence', setActiveTemplateIdState: mockSetActiveTemplateIdState,
      sceneTitle: 'Matte', setSceneTitleState: mockSetSceneTitleState,
      projectTemplates: [], setProjectTemplates: mockSetProjectTemplates,
      setTemplateCanvasStore: mockSetTemplateCanvasStore,
      setCurrentFrame: mockSetCurrentFrame,
      setIsPlaying: mockSetIsPlaying
    }));

    const parsed = JSON.parse(r2.current.exportProject());
    const layer = parsed.layers.find((l: any) => l.id === 'part_m');
    expect(layer.matte).toEqual({ sourcePartId: 'part_s', mode: 'clip', enabled: true });
    expect(parsed.tracks).toEqual([]);
    expect(parsed.tracks[0]?.keyframes).toBeUndefined(); // channels-only intact
  });

  it('M11: matte survives export → import round-trip', () => {
    const part = makeMattePart();
    const { result } = renderHook(() => useSerialization({
      fps: 30, setFps: mockSetFps,
      totalFrames: 120, setTotalFrames: mockSetTotalFrames,
      projectResolution: { width: 1920, height: 1080 }, setProjectResolution: mockSetProjectResolution,
      tracks: [], setTracks: mockSetTracks,
      characterParts: [part], setCharacterParts: mockSetCharacterParts,
      activeProjectTemplateId: 'default', setActiveProjectTemplateIdState: mockSetActiveProjectTemplateIdState,
      motionTemplates: [], setMotionTemplates: mockSetMotionTemplates,
      activeTemplateId: 'Sequence', setActiveTemplateIdState: mockSetActiveTemplateIdState,
      sceneTitle: 'Matte', setSceneTitleState: mockSetSceneTitleState,
      projectTemplates: [], setProjectTemplates: mockSetProjectTemplates,
      setTemplateCanvasStore: mockSetTemplateCanvasStore,
      setCurrentFrame: mockSetCurrentFrame,
      setIsPlaying: mockSetIsPlaying
    }));

    const exported = result.current.exportProject();
    mockSetCharacterParts.mockClear();
    expect(result.current.importProject(exported)).toBe(true);
    const restored = (mockSetCharacterParts.mock.calls.at(-1)?.[0] as CharacterPart[]).find((p) => p.id === 'part_m')!;
    expect(restored.matte).toEqual({ sourcePartId: 'part_s', mode: 'clip', enabled: true });
  });

  it('M11: legacy project without matte imports with matte undefined', () => {
    const legacyPart = {
      id: 'part_l', type: 'custom_box', name: 'L', zIndex: 1,
      baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
      fillColor: '#ff0000', strokeColor: '#101218',
    } as any;

    const { result } = renderHook(() => useSerialization({
      fps: 30, setFps: mockSetFps,
      totalFrames: 120, setTotalFrames: mockSetTotalFrames,
      projectResolution: { width: 1920, height: 1080 }, setProjectResolution: mockSetProjectResolution,
      tracks: [], setTracks: mockSetTracks,
      characterParts: [legacyPart], setCharacterParts: mockSetCharacterParts,
      activeProjectTemplateId: 'default', setActiveProjectTemplateIdState: mockSetActiveProjectTemplateIdState,
      motionTemplates: [], setMotionTemplates: mockSetMotionTemplates,
      activeTemplateId: 'Sequence', setActiveTemplateIdState: mockSetActiveTemplateIdState,
      sceneTitle: 'Leg', setSceneTitleState: mockSetSceneTitleState,
      projectTemplates: [], setProjectTemplates: mockSetProjectTemplates,
      setTemplateCanvasStore: mockSetTemplateCanvasStore,
      setCurrentFrame: mockSetCurrentFrame,
      setIsPlaying: mockSetIsPlaying
    }));

    const exported = result.current.exportProject();
    expect(JSON.parse(exported).layers[0].matte).toBeUndefined();
    mockSetCharacterParts.mockClear();
    expect(result.current.importProject(exported)).toBe(true);
    const restored = (mockSetCharacterParts.mock.calls.at(-1)?.[0] as CharacterPart[]).find((p) => p.id === 'part_l')!;
    expect(restored.matte).toBeUndefined();
  });

  // ─── M13 Step 2E: matte mode/inverted serialization round-trip ──────

  function renderSerializationWithPart(part: any) {
    return renderHook(() => useSerialization({
      fps: 30, setFps: mockSetFps,
      totalFrames: 120, setTotalFrames: mockSetTotalFrames,
      projectResolution: { width: 1920, height: 1080 }, setProjectResolution: mockSetProjectResolution,
      tracks: [], setTracks: mockSetTracks,
      characterParts: [part], setCharacterParts: mockSetCharacterParts,
      activeProjectTemplateId: 'default', setActiveProjectTemplateIdState: mockSetActiveProjectTemplateIdState,
      motionTemplates: [], setMotionTemplates: mockSetMotionTemplates,
      activeTemplateId: 'Sequence', setActiveTemplateIdState: mockSetActiveTemplateIdState,
      sceneTitle: 'Matte', setSceneTitleState: mockSetSceneTitleState,
      projectTemplates: [], setProjectTemplates: mockSetProjectTemplates,
      setTemplateCanvasStore: mockSetTemplateCanvasStore,
      setCurrentFrame: mockSetCurrentFrame,
      setIsPlaying: mockSetIsPlaying
    }));
  }

  function roundTripMatte(matte: any) {
    const part = {
      id: 'part_m', type: 'custom_box', name: 'M', zIndex: 1,
      baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
      fillColor: '#ff0000', strokeColor: '#101218',
      matte,
    } as any;
    const { result } = renderSerializationWithPart(part);
    const exported = result.current.exportProject();
    mockSetCharacterParts.mockClear();
    expect(result.current.importProject(exported)).toBe(true);
    return (mockSetCharacterParts.mock.calls.at(-1)?.[0] as CharacterPart[]).find((p) => p.id === 'part_m')!;
  }

  it('M13: alpha matte survives export → import round-trip', () => {
    const restored = roundTripMatte({ sourcePartId: 'source', mode: 'alpha', enabled: true });
    expect(restored.matte).toEqual({ sourcePartId: 'source', mode: 'alpha', enabled: true });
  });

  it('M13: luminance matte survives export → import round-trip', () => {
    const restored = roundTripMatte({ sourcePartId: 'source', mode: 'luminance' });
    expect(restored.matte).toEqual({ sourcePartId: 'source', mode: 'luminance' });
  });

  it('M13: inverted matte survives export → import round-trip', () => {
    const restored = roundTripMatte({ sourcePartId: 'source', mode: 'clip', inverted: true });
    expect(restored.matte).toEqual({ sourcePartId: 'source', mode: 'clip', inverted: true });
  });

  it('M13: combined state (luminance + inverted + enabled) survives round-trip', () => {
    const restored = roundTripMatte({ sourcePartId: 'source', mode: 'luminance', inverted: true, enabled: true });
    expect(restored.matte).toEqual({ sourcePartId: 'source', mode: 'luminance', inverted: true, enabled: true });
  });

  it('M13: legacy matte (mode absent) is NOT rewritten on import (no serialization migration)', () => {
    const restored = roundTripMatte({ sourcePartId: 'source' });
    // mode stays absent — runtime resolveMatteMode handles the 'clip' default
    expect(restored.matte).toEqual({ sourcePartId: 'source' });
    expect((restored.matte as any).mode).toBeUndefined();
  });

  it('M13: enabled=false survives round-trip', () => {
    const restored = roundTripMatte({ sourcePartId: 'source', mode: 'alpha', inverted: true, enabled: false });
    expect(restored.matte).toEqual({ sourcePartId: 'source', mode: 'alpha', inverted: true, enabled: false });
  });

  it('M13: channels-only policy — matte lives ONLY in layers, never in tracks/channels/keyframes', () => {
    const part = {
      id: 'part_m', type: 'custom_box', name: 'M', zIndex: 1,
      baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
      fillColor: '#ff0000', strokeColor: '#101218',
      matte: { sourcePartId: 'source', mode: 'luminance', inverted: true, enabled: true },
    } as any;
    const { result } = renderSerializationWithPart(part);
    const parsed = JSON.parse(result.current.exportProject());
    expect(parsed.layers.find((l: any) => l.id === 'part_m').matte).toEqual({
      sourcePartId: 'source', mode: 'luminance', inverted: true, enabled: true,
    });
    expect(parsed.tracks).toEqual([]);
    const json = JSON.stringify(parsed);
    // No matte payload leaked into track data (channels/keyframes)
    expect(json.includes('"mode":"luminance"')).toBe(true); // only from the layer
    expect(parsed.tracks[0]?.keyframes).toBeUndefined();
    expect(parsed.tracks[0]?.channels).toBeUndefined();
  });

  // ─── M14 Step 2E: matte feather serialization round-trip ────────────

  it('M14: feather undefined → export has NO feather key (M13 data untouched)', () => {
    const part = {
      id: 'part_m', type: 'custom_box', name: 'M', zIndex: 1,
      baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
      fillColor: '#ff0000', strokeColor: '#101218',
      matte: { sourcePartId: 'source', mode: 'alpha', enabled: true },
    } as any;
    const { result } = renderSerializationWithPart(part);
    const layer = JSON.parse(result.current.exportProject()).layers.find((l: any) => l.id === 'part_m');
    expect(layer.matte).toEqual({ sourcePartId: 'source', mode: 'alpha', enabled: true });
    expect('feather' in layer.matte).toBe(false); // JSON.stringify drops undefined
  });

  it('M14: feather 0 / 12 / 100 survive round-trip with all other fields', () => {
    for (const f of [0, 12, 100]) {
      const restored = roundTripMatte({ sourcePartId: 'source', mode: 'luminance', inverted: true, enabled: true, feather: f });
      expect(restored.matte).toEqual({ sourcePartId: 'source', mode: 'luminance', inverted: true, enabled: true, feather: f });
    }
  });

  it('M14: negative feather survives round-trip as data; normalizeFeather guards NaN/Infinity/null', () => {
    const restored = roundTripMatte({ sourcePartId: 'source', mode: 'alpha', feather: -5 });
    expect(restored.matte).toEqual({ sourcePartId: 'source', mode: 'alpha', feather: -5 });
    // JSON cannot represent NaN/±Infinity → they serialize as null; the pure
    // normalizeFeather guard turns any non-finite input into 0 (render-safe).
    expect(JSON.parse(JSON.stringify({ feather: NaN })).feather).toBeNull();
    expect(JSON.parse(JSON.stringify({ feather: Infinity })).feather).toBeNull();
    expect(normalizeFeather(NaN)).toBe(0);
    expect(normalizeFeather(Infinity)).toBe(0);
    expect(normalizeFeather(-1)).toBe(0);
    expect(normalizeFeather(null as unknown as number)).toBe(0);
  });

  // ─── M15 Step 3E: freeform matte serialization round-trip ────────────

  function roundTripPart(part: any) {
    const { result } = renderSerializationWithPart(part);
    const exported = result.current.exportProject();
    mockSetCharacterParts.mockClear();
    expect(result.current.importProject(exported)).toBe(true);
    return (mockSetCharacterParts.mock.calls.at(-1)?.[0] as CharacterPart[]).find((p) => p.id === part.id)!;
  }

  const FREEFORM_POINTS = [{ x: 0, y: 0 }, { x: 60, y: 0 }, { x: 0, y: 30 }];

  it('M15: freeform points round-trip — coordinates, order and count preserved exactly', () => {
    const freeform = {
      id: 'freeform-source', type: 'custom_freeform', name: 'FF', zIndex: 1,
      baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
      fillColor: '#ff0000', strokeColor: '#101218',
      points: FREEFORM_POINTS,
    } as any;
    const restored = roundTripPart(freeform);
    expect(restored.points).toEqual(FREEFORM_POINTS); // deep equality: coords + order
    expect(restored.type).toBe('custom_freeform');
  });

  it('M15: freeform source + full matte (alpha, inverted, enabled, feather 12) round-trip intact', () => {
    const source = {
      id: 'freeform-source', type: 'custom_freeform', name: 'FF', zIndex: 1,
      baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
      fillColor: '#ff0000', strokeColor: '#101218',
      points: FREEFORM_POINTS,
    } as any;
    const target = {
      id: 'target', type: 'custom_box', name: 'T', zIndex: 2,
      baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
      fillColor: '#00ff00', strokeColor: '#101218',
      matte: { sourcePartId: 'freeform-source', mode: 'alpha', inverted: true, enabled: true, feather: 12 },
    } as any;
    const { result } = renderHook(() => useSerialization({
      fps: 30, setFps: mockSetFps,
      totalFrames: 120, setTotalFrames: mockSetTotalFrames,
      projectResolution: { width: 1920, height: 1080 }, setProjectResolution: mockSetProjectResolution,
      tracks: [], setTracks: mockSetTracks,
      characterParts: [source, target], setCharacterParts: mockSetCharacterParts,
      activeProjectTemplateId: 'default', setActiveProjectTemplateIdState: mockSetActiveProjectTemplateIdState,
      motionTemplates: [], setMotionTemplates: mockSetMotionTemplates,
      activeTemplateId: 'Sequence', setActiveTemplateIdState: mockSetActiveTemplateIdState,
      sceneTitle: 'Matte', setSceneTitleState: mockSetSceneTitleState,
      projectTemplates: [], setProjectTemplates: mockSetProjectTemplates,
      setTemplateCanvasStore: mockSetTemplateCanvasStore,
      setCurrentFrame: mockSetCurrentFrame,
      setIsPlaying: mockSetIsPlaying
    }));
    mockSetCharacterParts.mockClear();
    const exported = result.current.exportProject();
    // Export side: both layers carry their data
    const parsed = JSON.parse(exported);
    expect(parsed.layers.find((l: any) => l.id === 'freeform-source').points).toEqual(FREEFORM_POINTS);
    expect(parsed.layers.find((l: any) => l.id === 'target').matte).toEqual({
      sourcePartId: 'freeform-source', mode: 'alpha', inverted: true, enabled: true, feather: 12,
    });
    // Import side: restore BOTH parts then round-trip the full scene
    mockSetCharacterParts.mockClear();
    expect(result.current.importProject(exported)).toBe(true);
    const restoredParts = mockSetCharacterParts.mock.calls.at(-1)?.[0] as CharacterPart[];
    const restoredSource = restoredParts.find((p) => p.id === 'freeform-source')!;
    const restoredTarget = restoredParts.find((p) => p.id === 'target')!;
    expect(restoredSource.points).toEqual(FREEFORM_POINTS);
    expect(restoredTarget.matte).toEqual({
      sourcePartId: 'freeform-source', mode: 'alpha', inverted: true, enabled: true, feather: 12,
    });
  });

  it('M15: feather 0 / 12 / 100 with a freeform source survive round-trip', () => {
    for (const f of [0, 12, 100]) {
      const source = {
        id: 'freeform-source', type: 'custom_freeform', name: 'FF', zIndex: 1,
        baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
        fillColor: '#ff0000', strokeColor: '#101218',
        points: FREEFORM_POINTS,
        matte: { sourcePartId: 'tgt', mode: 'alpha', feather: f },
      } as any;
      const restored = roundTripPart(source);
      expect(restored.matte).toEqual({ sourcePartId: 'tgt', mode: 'alpha', feather: f });
      expect(restored.points).toEqual(FREEFORM_POINTS);
    }
  });

  // ─── M16 Step 2E: strength serialization round-trip ─────────────────

  const strengthPart = (matte: any) => ({
    id: 'tgt', type: 'custom_box', name: 'T', zIndex: 2,
    baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    fillColor: '#00ff00', strokeColor: '#101218',
    matte,
  });

  it('M16: strength 0 survives round-trip (0 is falsy — must NOT be dropped)', () => {
    const restored = roundTripPart(strengthPart({ sourcePartId: 'src', mode: 'alpha', strength: 0 }));
    expect(restored.matte).toEqual({ sourcePartId: 'src', mode: 'alpha', strength: 0 });
  });

  it('M16: strength 0.5 survives round-trip', () => {
    const restored = roundTripPart(strengthPart({ sourcePartId: 'src', mode: 'alpha', strength: 0.5 }));
    expect(restored.matte).toEqual({ sourcePartId: 'src', mode: 'alpha', strength: 0.5 });
  });

  it('M16: strength 1 survives round-trip', () => {
    const restored = roundTripPart(strengthPart({ sourcePartId: 'src', mode: 'alpha', strength: 1 }));
    expect(restored.matte).toEqual({ sourcePartId: 'src', mode: 'alpha', strength: 1 });
  });

  it('M16: full matte — feather + inverted + strength — round-trips intact', () => {
    const restored = roundTripPart(strengthPart({
      sourcePartId: 'src', mode: 'alpha', inverted: true, enabled: true, feather: 12, strength: 0.5,
    }));
    expect(restored.matte).toEqual({
      sourcePartId: 'src', mode: 'alpha', inverted: true, enabled: true, feather: 12, strength: 0.5,
    });
  });

  it('M16: legacy undefined strength → stays undefined (no forced strength: 1 migration)', () => {
    const restored = roundTripPart(strengthPart({ sourcePartId: 'src', mode: 'alpha', inverted: false, enabled: true, feather: 0 }));
    expect(restored.matte).toEqual({ sourcePartId: 'src', mode: 'alpha', inverted: false, enabled: true, feather: 0 });
    expect('strength' in restored.matte).toBe(false);
    expect(JSON.stringify(restored.matte)).not.toContain('strength');
  });

  it('M16: malformed strength (NaN/±Infinity/negative/>1) round-trips without breaking import', () => {
    // JSON.stringify(NaN/Infinity) → null — import must not crash and the
    // render pipeline's normalizeStrength guard keeps the mask safe.
    for (const bad of [NaN, Infinity, -Infinity]) {
      const part = strengthPart({ sourcePartId: 'src', mode: 'alpha', strength: bad });
      const { result } = renderSerializationWithPart(part);
      const exported = result.current.exportProject();
      mockSetCharacterParts.mockClear();
      expect(result.current.importProject(exported)).toBe(true); // never throws
      const restored = (mockSetCharacterParts.mock.calls.at(-1)?.[0] as CharacterPart[]).find((p) => p.id === 'tgt')!;
      expect(restored.matte.sourcePartId).toBe('src'); // matte survives
    }
  });

  it('M16: M8 channels-only — strength lives in layers[].matte, NEVER in Track.channels', () => {
    const source = {
      id: 'src', type: 'custom_star', name: 'S', zIndex: 1,
      baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
      fillColor: '#ff0000', strokeColor: '#101218',
      matte: { sourcePartId: 'tgt', mode: 'alpha', strength: 0.5 },
    } as any;
    const { result } = renderSerializationWithPart(source);
    const parsed = JSON.parse(result.current.exportProject());
    expect(parsed.layers.find((l: any) => l.id === 'src').matte.strength).toBe(0.5);
    expect(JSON.stringify(parsed)).not.toContain('maskOffsetStrength'); // no legacy-style channel
    // channels (if any tracks exist) never reference strength
    expect(parsed.tracks ?? []).not.toContain('strength');
  });

  // ─── M17 Step 3E: gradient serialization round-trip ─────────────────

  const gradPart = (matte: any) => ({
    id: 'tgt', type: 'custom_box', name: 'T', zIndex: 2,
    baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    fillColor: '#00ff00', strokeColor: '#101218',
    matte,
  });

  it('M17: gradient undefined → JSON has NO gradient key (legacy byte-compatible)', () => {
    const restored = roundTripPart(gradPart({ sourcePartId: 'src', mode: 'alpha' }));
    expect('gradient' in restored.matte).toBe(false);
    expect(JSON.stringify(restored.matte)).not.toContain('gradient');
  });

  it('M17: gradient angle 0 / 45 / 90 survive round-trip exactly', () => {
    for (const a of [0, 45, 90]) {
      const restored = roundTripPart(gradPart({ sourcePartId: 'src', mode: 'alpha', gradient: { angle: a } }));
      expect(restored.matte.gradient).toEqual({ angle: a });
    }
  });

  it('M17: angle 360 round-trips RAW (pass-through) — normalization happens at render', () => {
    // Serialization never rewrites values; normalizeGradientAngle(360) → 0 is
    // the RENDER layer's contract (pure helper tests cover it).
    const restored = roundTripPart(gradPart({ sourcePartId: 'src', mode: 'alpha', gradient: { angle: 360 } }));
    expect(restored.matte.gradient).toEqual({ angle: 360 });
    expect(normalizeGradientAngle(360)).toBe(0);
  });

  it('M17: malformed angle (NaN/±Infinity → JSON null) imports without breaking, render normalizes', () => {
    for (const bad of [NaN, Infinity, -Infinity]) {
      const part = gradPart({ sourcePartId: 'src', mode: 'alpha', gradient: { angle: bad } });
      const { result } = renderSerializationWithPart(part);
      const exported = result.current.exportProject();
      mockSetCharacterParts.mockClear();
      expect(result.current.importProject(exported)).toBe(true); // never throws
      const restored = (mockSetCharacterParts.mock.calls.at(-1)?.[0] as CharacterPart[]).find((p) => p.id === 'tgt')!;
      expect(restored.matte.sourcePartId).toBe('src'); // matte survives
      expect(normalizeGradientAngle(restored.matte.gradient?.angle)).toBe(0); // render-side guard
    }
  });

  it('M17: full matte — all seven fields survive round-trip intact', () => {
    const restored = roundTripPart(gradPart({
      sourcePartId: 'src', mode: 'alpha', inverted: true, enabled: true, feather: 12, strength: 0.5,
      gradient: { angle: 45 },
    }));
    expect(restored.matte).toEqual({
      sourcePartId: 'src', mode: 'alpha', inverted: true, enabled: true, feather: 12, strength: 0.5,
      gradient: { angle: 45 },
    });
  });

  it('M17: freeform source + gradient — points AND gradient survive', () => {
    const source = {
      id: 'ff', type: 'custom_freeform', name: 'FF', zIndex: 1,
      baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
      fillColor: '#ff0000', strokeColor: '#101218',
      points: [{ x: 0, y: 0 }, { x: 60, y: 0 }, { x: 0, y: 30 }],
      matte: { sourcePartId: 'tgt', mode: 'luminance', gradient: { angle: 90 } },
    } as any;
    const restored = roundTripPart(source);
    expect(restored.points).toEqual([{ x: 0, y: 0 }, { x: 60, y: 0 }, { x: 0, y: 30 }]);
    expect(restored.matte.gradient).toEqual({ angle: 90 });
  });

  it('M17: channels-only — gradient stays in layers[].matte, NEVER in Track.channels', () => {
    const part = gradPart({ sourcePartId: 'src', mode: 'alpha', gradient: { angle: 45 } });
    const { result } = renderSerializationWithPart(part);
    const parsed = JSON.parse(result.current.exportProject());
    expect(parsed.layers.find((l: any) => l.id === 'tgt').matte.gradient).toEqual({ angle: 45 });
    expect(JSON.stringify(parsed.tracks ?? [])).not.toContain('gradient');
    expect(JSON.stringify(parsed)).not.toContain('gradientChannel');
  });

  it('M17: legacy project without gradient imports unchanged (no gradient introduced)', () => {
    const restored = roundTripPart(gradPart({ sourcePartId: 'src', mode: 'alpha', inverted: false, enabled: true, feather: 0, strength: 0.5 }));
    expect(restored.matte).toEqual({ sourcePartId: 'src', mode: 'alpha', inverted: false, enabled: true, feather: 0, strength: 0.5 });
    expect('gradient' in restored.matte).toBe(false);
  });

  describe('M18 — text matte round-trip', () => {
  const textTarget = (matte: any) => ({
    id: 'tgt', type: 'custom_box', name: 'T', zIndex: 2,
    baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    fillColor: '#00ff00', strokeColor: '#101218',
    matte,
  });

  function roundTripPart(part: any) {
    const { result } = renderSerializationWithPart(part);
    const exported = result.current.exportProject();
    mockSetCharacterParts.mockClear();
    expect(result.current.importProject(exported)).toBe(true);
    return (mockSetCharacterParts.mock.calls.at(-1)?.[0] as CharacterPart[]).find((p) => p.id === part.id)!;
  }

  it('text matte round-trips: sourcePartId/mode/inverted/enabled/feather/strength/gradient all preserved', () => {
    const restored = roundTripPart(textTarget({
      sourcePartId: 'txt', mode: 'alpha', inverted: true, enabled: true, feather: 12, strength: 0.5,
      gradient: { angle: 45 },
    }));
    expect(restored.matte).toEqual({
      sourcePartId: 'txt', mode: 'alpha', inverted: true, enabled: true, feather: 12, strength: 0.5,
      gradient: { angle: 45 },
    });
  });

  it('NO text content / font render-data is serialized into the matte (runtime-only)', () => {
    const restored = roundTripPart(textTarget({ sourcePartId: 'txt', mode: 'alpha' }));
    const matteJson = JSON.stringify(restored.matte);
    expect(matteJson).not.toContain('HELLO');
    expect(matteJson).not.toContain('fontSize');
    expect(matteJson).not.toContain('fontFamily');
    expect(matteJson).not.toContain('textAnchor');
    expect(matteJson).not.toContain('content');
    // sourcePartId is the ONLY persistent link to the text source
    expect(restored.matte.sourcePartId).toBe('txt');
  });

  it('gradient absent before → absent after; angle 360 canonical normalization stable', () => {
    const plain = roundTripPart(textTarget({ sourcePartId: 'txt', mode: 'alpha' }));
    expect('gradient' in plain.matte).toBe(false);
    const canonical = roundTripPart(textTarget({ sourcePartId: 'txt', mode: 'alpha', gradient: { angle: 360 } }));
    expect(canonical.matte.gradient).toEqual({ angle: 360 }); // pass-through raw
    expect(normalizeGradientAngle(360)).toBe(0);              // render-side canonical (helper contract)
  });

  it('malformed gradient angle (NaN → JSON null) imports safely; render normalizes to 0', () => {
    const part = textTarget({ sourcePartId: 'txt', mode: 'alpha', gradient: { angle: NaN } });
    const { result } = renderSerializationWithPart(part);
    const exported = result.current.exportProject();
    mockSetCharacterParts.mockClear();
    expect(result.current.importProject(exported)).toBe(true);
    const restored = (mockSetCharacterParts.mock.calls.at(-1)?.[0] as CharacterPart[]).find((p) => p.id === 'tgt')!;
    expect(restored.matte.sourcePartId).toBe('txt');
    expect(normalizeGradientAngle(restored.matte.gradient?.angle)).toBe(0);
  });

  it('M8: no TrackChannel/keyframe/runtime render-data enters serialization', () => {
    const restored = roundTripPart(textTarget({ sourcePartId: 'txt', mode: 'luminance', inverted: true, gradient: { angle: 90 } }));
    const json = JSON.stringify(restored);
    expect(json).not.toContain('channel');
    expect(json).not.toContain('keyframe');
  });

  it('backward compat: shape-source matte JSON imports unchanged (regression)', () => {
    const shape = {
      id: 'src', type: 'custom_star', name: 'S', zIndex: 1,
      baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
      fillColor: '#ff0000', strokeColor: '#101218',
      matte: { sourcePartId: 'tgt', mode: 'alpha', feather: 8, strength: 0.7 },
    } as any;
    const restored = roundTripPart(shape);
    expect(restored.matte).toEqual({ sourcePartId: 'tgt', mode: 'alpha', feather: 8, strength: 0.7 });
  });

  describe('M19 — multi-stop gradient round-trip', () => {
    const textTarget = (matte: any) => ({
      id: 'tgt', type: 'custom_box', name: 'T', zIndex: 2,
      baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
      fillColor: '#00ff00', strokeColor: '#101218',
      matte,
    });

    function roundTripPart(part: any) {
      const { result } = renderSerializationWithPart(part);
      const exported = result.current.exportProject();
      mockSetCharacterParts.mockClear();
      expect(result.current.importProject(exported)).toBe(true);
      return (mockSetCharacterParts.mock.calls.at(-1)?.[0] as CharacterPart[]).find((p) => p.id === part.id)!;
    }

    const fullMatte = {
      sourcePartId: 'txt', mode: 'alpha', inverted: true, enabled: true, feather: 12, strength: 0.5,
      gradient: {
        angle: 45,
        stops: [
          { offset: 0, color: '#ffffff', opacity: 1 },
          { offset: 0.35, color: '#00ff00', opacity: 0.7 },
          { offset: 0.7, color: '#0000ff', opacity: 0.45 },
          { offset: 1, color: '#000000', opacity: 0.1 },
        ],
      },
    };

    it('explicit 4-stop gradient round-trips EXACTLY (angle + stops + every matte field)', () => {
      const restored = roundTripPart(textTarget(fullMatte));
      expect(restored.matte).toEqual(fullMatte);
      expect(JSON.stringify(restored.matte.gradient)).toContain('0.35');
      expect(restored.matte.gradient.stops).toHaveLength(4);
    });

    it('legacy {angle} stays legacy — stops are NOT invented by serialization', () => {
      const restored = roundTripPart(textTarget({ sourcePartId: 'txt', mode: 'alpha', gradient: { angle: 45 } }));
      expect(restored.matte.gradient).toEqual({ angle: 45 });
      expect('stops' in restored.matte.gradient).toBe(false);
    });

    it('malformed stops persist as-is (pass-through); render-side normalization is the contract', () => {
      // The serializer must NOT silently mutate persistent data — a malformed
      // stops array survives byte-for-byte and normalizeGradientStops (5B)
      // handles it deterministically at render time.
      const malformed = {
        sourcePartId: 'txt', mode: 'alpha',
        gradient: { angle: 45, stops: [{ offset: 9, color: '#ffffff', opacity: 2 }, { offset: 1, color: 'white', opacity: 0 }] },
      };
      const restored = roundTripPart(textTarget(malformed));
      expect(restored.matte.gradient.stops).toEqual([{ offset: 9, color: '#ffffff', opacity: 2 }, { offset: 1, color: 'white', opacity: 0 }]);
      const normalized = normalizeGradientStops(restored.matte.gradient.stops, 'alpha');
      expect(normalized[0]).toEqual({ offset: 1, color: '#ffffff', opacity: 1 }); // clamped 9→1, 2→1
    });

    it('runtime text data is NOT serialized (M18 contract holds with stops present)', () => {
      const restored = roundTripPart(textTarget(fullMatte));
      const json = JSON.stringify(restored);
      expect(json).not.toContain('fontSize');
      expect(json).not.toContain('fontFamily');
      expect(json).not.toContain('textAnchor');
      expect(json).not.toContain('content');
      expect(json).not.toContain('keyframe');
      expect(json).not.toContain('channel');
    });

    it('M8: stops are static paint — no TrackChannel/keyframe enters the JSON', () => {
      const restored = roundTripPart(textTarget(fullMatte));
      const json = JSON.stringify(restored);
      expect(json).not.toContain('TrackChannel');
      expect(json).not.toContain('keyframe');
      expect(json).not.toContain('animation');
    });
  });
  });
});
