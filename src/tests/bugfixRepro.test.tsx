import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { evaluateTransform } from '../utils/evaluateTransform';
import { syncBroadcastParts } from '../utils/broadcastEngine';
import { SmartNumberInput } from '../components/Inspector/inputs/SmartNumberInput';
import type { CharacterPart, Track } from '../types/animator';

function makePart(id: string, name: string, overrides: Partial<CharacterPart> = {}): CharacterPart {
  return {
    id, name, type: 'custom_box', zIndex: 1, pivot: { x: 0, y: 0 },
    baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    fillColor: '#ff0000', strokeColor: '#101218', strokeWidth: 2,
    ...overrides,
  } as CharacterPart;
}

describe('BUGFIX MILESTONE — repro tests', () => {
  describe('BUG 2 — transform values must NOT leak across selection', () => {
    it('evaluateTransform reads ONLY baseTransform (not part.x/y legacy fields)', () => {
      // Part with NO baseTransform.x/y but legacy part.x/part.y set
      const part = makePart('A', 'Cow', { baseTransform: { x: 15, y: 6, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } } as Partial<CharacterPart>);
      const tracks: Track[] = [];
      const t = evaluateTransform([part], tracks, 'Sequence', 'A', 0);
      expect(t.x).toBe(15);
      expect(t.y).toBe(6);
    });

    it('part B with its own baseTransform yields its own values after A was edited', () => {
      const parts: CharacterPart[] = [
        makePart('A', 'Cow', { baseTransform: { x: 15, y: 6, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } }),
        makePart('B', 'Lion', { baseTransform: { x: 10, y: 2, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 } }),
      ];
      const tracks: Track[] = [];
      const b = evaluateTransform(parts, tracks, 'Sequence', 'B', 0);
      expect(b.x).toBe(10); // NOT 15
      expect(b.y).toBe(2);  // NOT 6
    });
  });

  describe('BUG 2 — SmartNumberInput blur must not leak the old selection value', () => {
    it('blur after a selection change does NOT commit the old editingValue', () => {
      const onChange = vi.fn();
      const { rerender } = render(
        <SmartNumberInput value={6} onChange={onChange} />
      );
      // User focuses the Y input of object A (value 6 typed, focused)
      fireEvent.focus(screen.getByRole('spinbutton'));
      // Selection changes to object B (value 2) — the input stays mounted,
      // the browser re-renders with the new prop BEFORE the blur event.
      rerender(<SmartNumberInput value={2} onChange={onChange} />);
      fireEvent.blur(screen.getByRole('spinbutton'));
      // BUGFIX: blur must NOT write 6 (old editingValue) into B — no commit
      expect(onChange).not.toHaveBeenCalled();
    });

    it('typing still commits per keystroke (handleChange unchanged)', () => {
      const onChange = vi.fn();
      render(<SmartNumberInput value={0} onChange={onChange} />);
      fireEvent.focus(screen.getByRole('spinbutton'));
      fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '6' } });
      expect(onChange).toHaveBeenCalledWith(6);
    });

    it('blur without any typing does not commit either', () => {
      const onChange = vi.fn();
      render(<SmartNumberInput value={2} onChange={onChange} />);
      fireEvent.focus(screen.getByRole('spinbutton'));
      fireEvent.blur(screen.getByRole('spinbutton'));
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('BUG 1 — broadcast sequence switching (syncBroadcastParts)', () => {
    it('new sequence parts start animating in; edit playback state untouched by design', () => {
      const seqA = [makePart('A1', 'Heading'), makePart('A2', 'Subheading')];
      const seqB = [makePart('B1', 'Lion'), makePart('B2', 'The Cow'), makePart('B3', 'Freeform Shape')];

      // Sequence A playing (some parts visible, one animating in)
      const prev = syncBroadcastParts({}, seqA);
      expect(prev['A1']).toEqual({ state: 'animating_in', progress: 0 });
      expect(prev['A2']).toEqual({ state: 'animating_in', progress: 0 });

      // Switch to sequence B: A's state must NOT leak, B's parts animate in
      const next = syncBroadcastParts({ ...prev, A1: { state: 'visible', progress: 1 } }, seqB);
      expect(next['A1']).toBeUndefined(); // dropped — no leak from previous sequence
      expect(next['A2']).toBeUndefined();
      expect(next['B1']).toEqual({ state: 'animating_in', progress: 0 });
      expect(next['B2']).toEqual({ state: 'animating_in', progress: 0 });
      expect(next['B3']).toEqual({ state: 'animating_in', progress: 0 });
    });

    it('parts that keep their id keep their state (no restart for shared parts)', () => {
      const seqA = [makePart('S', 'Shared'), makePart('A', 'Only A')];
      const prev = syncBroadcastParts({}, seqA);
      const mid = { ...prev, S: { state: 'visible', progress: 1 } };
      const next = syncBroadcastParts(mid, [makePart('S', 'Shared')]);
      expect(next['S']).toEqual({ state: 'visible', progress: 1 });
      expect(next['A']).toBeUndefined();
    });

    it('returns the same reference when nothing changed (stable state)', () => {
      const parts = [makePart('A', 'Heading')];
      const prev = syncBroadcastParts({}, parts);
      const again = syncBroadcastParts(prev, parts);
      expect(again).toBe(prev);
    });
  });

  describe('BUG 4 — timeline track names resolve from the part (display)', () => {
    it('track name is derived from part.name, not the generated placeholder', () => {
      const parts: CharacterPart[] = [makePart('part_1', 'The Cow')];
      const track: Track = { id: 'track_part_1', partId: 'part_1', name: 'Track part_1', color: '#3b82f6', keyframes: [], channels: {} };
      const resolved = parts.find((p) => p.id === track.partId)?.name ?? track.name;
      expect(resolved).toBe('The Cow');
    });

    it('falls back to the track name only when the part is missing', () => {
      const track: Track = { id: 'track_x', partId: 'ghost', name: 'Track ghost', color: '#3b82f6', keyframes: [], channels: {} };
      const resolved = [].find((p: CharacterPart) => p.id === track.partId)?.name ?? track.name;
      expect(resolved).toBe('Track ghost');
    });
  });

  describe('BUG 3 — freeform keyframe interpolation', () => {
    function makeFreeform(id: string, name: string, points: [number, number][]): CharacterPart {
      return makePart(id, name, { type: 'custom_freeform', points } as Partial<CharacterPart>);
    }

    it('freeform part interpolates transform keyframes (x: 0 → 120 over 30 frames)', () => {
      const part = makeFreeform('F', 'Freeform Shape', [[0, 0], [100, 0], [100, 100], [0, 100]]);
      const tracks: Track[] = [
        {
          id: 't_F', partId: 'F', name: 'Freeform Shape', color: '#3b82f6',
          keyframes: [
            { id: 'k1', frame: 0, transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }, easing: 'linear' },
            { id: 'k2', frame: 30, transform: { x: 120, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 }, easing: 'linear' },
          ],
        },
      ];
      const mid = evaluateTransform([part], tracks, 'Sequence', 'F', 15);
      expect(mid.x).toBe(60); // linear midpoint
      const end = evaluateTransform([part], tracks, 'Sequence', 'F', 30);
      expect(end.x).toBe(120);
    });

    it('freeform points are NOT keyframed — shape geometry is static (morph unsupported by design)', () => {
      const part = makeFreeform('F', 'Freeform Shape', [[0, 0], [100, 0], [100, 100], [0, 100]]);
      // Even with two keyframes, points stay the same — only transform interpolates
      expect(part.points).toEqual([[0, 0], [100, 0], [100, 100], [0, 100]]);
    });
  });
});
