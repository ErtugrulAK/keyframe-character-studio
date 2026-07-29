import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useSerialization } from '../hooks/useSerialization';
import { AnimationProject } from '../types/animator';

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
});
