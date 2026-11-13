import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSerialization } from '../hooks/useSerialization';
import { createCustomPart } from '../utils/layers/partFactory';
import { textBaselineOffset } from '../utils/geometry/textOrigin';
import type { CharacterPart } from '../types/animator';
import type { SceneLayer } from '../types/composition';

/**
 * A new text layer is placed, turned and scaled about its middle; a text saved
 * before `textOrigin` existed keeps its baseline origin, so no saved scene
 * moves. The field travels through save and load unchanged.
 */

const serialization = (characterParts: CharacterPart[] = [], setCharacterParts = vi.fn()) => {
  const noop = vi.fn();
  return renderHook(() => useSerialization({
    fps: 24, totalFrames: 48, projectResolution: { width: 1920, height: 1080 },
    tracks: [], characterParts, activeProjectTemplateId: 'default', motionTemplates: [],
    activeTemplateId: 'Sequence', sceneTitle: 'T',
    setFps: noop, setTotalFrames: noop, setProjectResolution: noop, setCoordinateSystem: noop, setTracks: noop,
    setCharacterParts, setActiveProjectTemplateIdState: noop, setMotionTemplates: noop, setActiveTemplateIdState: noop,
    setSceneTitleState: noop, setProjectTemplates: noop, setTemplateCanvasStore: noop, setCurrentFrame: noop, setIsPlaying: noop,
  }));
};

describe('text origin', () => {
  it('a new text layer is centred; other new layers carry no text origin', () => {
    expect(createCustomPart('custom_text', 'Text', 1).newPart.textOrigin).toBe('center');
    expect(createCustomPart('custom_rect', 'Box', 1).newPart.textOrigin).toBeUndefined();
  });

  it('only a centred text moves its baseline below the origin', () => {
    expect(textBaselineOffset({ fontSize: 100 })).toBe(0);
    expect(textBaselineOffset({ fontSize: 100, textOrigin: 'baseline' })).toBe(0);
    expect(textBaselineOffset({ fontSize: 100, textOrigin: 'center' })).toBeCloseTo(34.6, 9);
  });

  const layer = (id: string, extra: Partial<SceneLayer> = {}): SceneLayer => ({
    id, name: id, type: 'custom_text', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
    visible: true, zIndex: 1, fillColor: '#ffffff', strokeColor: '#000000', textValue: 'HELLO', fontSize: 40, ...extra,
  });

  it('survives save and load, and an older text loads without one', () => {
    const setCharacterParts = vi.fn();
    const hook = serialization([], setCharacterParts);
    const scene = JSON.stringify({
      version: 1, width: 320, height: 180, fps: 24, totalFrames: 24, tracks: [],
      layers: [layer('centred', { textOrigin: 'center' }), layer('older')],
    });
    act(() => { expect(hook.result.current.importProject(scene).ok).toBe(true); });
    const parts = setCharacterParts.mock.calls[0][0] as CharacterPart[];
    expect(parts.find((part) => part.id === 'centred')?.textOrigin).toBe('center');
    expect(parts.find((part) => part.id === 'older')?.textOrigin).toBeUndefined();

    const rerender = serialization(parts);
    const saved = JSON.parse(rerender.result.current.exportProject()) as { layers: SceneLayer[] };
    expect(saved.layers.find((entry) => entry.id === 'centred')?.textOrigin).toBe('center');
    expect(saved.layers.find((entry) => entry.id === 'older')).not.toHaveProperty('textOrigin');
  });

  it('refuses a non-string text origin at the import boundary', () => {
    const setCharacterParts = vi.fn();
    const hook = serialization([], setCharacterParts);
    const scene = JSON.stringify({
      version: 1, width: 320, height: 180, fps: 24, totalFrames: 24, tracks: [],
      layers: [{ ...layer('bad'), textOrigin: { evil: true } }],
    });
    act(() => { expect(hook.result.current.importProject(scene).ok).toBe(false); });
    expect(setCharacterParts).not.toHaveBeenCalled();
  });
});
