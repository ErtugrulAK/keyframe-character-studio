/**
 * #57 (E1) — the segment-scope temporal preset at the provider/history seam.
 *
 * `temporalPresetSegment.test.ts` pins the pure mutator contract and the
 * branch note at `545d04d` records a live browser pass, but nothing durable
 * pinned the ONE WRITE = ONE UNDO ENTRY claim at the context level. These
 * tests drive the real seam — `applyTemporalHandlesToSegment` → `useTimeline`
 * → `setTracks` → `useHistory` — through a live `AnimatorProvider`: one undo
 * restores both endpoints and the evaluated behavior, one redo restores both
 * in one step, the undo ladder below the entry reaches the prior real action,
 * and the HOLD/last-key refusals consume no undo action at all.
 *
 * Regression added after the implementation; no product change is in scope.
 */
import React, { useEffect } from 'react';
import { render, act, cleanup } from '@testing-library/react';
import { AnimatorProvider, type AnimatorContextType } from '../context/AnimatorContext';
import { useAnimator } from '../context/useAnimator';
import { interpolateChannel } from '../utils/defaults';
import { PRESET_BEZIERS, type EasingPreset } from '../components/Inspector/easingPresets';
import type { PropertyKeyframe, Track } from '../types/animator';

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

/** The pair is read from the shared preset table, exactly as the panel maps it. */
const presetPoints = (label: string): EasingPreset['points'] => {
  const preset = PRESET_BEZIERS.find((candidate) => candidate.label === label);
  if (!preset) throw new Error(`preset ${label} missing from the shared table`);
  return preset.points;
};
const [X1, Y1, X2, Y2] = presetPoints('Ease In Out');
const OUT = { x: X1, y: Y1 };
const IN = { x: X2, y: Y2 };

const KEYS: PropertyKeyframe[] = [
  { id: 'ka', frame: 0, value: 0, easing: 'linear' },
  { id: 'kb', frame: 100, value: 100, easing: 'linear' },
  { id: 'kc', frame: 200, value: 0, easing: 'linear' },
];

const renderProvider = () => render(
  <AnimatorProvider>
    <Consumer onCtx={(c) => { live = c; }} />
  </AnimatorProvider>,
);

/** A PRIOR DISTINCT HISTORY ACTION: create the part, then one discrete transform edit. */
const addBox = (): string => {
  act(() => { ctx().addCustomPart('custom_rect', 'Box'); });
  const part = ctx().characterParts.find((candidate) => candidate.name === 'Box');
  if (!part) throw new Error('rectangle Box was not created');
  act(() => { ctx().setSelectedPartId(part.id); });
  act(() => { ctx().updateCurrentTransform({ x: 40, y: 0 }, part.id); });
  return part.id;
};

const seedChannel = (partId: string, keys: PropertyKeyframe[]) => {
  act(() => {
    ctx().setTracks((prev) => prev.map((track) => (track.partId === partId
      ? { ...track, channels: { ...track.channels, x: keys.map((key) => ({ ...key })) } } as Track
      : track)));
  });
};

const trackIdOf = (partId: string): string => {
  const track = ctx().tracks.find((candidate) => candidate.partId === partId);
  if (!track) throw new Error(`no track for ${partId}`);
  return track.id;
};

const keysOf = (partId: string) => ctx().tracks.find((t) => t.partId === partId)?.channels?.x ?? [];
const keyById = (partId: string, id: string) => keysOf(partId).find((key) => key.id === id);
/** Evaluated through the one channel authority, on live provider state. */
const valueAt = (partId: string, frame: number) => interpolateChannel(keysOf(partId), frame, 0);

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

describe('#57 — segment preset application is ONE undo entry at the provider seam', () => {
  it('one undo restores both endpoints and the evaluated behavior; one redo restores both', () => {
    renderProvider();
    const partId = addBox();
    seedChannel(partId, KEYS);
    expect(valueAt(partId, 25)).toBeCloseTo(25, 9);  // linear before the preset
    expect(valueAt(partId, 150)).toBeCloseTo(50, 9); // the neighbor segment B→C

    act(() => { ctx().applyTemporalHandlesToSegment(trackIdOf(partId), 'x', 'ka', OUT, IN); });

    // The provider carries the COMPLETE pair and nothing else changed.
    expect(keyById(partId, 'ka')?.bezierOut).toEqual(OUT);
    expect(keyById(partId, 'kb')?.bezierIn).toEqual(IN);
    expect(keyById(partId, 'kb')?.bezierOut).toBeUndefined();
    expect(keyById(partId, 'kc')?.bezierIn).toBeUndefined();
    expect(valueAt(partId, 25)).toBeCloseTo(12.916193, 4); // independent anchor
    expect(valueAt(partId, 150)).toBeCloseTo(50, 9);       // neighbor retained

    act(() => { ctx().undo(); });
    expect(keyById(partId, 'ka')?.bezierOut).toBeUndefined();
    expect(keyById(partId, 'kb')?.bezierIn).toBeUndefined();
    expect(valueAt(partId, 25)).toBeCloseTo(25, 9); // evaluated behavior restored too

    act(() => { ctx().redo(); });
    expect(keyById(partId, 'ka')?.bezierOut).toEqual(OUT);
    expect(keyById(partId, 'kb')?.bezierIn).toEqual(IN);
    expect(valueAt(partId, 25)).toBeCloseTo(12.916193, 4);

    // The apply occupied exactly ONE entry: below it sits the seed, below the
    // seed the prior transform action survives.
    act(() => { ctx().undo(); });
    act(() => { ctx().undo(); });
    expect(keysOf(partId)).toHaveLength(0); // the seed is its own entry
    expect(ctx().characterParts.find((part) => part.id === partId)?.baseTransform.x).toBeCloseTo(40, 9);
  });
});

describe('#57 — refusals consume no undo action', () => {
  it('HOLD start key and last key of scope refuse, and ONE undo still reverts the prior REAL action', () => {
    renderProvider();
    const partId = addBox();
    const heldKeys = KEYS.map((key) => (key.id === 'kb' ? { ...key, easing: 'hold' as const } : key));
    seedChannel(partId, heldKeys);

    // The prior REAL action for this scenario: a valid application on A→B.
    act(() => { ctx().applyTemporalHandlesToSegment(trackIdOf(partId), 'x', 'ka', OUT, IN); });
    expect(valueAt(partId, 25)).toBeCloseTo(12.916193, 4);

    act(() => { ctx().applyTemporalHandlesToSegment(trackIdOf(partId), 'x', 'kb', OUT, IN); }); // HOLD start
    act(() => { ctx().applyTemporalHandlesToSegment(trackIdOf(partId), 'x', 'kc', OUT, IN); }); // last key of scope
    expect(keyById(partId, 'ka')?.bezierOut).toEqual(OUT); // the valid write stands
    expect(keyById(partId, 'kb')?.bezierOut).toBeUndefined();
    expect(keyById(partId, 'kc')?.bezierIn).toBeUndefined();

    // A phantom entry from either refusal would swallow this undo step.
    act(() => { ctx().undo(); });
    expect(keyById(partId, 'ka')?.bezierOut).toBeUndefined();
    expect(valueAt(partId, 25)).toBeCloseTo(25, 9);
  });
});
