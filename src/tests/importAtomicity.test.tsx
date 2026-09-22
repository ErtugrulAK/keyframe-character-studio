import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSerialization } from '../hooks/useSerialization';
import type { SceneLayer } from '../types/composition';

/**
 * Milestone F item 12 — an import that cannot be applied must not apply part of
 * itself.
 *
 * `importProject` refuses a scene it cannot turn into editor state, and the scene
 * is prepared completely **before** the first state update. These tests drive the
 * hook and prove that a scene the boundary accepts but the apply path cannot use
 * leaves every state setter untouched.
 */

const existingLayer = (): SceneLayer => ({
  id: 'existing',
  name: 'Existing',
  type: 'custom_box',
  x: 0,
  y: 0,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
  visible: true,
  zIndex: 1,
  fillColor: '#ffffff',
  strokeColor: '#000000',
});

const renderSerialization = () => {
  const setters = {
    setFps: vi.fn(),
    setTotalFrames: vi.fn(),
    setProjectResolution: vi.fn(),
    setCoordinateSystem: vi.fn(),
    setTracks: vi.fn(),
    setCharacterParts: vi.fn(),
    setActiveProjectTemplateIdState: vi.fn(),
    setMotionTemplates: vi.fn(),
    setActiveTemplateIdState: vi.fn(),
    setSceneTitleState: vi.fn(),
    setProjectTemplates: vi.fn(),
    setTemplateCanvasStore: vi.fn(),
    setCurrentFrame: vi.fn(),
    setIsPlaying: vi.fn(),
  };
  const hook = renderHook(() => useSerialization({
    fps: 24,
    totalFrames: 48,
    projectResolution: { width: 1920, height: 1080 },
    tracks: [],
    characterParts: [],
    activeProjectTemplateId: 'default',
    motionTemplates: [],
    activeTemplateId: 'Sequence',
    sceneTitle: 'Existing',
    ...setters,
  }));
  return { hook, setters };
};

const sceneText = (overrides: Record<string, unknown>) => JSON.stringify({
  version: 1,
  width: 320,
  height: 180,
  fps: 24,
  totalFrames: 24,
  layers: [existingLayer()],
  tracks: [],
  ...overrides,
});

describe('project import applies atomically', () => {
  it('leaves every state setter untouched when a nested scene structure cannot be applied', () => {
    const { hook, setters } = renderSerialization();

    // The boundary accepts both documents (arrays at the top level), while the
    // apply path cannot convert their nested values.
    const channelShape = hook.result.current.importProject(sceneText({ tracks: [{ partId: 'p', channels: { x: { length: 1 } } }] }));
    const templateShape = hook.result.current.importProject(sceneText({ motionTemplates: [null] }));

    expect(channelShape.ok).toBe(false);
    expect(templateShape.ok).toBe(false);
    for (const [name, setter] of Object.entries(setters)) {
      expect(setter, `${name} must not be called for a refused import`).not.toHaveBeenCalled();
    }
  });

  it('applies a scene it can use', () => {
    const { hook, setters } = renderSerialization();

    const result = hook.result.current.importProject(sceneText({}));

    expect(result.ok).toBe(true);
    expect(setters.setCharacterParts).toHaveBeenCalledTimes(1);
    expect(setters.setTracks).toHaveBeenCalledTimes(1);
  });
});
