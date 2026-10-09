/**
 * Trim Path authoring must be frame-specific.
 *
 * The reported bug: the Inspector's Trim Path fields wrote and displayed the
 * layer's STATIC field, so a keyed property read as a global edit — the same
 * number appeared at every frame, and editing a later frame appeared to rewrite
 * the earlier keyframe. The fields now show the evaluated value at the current
 * frame and write through the canonical channel authority.
 */

import React from 'react';
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react';

/** The TRIM PATH card starts collapsed; its fields only exist once expanded. */
const expandTrimPath = () => fireEvent.click(screen.getByRole('button', { name: 'Expand TRIM PATH' }));
import { describe, expect, it, vi } from 'vitest';
import { TrimPathSection } from '../components/Inspector/sections/style/TrimPathSection';
import { useInspector } from '../hooks/useInspector';
import { evaluateTrimPath } from '../utils/trimPath';
import { makeEmptyChannels } from '../utils/defaults';
import type { CharacterPart, Track, PropertyKeyframe } from '../types/animator';

const part = (overrides: Partial<CharacterPart> = {}): CharacterPart => ({
  id: 'path', name: 'Path', type: 'custom_freeform', zIndex: 1,
  baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
  fillColor: '#fff', strokeColor: '#000',
  trimPathEnabled: true, trimPathStart: 0, trimPathEnd: 1, trimPathOffset: 0,
  ...overrides,
} as CharacterPart);

const track = (channels: Partial<Record<'trimPathStart' | 'trimPathEnd' | 'trimPathOffset', PropertyKeyframe[]>>): Track => ({
  id: 'track_path', partId: 'path', name: 'Path', color: '#f00',
  keyframes: [], channels: { ...makeEmptyChannels(), ...channels },
  visible: true, locked: false,
});

const pk = (id: string, frame: number, value: number): PropertyKeyframe =>
  ({ id, frame, value, easing: 'linear', templateId: 'Sequence' } as PropertyKeyframe);

describe('TrimPathSection — the field shows the evaluated value', () => {
  it('displays the evaluated End instead of the static field while keyed', () => {
    render(<TrimPathSection selectedPart={part({ trimPathEnd: 1 })} onPartPropChange={vi.fn()} evaluatedTrim={{ start: 0, end: 0, offset: 0 }} />);
    expandTrimPath();
    expect((screen.getByLabelText('Trim Path End') as HTMLInputElement).value).toBe('0');
  });

  it('falls back to the static field when nothing is evaluated', () => {
    render(<TrimPathSection selectedPart={part({ trimPathEnd: 0.5 })} onPartPropChange={vi.fn()} />);
    expandTrimPath();
    expect((screen.getByLabelText('Trim Path End') as HTMLInputElement).value).toBe('50');
  });

  it('writes through the channel authority rather than the static field', () => {
    const onUpdateTrimChannel = vi.fn();
    const onPartPropChange = vi.fn();
    render(<TrimPathSection selectedPart={part()} onPartPropChange={onPartPropChange} evaluatedTrim={{ start: 0, end: 1, offset: 0 }} onUpdateTrimChannel={onUpdateTrimChannel} />);
    expandTrimPath();

    fireEvent.change(screen.getByLabelText('Trim Path End'), { target: { value: '40' } });

    expect(onUpdateTrimChannel).toHaveBeenCalledWith('trimPathEnd', 0.4);
    expect(onPartPropChange).not.toHaveBeenCalledWith('trimPathEnd', expect.anything());
  });

  it('offers a keyframe toggle per channel that reports the current-frame state', () => {
    const onToggleTrimKeyframe = vi.fn();
    render(<TrimPathSection
      selectedPart={part()}
      onPartPropChange={vi.fn()}
      evaluatedTrim={{ start: 0, end: 1, offset: 0 }}
      keyframedAtFrame={{ trimPathStart: false, trimPathEnd: true, trimPathOffset: false }}
      onToggleTrimKeyframe={onToggleTrimKeyframe}
    />);
    expandTrimPath();

    expect(screen.getByLabelText('Remove Trim Path End Keyframe')).toBeTruthy();
    expect(screen.getByLabelText('Add Trim Path Start Keyframe')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Add Trim Path Start Keyframe'));
    expect(onToggleTrimKeyframe).toHaveBeenCalledWith('trimPathStart');
  });
});

describe('updateCurrentPropertyChannel — trim path writes stay on one frame', () => {
  function harness(initialTracks: Track[], frame: number) {
    let tracks = initialTracks;
    let parts = [part()];
    const trackUpdaters: Array<(prev: Track[]) => Track[]> = [];
    const { result } = renderHook(() => useInspector({
      selectedPartId: 'path',
      selectedPartIds: ['path'],
      activeTemplateId: 'Sequence',
      currentFrame: frame,
      tracks,
      characterParts: parts,
      setTracks: (update: React.SetStateAction<Track[]>) => { trackUpdaters.push(update as (prev: Track[]) => Track[]); },
      setCharacterParts: (update: React.SetStateAction<CharacterPart[]>) => { parts = (update as (prev: CharacterPart[]) => CharacterPart[])(parts); },
      getComputedTransform: () => ({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }),
      addKeyframeToTrack: vi.fn(),
    }));
    const commit = () => { for (const update of trackUpdaters) tracks = update(tracks); trackUpdaters.length = 0; };
    return { result, commit, current: () => tracks };
  }

  it('keeps the earlier keyframe at 0 when a later frame is set to 100', () => {
    const h = harness([track({ trimPathEnd: [pk('a', 0, 0)] })], 30);

    act(() => h.result.current.updateCurrentPropertyChannel('trimPathEnd', 1));
    h.commit();

    const ends = h.current()[0].channels.trimPathEnd;
    expect(ends.find((keyframe) => keyframe.frame === 0)?.value).toBe(0);
    expect(ends.find((keyframe) => keyframe.frame === 30)?.value).toBe(1);
  });

  it('updates only the current frame when a keyframe already exists there', () => {
    const h = harness([track({ trimPathEnd: [pk('a', 0, 0), pk('b', 30, 0.25)] })], 30);

    act(() => h.result.current.updateCurrentPropertyChannel('trimPathEnd', 0.75));
    h.commit();

    const ends = h.current()[0].channels.trimPathEnd;
    expect(ends.find((keyframe) => keyframe.frame === 0)?.value).toBe(0);
    expect(ends.find((keyframe) => keyframe.frame === 30)?.value).toBe(0.75);
  });

  it('writes the static field while the channel has no keyframes', () => {
    const h = harness([track({})], 30);

    act(() => h.result.current.updateCurrentPropertyChannel('trimPathEnd', 0.4));
    h.commit();

    expect(h.current()[0].channels.trimPathEnd).toHaveLength(0);
  });

  it('does not overwrite another sequence at the same frame', () => {
    const other: PropertyKeyframe = { ...pk('outro', 30, 0.9), templateId: 'Outro' };
    const h = harness([track({ trimPathEnd: [pk('a', 0, 0), other] })], 30);

    act(() => h.result.current.updateCurrentPropertyChannel('trimPathEnd', 0.1));
    h.commit();

    const ends = h.current()[0].channels.trimPathEnd;
    expect(ends.find((keyframe) => keyframe.id === 'outro')?.value).toBe(0.9);
  });
});

describe('evaluateTrimPath — keyed values win and interpolate', () => {
  it('resolves the midpoint between an early 0 and a later 100', () => {
    const resolved = evaluateTrimPath(part({ trimPathEnd: 1 }), track({ trimPathEnd: [pk('a', 0, 0), pk('b', 30, 1)] }), 15, 'Sequence');
    expect(resolved.end).toBeGreaterThan(0);
    expect(resolved.end).toBeLessThan(1);
  });

  it('keeps each authored frame at its own value', () => {
    const t = track({ trimPathEnd: [pk('a', 0, 0), pk('b', 30, 1)] });
    expect(evaluateTrimPath(part(), t, 0, 'Sequence').end).toBe(0);
    expect(evaluateTrimPath(part(), t, 30, 'Sequence').end).toBe(1);
  });

  it('falls back to the static field when the channel is unkeyed', () => {
    expect(evaluateTrimPath(part({ trimPathEnd: 0.25 }), track({}), 12, 'Sequence').end).toBe(0.25);
  });
});
