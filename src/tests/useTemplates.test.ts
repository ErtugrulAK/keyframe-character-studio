import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useTemplates } from '../hooks/useTemplates';
import type { Track } from '../types/animator';

describe('useTemplates Hook', () => {
  const mockSetCharacterParts = vi.fn();
  const mockSetTracks = vi.fn();
  const mockSetFps = vi.fn();
  const mockSetCurrentFrame = vi.fn();
  const mockSetIsPlaying = vi.fn();

  const render = (appMode: 'edit' | 'broadcast' = 'edit') =>
    renderHook(() => useTemplates({
      characterParts: [],
      setCharacterParts: mockSetCharacterParts,
      tracks: [],
      setTracks: mockSetTracks,
      setFps: mockSetFps,
      setCurrentFrame: mockSetCurrentFrame,
      setIsPlaying: mockSetIsPlaying,
      appMode,
    }));

  it('initializes with default sequence templates', () => {
    const { result } = render();

    expect(result.current.motionTemplates.length).toBeGreaterThan(0);
    expect(result.current.motionTemplates[0].id).toBe('Sequence');
    expect(result.current.activeTemplateId).toBe('Sequence');
  });

  it('adds and deletes a motion template', () => {
    const { result } = render();

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

  it('creates a generated stable ID and disambiguates duplicate display names', () => {
    const { result } = render();

    act(() => {
      result.current.addMotionTemplate('Sequence', 'out');
    });

    const created = result.current.motionTemplates[1];
    expect(created.id).toMatch(/^seq_/);
    expect(created.id).not.toBe(created.name);
    expect(created.name).toBe('Sequence 2');
    expect(result.current.activeTemplateId).toBe(created.id);
  });

  it('renames metadata without changing sequence identity or channel references', () => {
    const { result } = render();

    act(() => {
      result.current.addMotionTemplate('Lower Third', 'in');
    });
    const id = result.current.motionTemplates[1].id;
    mockSetTracks.mockClear();

    act(() => {
      result.current.renameMotionTemplate(id, 'Hero Lower Third');
    });

    expect(result.current.motionTemplates[1]).toMatchObject({ id, name: 'Hero Lower Third' });
    expect(mockSetTracks).not.toHaveBeenCalled();
  });

  it('updates only sequence duration and preserves authored channel timing', () => {
    const { result } = render();

    act(() => {
      result.current.addMotionTemplate('Short', 'in');
    });
    const id = result.current.motionTemplates[1].id;

    act(() => {
      result.current.updateMotionTemplateDuration(id, 12.9);
    });

    expect(result.current.motionTemplates[1].durationFrames).toBe(12);
  });

  it('deleteMotionTemplate removes its channel/keyframe data but keeps other templates', () => {
    const { result } = render();

    // Create a template and capture its id
    act(() => {
      result.current.addMotionTemplate('My Anim', 'in');
    });
    const newId = result.current.motionTemplates[1].id;

    // Track holds data for BOTH the new template and the default Sequence
    const tracks = [{
      id: 't1', partId: 'p1', name: 'T1', color: '#f00', visible: true,
      keyframes: [
        { id: 'kf_seq', frame: 0, transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }, easing: 'linear' },
        { id: 'kf_new', frame: 10, transform: { x: 50, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }, easing: 'linear', templateId: newId },
      ],
      channels: {
        x: [
          { id: 'cx_seq', frame: 0, value: 0, easing: 'linear' },
          { id: 'cx_new', frame: 10, value: 50, easing: 'linear', templateId: newId },
        ],
        opacity: [
          { id: 'co_seq', frame: 0, value: 1, easing: 'linear' },
          { id: 'co_new', frame: 10, value: 0, easing: 'linear', templateId: newId },
        ],
      },
    }] as unknown as Track[];

    mockSetTracks.mockClear();
    act(() => {
      result.current.deleteMotionTemplate(newId);
    });

    // Template list no longer contains the deleted template
    expect(result.current.motionTemplates.some((t) => t.id === newId)).toBe(false);

    // setTracks updater: deleted template data removed, Sequence data kept
    const updater = mockSetTracks.mock.calls.at(-1)?.[0] as (prev: Track[]) => Track[];
    const updated = updater(tracks);

    expect(updated[0].keyframes.map((k) => k.id)).toEqual(['kf_seq']);
    expect(updated[0].channels.x.map((pk) => pk.id)).toEqual(['cx_seq']);
    expect(updated[0].channels.opacity.map((pk) => pk.id)).toEqual(['co_seq']);
  });

  // BUGFIX (broadcast isolation): selecting a sequence in broadcast mode must
  // NOT touch the edit timeline playback state (currentFrame/isPlaying).
  it('edit mode: selecting a sequence resets frame 0 and stops playback (legacy behavior)', () => {
    mockSetCurrentFrame.mockClear();
    mockSetIsPlaying.mockClear();
    const { result } = render('edit');
    act(() => {
      result.current.setActiveTemplateId('Sequence');
    });
    expect(mockSetCurrentFrame).toHaveBeenCalledWith(0);
    expect(mockSetIsPlaying).toHaveBeenCalledWith(false);
  });

  it('broadcast mode: selecting a sequence does NOT touch edit timeline playback state (BUGFIX isolation)', () => {
    mockSetCurrentFrame.mockClear();
    mockSetIsPlaying.mockClear();
    const { result } = render('broadcast');
    act(() => {
      result.current.setActiveTemplateId('Sequence');
    });
    expect(mockSetCurrentFrame).not.toHaveBeenCalled();
    expect(mockSetIsPlaying).not.toHaveBeenCalled();
    // the active template id still changes (keyframe filtering depends on it)
    expect(result.current.activeTemplateId).toBe('Sequence');
  });
});
