/**
 * K1 — per-property animation (stopwatch) controls, user-approved contract D2.
 *
 * States: not animated / animated without a key at the playhead / animated with
 * a key at the playhead. Activation writes the FIRST key at the current
 * playhead using the property's evaluated current value and never duplicates
 * an existing key. Deactivation asks first, names the affected property,
 * cancels with zero mutation, and on confirm performs ONE atomic history
 * operation: the channel's keys are removed and the evaluated value at the
 * playhead survives as the static property value. Undo restores keys and the
 * original static value together.
 *
 * Every scenario drives the real timeline UI through the real provider.
 */
import React, { useEffect } from 'react';
import { render, act, fireEvent, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AnimatorProvider, type AnimatorContextType } from '../context/AnimatorContext';
import { useAnimator } from '../context/useAnimator';
import { SequencerTimeline } from '../components/Timeline/SequencerTimeline';
import type { Track, TrackChannel } from '../types/animator';
import { worldToContainerLocal } from '../utils/containerMath';

const Consumer = ({ onCtx }: { onCtx: (ctx: AnimatorContextType) => void }) => {
  const ctx = useAnimator();
  useEffect(() => { onCtx(ctx); });
  return null;
};

let live: AnimatorContextType | null = null;
const ctx = (): AnimatorContextType => {
  if (!live) throw new Error('provider context not captured yet');
  return live;
};

const trackRow = (container: HTMLElement, name: string): HTMLElement => {
  const row = Array.from(container.querySelectorAll('.ue-track-group'))
    .find((group) => group.querySelector('.ue-track-name')?.textContent?.trim() === name);
  if (!row) throw new Error(`no timeline track row for ${name}`);
  return row as HTMLElement;
};

const stopwatch = (container: HTMLElement, name: string, channel: TrackChannel): HTMLButtonElement => {
  const button = trackRow(container, name).querySelector(`button.ue-channel-stopwatch[data-property-channel="${channel}"]`);
  if (!button) throw new Error(`no stopwatch for ${channel} on ${name}`);
  return button as HTMLButtonElement;
};

const expand = (container: HTMLElement, name: string) => {
  const button = trackRow(container, name).querySelector('button.ue-expand-btn');
  if (!button) throw new Error(`no expand button for ${name}`);
  fireEvent.click(button);
};

const keysOf = (partId: string, channel: TrackChannel) =>
  (ctx().tracks.find((t) => t.partId === partId)?.channels?.[channel] ?? []);

const addRect = (name: string, x: number, y: number): string => {
  act(() => { ctx().addCustomPart('custom_rect', name); });
  const part = ctx().characterParts.find((candidate) => candidate.name === name);
  if (!part) throw new Error(`rectangle ${name} was not created`);
  act(() => { ctx().setSelectedPartId(part.id); });
  act(() => { ctx().updateCurrentTransform({ x, y }, part.id); });
  return part.id;
};

const renderEditor = () => render(
  <AnimatorProvider>
    <Consumer onCtx={(c) => { live = c; }} />
    <SequencerTimeline />
  </AnimatorProvider>,
);

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16));
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});

afterEach(() => {
  cleanup();
  live = null;
  vi.unstubAllGlobals();
});

describe('K1 — stopwatch states and activation (D2)', () => {
  it('renders an unanimated stopwatch for every channel row with a discoverable name', () => {
    const { container } = renderEditor();
    addRect('Box', 120, 40);
    expand(container, 'Box');
    const button = stopwatch(container, 'Box', 'x');
    expect(button.getAttribute('data-animation-state')).toBe('off');
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(`${button.getAttribute('aria-label')}`.toLowerCase()).toContain('animate');
  });

  it('activating at the playhead writes the evaluated current value as the first key', () => {
    const { container } = renderEditor();
    const partId = addRect('Box', 120, 40);
    act(() => { ctx().setCurrentFrame(24); });
    expand(container, 'Box');
    fireEvent.click(stopwatch(container, 'Box', 'x'));
    const keys = keysOf(partId, 'x');
    expect(keys).toHaveLength(1);
    expect(keys[0].frame).toBe(24);
    expect(keys[0].value).toBeCloseTo(120, 9);
    expect(stopwatch(container, 'Box', 'x').getAttribute('data-animation-state')).toBe('keyed');
    // Siblings were NOT armed.
    expect(keysOf(partId, 'y')).toHaveLength(0);
  });

  it('arm is template-scoped and the state reads the active sequence only', () => {
    const { container } = renderEditor();
    const partId = addRect('Box', 10, 10);
    expand(container, 'Box');
    act(() => {
      ctx().setTracks((prev) => prev.map((t) => (t.partId === partId
        ? { ...t, channels: { ...t.channels, x: [{ id: 'other-seq-key', frame: 10, value: 55, easing: 'linear', templateId: 'Other' }] } }
        : t)) as Track[]);
    });
    expect(stopwatch(container, 'Box', 'x').getAttribute('data-animation-state')).toBe('off');
    fireEvent.click(stopwatch(container, 'Box', 'x'));
    const keys = keysOf(partId, 'x');
    expect(keys.find((k) => k.id === 'other-seq-key')).toBeDefined(); // preserved
    expect(keys.filter((k) => (k.templateId || 'Sequence') === 'Sequence')).toHaveLength(1);
  });

  it('animated with no key at the playhead is a distinct third state', () => {
    const { container } = renderEditor();
    addRect('Box', 30, 30);
    act(() => { ctx().setCurrentFrame(24); });
    expand(container, 'Box');
    fireEvent.click(stopwatch(container, 'Box', 'x'));
    act(() => { ctx().setCurrentFrame(10); });
    expect(stopwatch(container, 'Box', 'x').getAttribute('data-animation-state')).toBe('animated');
    expect(stopwatch(container, 'Box', 'x').getAttribute('aria-pressed')).toBe('true');
  });

  it('activating twice at the same frame never duplicates the key', () => {
    const { container } = renderEditor();
    const partId = addRect('Box', 12, 5);
    act(() => { ctx().setCurrentFrame(12); });
    expand(container, 'Box');
    fireEvent.click(stopwatch(container, 'Box', 'x'));
    fireEvent.click(stopwatch(container, 'Box', 'x')); // already keyed here -> disarm asked, no second key
    expect(keysOf(partId, 'x')).toHaveLength(1);
  });
});

describe('K1 — deactivation asks, cancels clean, confirms atomic (D2)', () => {
  const armThenMove = (partId: string) => {
    act(() => {
      ctx().setTracks((prev) => prev.map((t) => (t.partId === partId
        ? {
            ...t,
            channels: {
              ...t.channels,
              x: [
                { id: 'k0', frame: 0, value: 0, easing: 'linear' },
                { id: 'k48', frame: 48, value: 100, easing: 'linear' },
              ],
            },
          }
        : t)) as Track[]);
      ctx().setCurrentFrame(24);
    });
  };

  it('deactivation asks BEFORE touching anything and names the property', () => {
    const { container } = renderEditor();
    const partId = addRect('Box', 7, 7);
    armThenMove(partId);
    expand(container, 'Box');
    fireEvent.click(stopwatch(container, 'Box', 'x'));
    expect(keysOf(partId, 'x')).toHaveLength(2);
    const dialog = document.querySelector('.confirmation-dialog');
    expect(dialog).not.toBeNull();
    expect(`${dialog?.textContent}`.toLowerCase()).toContain('location x');
    expect(`${dialog?.textContent}`.toLowerCase()).toContain('keyframe');
  });

  it('cancel mutates nothing (not even a history entry)', () => {
    const { container } = renderEditor();
    const partId = addRect('Box', 7, 7);
    armThenMove(partId);
    expand(container, 'Box');
    fireEvent.click(stopwatch(container, 'Box', 'x'));
    const tracksBefore = ctx().tracks;
    fireEvent.click(document.querySelector('.confirmation-dialog-cancel') as HTMLElement);
    expect(ctx().tracks).toBe(tracksBefore); // identity: zero state update
    expect(document.querySelector('.confirmation-dialog')).toBeNull();
  });

  it('confirm removes the keys, keeps the evaluated value as static, restores with ONE undo', () => {
    const { container } = renderEditor();
    const partId = addRect('Box', 7, 7);
    armThenMove(partId);
    const baseBefore = ctx().characterParts.find((p) => p.id === partId)?.baseTransform.x;
    expand(container, 'Box');
    fireEvent.click(stopwatch(container, 'Box', 'x'));
    fireEvent.click(document.querySelector('.confirmation-dialog-confirm') as HTMLElement);
    expect(keysOf(partId, 'x')).toHaveLength(0);
    expect(ctx().characterParts.find((p) => p.id === partId)?.baseTransform.x).toBeCloseTo(50, 9);
    // one undo brings back BOTH the keys and the original static value
    act(() => { ctx().undo(); });
    expect(keysOf(partId, 'x')).toHaveLength(2);
    expect(ctx().characterParts.find((p) => p.id === partId)?.baseTransform.x).toBe(baseBefore);
    act(() => { ctx().redo(); });
    expect(keysOf(partId, 'x')).toHaveLength(0);
    expect(ctx().characterParts.find((p) => p.id === partId)?.baseTransform.x).toBeCloseTo(50, 9);
  });

  it('stopwatch is keyboard reachable and Enter activates the same flow', async () => {
    const user = userEvent.setup();
    const { container } = renderEditor();
    const partId = addRect('Box', 3, 4);
    expand(container, 'Box');
    const button = stopwatch(container, 'Box', 'x');
    button.focus();
    await user.keyboard('{Enter}');
    expect(keysOf(partId, 'x')).toHaveLength(1);
  });
});

describe('K1 — other property families', () => {
  it('trim path arms from the part authored field value', () => {
    const { container } = renderEditor();
    const partId = addRect('Box', 1, 1);
    act(() => {
      ctx().setCharacterParts((prev) => prev.map((p) => (p.id === partId ? { ...p, trimPathEnabled: true, trimPathEnd: 0.75 } : p)));
      ctx().setCurrentFrame(6);
    });
    expand(container, 'Box');
    fireEvent.click(stopwatch(container, 'Box', 'trimPathEnd'));
    const keys = keysOf(partId, 'trimPathEnd');
    expect(keys).toHaveLength(1);
    expect(keys[0].frame).toBe(6);
    expect(keys[0].value).toBeCloseTo(0.75, 9);
  });

  it('disarming a trim path channel writes the evaluated value back to the part field', () => {
    const { container } = renderEditor();
    const partId = addRect('Box', 1, 1);
    act(() => {
      ctx().setCharacterParts((prev) => prev.map((p) => (p.id === partId ? { ...p, trimPathEnabled: true, trimPathEnd: 0.2 } : p)));
      ctx().setTracks((prev) => prev.map((t) => (t.partId === partId
        ? { ...t, channels: { ...t.channels, trimPathEnd: [
          { id: 'e0', frame: 0, value: 0, easing: 'linear' },
          { id: 'e48', frame: 48, value: 1, easing: 'linear' },
        ] } }
        : t)) as Track[]);
      ctx().setCurrentFrame(12);
    });
    expand(container, 'Box');
    fireEvent.click(stopwatch(container, 'Box', 'trimPathEnd'));
    fireEvent.click(document.querySelector('.confirmation-dialog-confirm') as HTMLElement);
    expect(keysOf(partId, 'trimPathEnd')).toHaveLength(0);
    expect(ctx().characterParts.find((p) => p.id === partId)?.trimPathEnd).toBeCloseTo(0.25, 9);
  });

  it('StrictMode double effects leave exactly one initial key', () => {
    const { container } = render(
      <React.StrictMode>
        <AnimatorProvider>
          <Consumer onCtx={(c) => { live = c; }} />
          <SequencerTimeline />
        </AnimatorProvider>
      </React.StrictMode>,
    );
    const partId = addRect('Box', 9, 1);
    expand(container, 'Box');
    fireEvent.click(stopwatch(container, 'Box', 'x'));
    expect(keysOf(partId, 'x')).toHaveLength(1);
  });

  it('arm at the last frame stays inside the timeline', () => {
    const { container } = renderEditor();
    const partId = addRect('Box', 4, 4);
    act(() => { ctx().setCurrentFrame(ctx().totalFrames - 1); });
    expand(container, 'Box');
    fireEvent.click(stopwatch(container, 'Box', 'x'));
    expect(keysOf(partId, 'x')[0].frame).toBe(ctx().totalFrames - 1);
  });
});

describe('K1 — arm captures the authored-local pose under a transformed parent (P0-57)', () => {
  it('arming at an evaluated animated pose stores the container-local value and keeps the world pose', () => {
    const { container } = renderEditor();
    const parentId = addRect('Parent', 200, 150);
    const childId = addRect('Child', 380, 300);
    act(() => {
      ctx().updateCurrentTransform({ rotation: 30, scaleX: 2, scaleY: 0.5 }, parentId);
      ctx().setCharacterParts((prev) => prev.map((p) => (p.id === childId ? { ...p, parentId } : p)));
    });
    const worldBefore = ctx().getComputedTransform(childId, ctx().currentFrame);
    const parentWorld = ctx().getComputedTransform(parentId, ctx().currentFrame);
    // The capture must be observable as non-trivial: world differs from local here.
    const captured = worldToContainerLocal(worldBefore, parentWorld);
    expect(captured.x).not.toBeCloseTo(worldBefore.x, 4);

    expand(container, 'Child');
    fireEvent.click(stopwatch(container, 'Child', 'x'));

    const keys = keysOf(childId, 'x');
    expect(keys).toHaveLength(1);
    expect(keys[0].value).toBeCloseTo(captured.x, 9);

    // Arming must not move the child: the evaluated world pose is intact.
    const after = ctx().getComputedTransform(childId, ctx().currentFrame);
    (['x', 'y', 'rotation', 'scaleX', 'scaleY'] as const).forEach((property) => {
      expect(after[property], property).toBeCloseTo(worldBefore[property], 9);
    });
  });
});
