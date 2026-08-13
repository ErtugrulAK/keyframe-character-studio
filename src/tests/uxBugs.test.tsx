import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SmartNumberInput } from '../components/Inspector/inputs/SmartNumberInput';
import { computeProceduralDelta } from '../utils/proceduralAnimation';
import type { CharacterPart, Track } from '../types/animator';

function makePart(id: string, name: string, overrides: Partial<CharacterPart> = {}): CharacterPart {
  return {
    id, name, type: 'custom_box', zIndex: 1, pivot: { x: 0, y: 0 },
    baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    fillColor: '#ff0000', strokeColor: '#101218', strokeWidth: 2,
    ...overrides,
  } as CharacterPart;
}

describe('BUG 2 — deferred frame input (SmartNumberInput deferCommit)', () => {
  it('typing "4" does NOT commit 4 — buffer stays until Enter/blur', () => {
    const onChange = vi.fn();
    render(<SmartNumberInput value={30} min={0} max={90} step={1} precision={0} deferCommit onChange={onChange} />);
    const input = screen.getByRole('spinbutton');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '4' } });
    expect(onChange).not.toHaveBeenCalled(); // intermediate "4" must not commit
  });

  it('typing "4" then "0" then Enter commits 40', () => {
    const onChange = vi.fn();
    render(<SmartNumberInput value={30} min={0} max={90} step={1} precision={0} deferCommit onChange={onChange} />);
    const input = screen.getByRole('spinbutton');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '4' } });
    fireEvent.change(input, { target: { value: '40' } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(40);
  });

  it('existing 30 → delete → type 40 → blur commits 40', () => {
    const onChange = vi.fn();
    render(<SmartNumberInput value={30} min={0} max={90} step={1} precision={0} deferCommit onChange={onChange} />);
    const input = screen.getByRole('spinbutton');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '' } });
    expect(onChange).not.toHaveBeenCalled(); // empty intermediate — no forced 0
    fireEvent.change(input, { target: { value: '40' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(40);
  });

  it('empty buffer on blur does NOT commit 0 and does not leak to another selection', () => {
    const onChange = vi.fn();
    const { rerender } = render(<SmartNumberInput value={30} min={0} max={90} step={1} precision={0} deferCommit onChange={onChange} />);
    const input = screen.getByRole('spinbutton');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '' } });
    // selection changes to another element (value 12) — same mounted input
    rerender(<SmartNumberInput value={12} min={0} max={90} step={1} precision={0} deferCommit onChange={onChange} />);
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled(); // old buffer must not commit onto the new target
  });

  it('commit clamps to [min, max]', () => {
    const onChange = vi.fn();
    render(<SmartNumberInput value={30} min={0} max={60} step={1} precision={0} deferCommit onChange={onChange} />);
    const input = screen.getByRole('spinbutton');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '200' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(60); // clamped to totalFrames
  });

  it('invalid final value (non-numeric) keeps the current value — no commit', () => {
    const onChange = vi.fn();
    render(<SmartNumberInput value={30} min={0} max={90} step={1} precision={0} deferCommit onChange={onChange} />);
    const input = screen.getByRole('spinbutton');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('blur without any typing does not commit (no change → no event)', () => {
    const onChange = vi.fn();
    render(<SmartNumberInput value={30} min={0} max={90} step={1} precision={0} deferCommit onChange={onChange} />);
    fireEvent.focus(screen.getByRole('spinbutton'));
    fireEvent.blur(screen.getByRole('spinbutton'));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('BUG 4 — broadcast visibility for parts WITHOUT an in/out preset', () => {
  it('animating_in with no preset keeps full opacity (scene never disappears)', () => {
    const part = makePart('p1', 'Heading');
    const tracks: Track[] = [{ id: 't1', partId: 'p1', name: 'Heading', color: '#3b82f6', keyframes: [], channels: {} }];
    const d = computeProceduralDelta(
      part, tracks, 90, 0,
      { appMode: 'broadcast', broadcast: { p1: { state: 'animating_in', progress: 0.5 } }, liveStunts: {} },
      [],
    );
    expect(d.opacityMul).toBe(1); // no preset → fully visible while animating in
  });

  it('hidden state still hides the part (unchanged)', () => {
    const part = makePart('p1', 'Heading');
    const tracks: Track[] = [{ id: 't1', partId: 'p1', name: 'Heading', color: '#3b82f6', keyframes: [], channels: {} }];
    const d = computeProceduralDelta(
      part, tracks, 90, 0,
      { appMode: 'broadcast', broadcast: { p1: { state: 'hidden', progress: 0 } }, liveStunts: {} },
      [],
    );
    expect(d.opacityMul).toBe(0);
  });
});

describe('BUG 6 — ID-based identity across reorder (no index coupling)', () => {
  it('reordering parts keeps part ids, track partIds and keyframe ids intact', () => {
    const parts: CharacterPart[] = [
      makePart('A', 'Heading', { zIndex: 3 }),
      makePart('B', 'Subheading', { zIndex: 2 }),
      makePart('C', 'Lion', { zIndex: 1 }),
    ];
    const tracks: Track[] = [
      { id: 'tA', partId: 'A', name: 'Heading', color: '#3b82f6', keyframes: [{ id: 'kA1', frame: 0, transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }, easing: 'linear' }], channels: {} },
      { id: 'tB', partId: 'B', name: 'Subheading', color: '#3b82f6', keyframes: [{ id: 'kB1', frame: 10, transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }, easing: 'linear' }], channels: {} },
      { id: 'tC', partId: 'C', name: 'Lion', color: '#3b82f6', keyframes: [{ id: 'kC1', frame: 20, transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }, easing: 'linear' }], channels: {} },
    ];

    // Simulate reorderParts (drag C to front): parts reorder + zIndex reindex,
    // tracks follow the part order — but ids/partIds/keyframe ids must survive.
    const reordered = [parts[2], parts[0], parts[1]].map((p, idx) => ({ ...p, zIndex: 3 - idx }));
    const sortedTracks = reordered
      .map((p) => tracks.find((t) => t.partId === p.id))
      .filter(Boolean) as Track[];

    expect(sortedTracks.map((t) => t.partId)).toEqual(['C', 'A', 'B']);
    expect(sortedTracks.map((t) => t.id).sort()).toEqual(['tA', 'tB', 'tC'].sort());
    expect(sortedTracks.find((t) => t.partId === 'A')?.keyframes?.[0]?.id).toBe('kA1'); // keyframes preserved
    expect(sortedTracks.find((t) => t.partId === 'B')?.keyframes?.[0]?.id).toBe('kB1');
    expect(sortedTracks.find((t) => t.partId === 'A')?.keyframes?.[0]?.frame).toBe(0); // frame preserved
  });
});
