import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useInspector } from '../hooks/useInspector';
import { Track } from '../types/animator';

describe('useInspector Hook', () => {
  const mockSetTracks = vi.fn();
  const mockSetCharacterParts = vi.fn();
  const mockGetComputedTransform = vi.fn().mockReturnValue({ x:0, y:0, rotation:0, scaleX:1, scaleY:1, opacity:1 });
  const mockAddKeyframeToTrack = vi.fn();

  const mockTracks: Track[] = [
    {
      id: 'track_1', partId: 'part_1', name: 'T1', channels: { customProps: [] },
      keyframes: [{ id: 'kf_1', frame: 0, templateId: 'Sequence', transform: { x:0, y:0, rotation:0, scaleX:1, scaleY:1, opacity:1 }, easing: 'linear' }]
    }
  ] as any;

  it('updates current transform on existing keyframe', () => {
    const { result } = renderHook(() => useInspector({
      selectedPartId: 'part_1',
      selectedPartIds: ['part_1'],
      activeTemplateId: 'Sequence',
      currentFrame: 0,
      tracks: mockTracks,
      setTracks: mockSetTracks,
      setCharacterParts: mockSetCharacterParts,
      getComputedTransform: mockGetComputedTransform,
      addKeyframeToTrack: mockAddKeyframeToTrack
    }));

    act(() => {
      result.current.updateCurrentTransform({ x: 50 });
    });

    expect(mockSetTracks).toHaveBeenCalled();
    const updateFn = mockSetTracks.mock.calls[0][0];
    const newTracks = updateFn(mockTracks);
    expect(newTracks[0].keyframes[0].transform.x).toBe(50);
  });

  it('adds keyframe if none exists on current frame when updating transform', () => {
    const { result } = renderHook(() => useInspector({
      selectedPartId: 'part_1',
      selectedPartIds: ['part_1'],
      activeTemplateId: 'Sequence',
      currentFrame: 10, // No keyframe at 10
      tracks: mockTracks,
      setTracks: mockSetTracks,
      setCharacterParts: mockSetCharacterParts,
      getComputedTransform: mockGetComputedTransform,
      addKeyframeToTrack: mockAddKeyframeToTrack
    }));

    act(() => {
      result.current.updateCurrentTransform({ y: 100 });
    });

    expect(mockAddKeyframeToTrack).toHaveBeenCalledWith('track_1', 10);
  });

  // ─── M4: channel-aware Inspector edits ─────────────────────────────

  function channelTrack(channels: Record<string, any[]>): Track {
    return {
      id: 'track_ch',
      partId: 'part_ch',
      name: 'TCh',
      keyframes: [],
      channels: {
        x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [],
        maskOffsetX: [], maskOffsetY: [], maskScale: [], maskRotation: [],
        ...channels,
      },
      visible: true,
      locked: false,
    } as any;
  }

  const pk = (id: string, frame: number, value: number, templateId = 'Sequence') => ({
    id, frame, value, easing: 'linear', templateId,
  });

  it('M4-1: Inspector edit updates the 6 channels at current frame', () => {
    const track = channelTrack({
      x: [pk('x0', 0, 10)],
      y: [pk('y0', 0, 20)],
      rotation: [pk('r0', 0, 0)],
      scaleX: [pk('sx0', 0, 1)],
      scaleY: [pk('sy0', 0, 1)],
      opacity: [pk('o0', 0, 1)],
    });
    const { result } = renderHook(() => useInspector({
      selectedPartId: 'part_ch',
      selectedPartIds: ['part_ch'],
      activeTemplateId: 'Sequence',
      currentFrame: 0,
      tracks: [track],
      setTracks: mockSetTracks,
      setCharacterParts: mockSetCharacterParts,
      getComputedTransform: mockGetComputedTransform,
      addKeyframeToTrack: mockAddKeyframeToTrack
    }));

    act(() => {
      result.current.updateCurrentTransform({ x: 50, y: 60, rotation: 15, scaleX: 2, scaleY: 3, opacity: 0.5 });
    });

    const updateFn = mockSetTracks.mock.calls.at(-1)[0];
    const newTracks = updateFn([track]);
    const ch = newTracks[0].channels;
    expect(ch.x[0].value).toBe(50);
    expect(ch.y[0].value).toBe(60);
    expect(ch.rotation[0].value).toBe(15);
    expect(ch.scaleX[0].value).toBe(2);
    expect(ch.scaleY[0].value).toBe(3);
    expect(ch.opacity[0].value).toBeCloseTo(0.5, 5);
  });

  it('M4-2: only target frame/template channel keyframes are updated', () => {
    const track = channelTrack({
      x: [pk('x0', 0, 10), pk('x1', 60, 100)],
      y: [pk('y0', 0, 20)],
    });
    const { result } = renderHook(() => useInspector({
      selectedPartId: 'part_ch',
      selectedPartIds: ['part_ch'],
      activeTemplateId: 'Sequence',
      currentFrame: 0,
      tracks: [track],
      setTracks: mockSetTracks,
      setCharacterParts: mockSetCharacterParts,
      getComputedTransform: mockGetComputedTransform,
      addKeyframeToTrack: mockAddKeyframeToTrack
    }));

    act(() => {
      result.current.updateCurrentTransform({ x: 55 });
    });

    const newTracks = mockSetTracks.mock.calls.at(-1)[0]([track]);
    expect(newTracks[0].channels.x[0].value).toBe(55);   // frame 0 updated
    expect(newTracks[0].channels.x[1].value).toBe(100);  // frame 60 untouched
    expect(newTracks[0].channels.y[0].value).toBe(20);   // other channel untouched
  });

  it('M4-3: adds channel keyframe at empty frame, reusing template easing', () => {
    const track = channelTrack({
      x: [pk('x0', 0, 10, 'Sequence')],
    });
    const { result } = renderHook(() => useInspector({
      selectedPartId: 'part_ch',
      selectedPartIds: ['part_ch'],
      activeTemplateId: 'Sequence',
      currentFrame: 30, // empty frame for x channel
      tracks: [track],
      setTracks: mockSetTracks,
      setCharacterParts: mockSetCharacterParts,
      getComputedTransform: mockGetComputedTransform,
      addKeyframeToTrack: mockAddKeyframeToTrack
    }));

    act(() => {
      result.current.updateCurrentTransform({ x: 77 });
    });

    const newTracks = mockSetTracks.mock.calls.at(-1)[0]([track]);
    expect(newTracks[0].channels.x).toHaveLength(2);
    expect(newTracks[0].channels.x[1].frame).toBe(30);
    expect(newTracks[0].channels.x[1].value).toBe(77);
    expect(newTracks[0].channels.x[1].easing).toBe('linear'); // template easing reused
  });

  it('M4-4: other tracks are not touched', () => {
    const t1 = channelTrack({ x: [pk('x0', 0, 10)] });
    const t2 = channelTrack({ x: [pk('x0', 0, 10)] });
    t2.id = 'track_other';
    t2.partId = 'part_other';

    const { result } = renderHook(() => useInspector({
      selectedPartId: 'part_ch',
      selectedPartIds: ['part_ch'],
      activeTemplateId: 'Sequence',
      currentFrame: 0,
      tracks: [t1, t2],
      setTracks: mockSetTracks,
      setCharacterParts: mockSetCharacterParts,
      getComputedTransform: mockGetComputedTransform,
      addKeyframeToTrack: mockAddKeyframeToTrack
    }));

    act(() => {
      result.current.updateCurrentTransform({ x: 99 });
    });

    const newTracks = mockSetTracks.mock.calls.at(-1)[0]([t1, t2]);
    expect(newTracks[0].channels.x[0].value).toBe(99);
    expect(newTracks[1].channels.x[0].value).toBe(10);
  });

  it('M4-5: legacy-only track keeps legacy behavior (regression)', () => {
    const { result } = renderHook(() => useInspector({
      selectedPartId: 'part_1',
      selectedPartIds: ['part_1'],
      activeTemplateId: 'Sequence',
      currentFrame: 0,
      tracks: mockTracks,
      setTracks: mockSetTracks,
      setCharacterParts: mockSetCharacterParts,
      getComputedTransform: mockGetComputedTransform,
      addKeyframeToTrack: mockAddKeyframeToTrack
    }));

    act(() => {
      result.current.updateCurrentTransform({ x: 50 });
    });

    const newTracks = mockSetTracks.mock.calls.at(-1)[0](mockTracks);
    expect(newTracks[0].keyframes[0].transform.x).toBe(50);
  });

  it('M4-6: channel empty for property → baseTransform fallback (no keyframe invented)', () => {
    const track = channelTrack({
      x: [pk('x0', 0, 10)],
      // opacity channel completely empty
    });
    const { result } = renderHook(() => useInspector({
      selectedPartId: 'part_ch',
      selectedPartIds: ['part_ch'],
      activeTemplateId: 'Sequence',
      currentFrame: 0,
      tracks: [track],
      setTracks: mockSetTracks,
      setCharacterParts: mockSetCharacterParts,
      getComputedTransform: mockGetComputedTransform,
      addKeyframeToTrack: mockAddKeyframeToTrack
    }));

    act(() => {
      result.current.updateCurrentTransform({ x: 11, opacity: 0.4 });
    });

    // x → channel update; opacity (empty channel) → baseTransform
    const newTracks = mockSetTracks.mock.calls.at(-1)[0]([track]);
    expect(newTracks[0].channels.x[0].value).toBe(11);
    expect(newTracks[0].channels.opacity).toHaveLength(0); // no keyframe invented

    const baseFn = mockSetCharacterParts.mock.calls.at(-1)[0];
    const newParts = baseFn([{ id: 'part_ch', baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } }]);
    expect(newParts[0].baseTransform.opacity).toBeCloseTo(0.4, 5);
  });

  it('M4-7: opacity 0 is preserved in channel update', () => {
    const track = channelTrack({
      opacity: [pk('o0', 0, 1)],
      x: [pk('x0', 0, 0)],
    });
    const { result } = renderHook(() => useInspector({
      selectedPartId: 'part_ch',
      selectedPartIds: ['part_ch'],
      activeTemplateId: 'Sequence',
      currentFrame: 0,
      tracks: [track],
      setTracks: mockSetTracks,
      setCharacterParts: mockSetCharacterParts,
      getComputedTransform: mockGetComputedTransform,
      addKeyframeToTrack: mockAddKeyframeToTrack
    }));

    act(() => {
      result.current.updateCurrentTransform({ opacity: 0 });
    });

    const newTracks = mockSetTracks.mock.calls.at(-1)[0]([track]);
    expect(newTracks[0].channels.opacity[0].value).toBe(0);
  });

  it('M4-8: template filtering — only active template channels updated', () => {
    const track = channelTrack({
      x: [pk('x0', 0, 10, 'Sequence'), pk('x1', 0, 99, 'Outro')],
    });
    const { result } = renderHook(() => useInspector({
      selectedPartId: 'part_ch',
      selectedPartIds: ['part_ch'],
      activeTemplateId: 'Sequence',
      currentFrame: 0,
      tracks: [track],
      setTracks: mockSetTracks,
      setCharacterParts: mockSetCharacterParts,
      getComputedTransform: mockGetComputedTransform,
      addKeyframeToTrack: mockAddKeyframeToTrack
    }));

    act(() => {
      result.current.updateCurrentTransform({ x: 42 });
    });

    const newTracks = mockSetTracks.mock.calls.at(-1)[0]([track]);
    const seqKf = newTracks[0].channels.x.find((k: any) => k.templateId === 'Sequence');
    const outroKf = newTracks[0].channels.x.find((k: any) => k.templateId === 'Outro');
    expect(seqKf.value).toBe(42);
    expect(outroKf.value).toBe(99); // untouched
  });
});
