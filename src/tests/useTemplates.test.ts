import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useTemplates } from '../hooks/useTemplates';

describe('useTemplates Hook', () => {
  const mockSetCharacterParts = vi.fn();
  const mockSetTracks = vi.fn();
  const mockSetFps = vi.fn();
  const mockSetCurrentFrame = vi.fn();
  const mockSetIsPlaying = vi.fn();

  it('initializes with default sequence templates', () => {
    const { result } = renderHook(() => useTemplates({
      characterParts: [],
      setCharacterParts: mockSetCharacterParts,
      tracks: [],
      setTracks: mockSetTracks,
      setFps: mockSetFps,
      setCurrentFrame: mockSetCurrentFrame,
      setIsPlaying: mockSetIsPlaying
    }));

    expect(result.current.motionTemplates.length).toBeGreaterThan(0);
    expect(result.current.motionTemplates[0].id).toBe('Sequence');
    expect(result.current.activeTemplateId).toBe('Sequence');
  });

  it('adds and deletes a motion template', () => {
    const { result } = renderHook(() => useTemplates({
      characterParts: [],
      setCharacterParts: mockSetCharacterParts,
      tracks: [],
      setTracks: mockSetTracks,
      setFps: mockSetFps,
      setCurrentFrame: mockSetCurrentFrame,
      setIsPlaying: mockSetIsPlaying
    }));

    act(() => {
      result.current.addMotionTemplate('My Animation', 'in');
    });

    expect(result.current.motionTemplates.length).toBe(2);
    expect(result.current.motionTemplates[1].name).toBe('My Animation');
    expect(result.current.motionTemplates[1].type).toBe('in');

    const id = result.current.motionTemplates[1].id;

    act(() => {
      result.current.deleteMotionTemplate(id);
    });

    expect(result.current.motionTemplates.length).toBe(1);
  });
});
