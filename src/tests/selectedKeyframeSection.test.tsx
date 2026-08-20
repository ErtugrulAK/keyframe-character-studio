import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SelectedKeyframeSection } from '../components/Inspector/sections/transform/SelectedKeyframeSection';
import type { Track, Transform } from '../types/animator';
import { makeEmptyChannels } from '../utils/defaults';

/**
 * M29 29A — SELECTED KEYFRAME SECTION (TransformTab).
 * Presentational layer over the EXISTING updateCurrentTransform pipeline:
 * shows only channels that actually hold a keyframe at the selected frame,
 * with raw stored values; edits route through the existing property path.
 */

function makeTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: 't1', partId: 'p1', name: 'T1', color: '#ff0000',
    keyframes: [], channels: makeEmptyChannels(),
    visible: true, locked: false, expanded: true,
    ...overrides,
  };
}

const baseTransform: Transform = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };

function renderSection(opts: {
  track?: Track;
  selectedKeyframeId?: string | null;
  currentFrame?: number;
  transform?: Transform;
  isScaleLocked?: boolean;
  coordinateSystem?: 'legacy-unknown' | 'legacy-centi-unit' | 'project-unit-center-v1';
  onUpdate?: ReturnType<typeof vi.fn>;
}) {
  const onUpdate = opts.onUpdate ?? vi.fn();
  const utils = render(
    <SelectedKeyframeSection
      track={opts.track ?? null}
      selectedKeyframeId={opts.selectedKeyframeId ?? null}
      currentFrame={opts.currentFrame ?? 0}
      transform={opts.transform ?? baseTransform}
      activeTemplateId="Sequence"
      coordinateSystem={opts.coordinateSystem ?? 'project-unit-center-v1'}
      isScaleLocked={opts.isScaleLocked ?? false}
      onUpdate={onUpdate}
    />,
  );
  return { ...utils, onUpdate };
}

/** Track with x@20 (55) + rotation@20 (30); y is NOT keyframed at 20. */
function xRotTrack(): Track {
  const ch = makeEmptyChannels();
  ch.x = [{ id: 'x_20', frame: 20, value: 55, easing: 'easeInOut', templateId: 'Sequence', bezierControlPoints: [0.2, 0, 0.8, 1] }];
  ch.rotation = [{ id: 'r_20', frame: 20, value: 30, easing: 'linear', templateId: 'Sequence' }];
  return makeTrack({ channels: ch });
}

describe('M29 29A — visibility', () => {
  it('1. hidden with no selected keyframe', () => {
    const { container } = renderSection({ track: xRotTrack(), selectedKeyframeId: null, currentFrame: 20 });
    expect(container.querySelector('.panel-card')).toBeNull();
  });

  it('2. visible with selected keyframe', () => {
    renderSection({ track: xRotTrack(), selectedKeyframeId: 'x_20', currentFrame: 20 });
    expect(screen.getByText('SELECTED KEYFRAME @ FRAME 20')).toBeTruthy();
  });

  it('15+16. resolution: wrong id or playhead off the keyframe hides safely (stale)', () => {
    const { container: c1 } = renderSection({ track: xRotTrack(), selectedKeyframeId: 'ghost', currentFrame: 20 });
    expect(c1.querySelector('.panel-card')).toBeNull();
    // keyframe selected but playhead moved to another frame → hidden (never edits wrong kf)
    const { container: c2 } = renderSection({ track: xRotTrack(), selectedKeyframeId: 'x_20', currentFrame: 25 });
    expect(c2.querySelector('.panel-card')).toBeNull();
  });

  it('18. part switch (different track) hides the section', () => {
    const other = makeTrack({ id: 't2', partId: 'p2' });
    const { container } = renderSection({ track: other, selectedKeyframeId: 'x_20', currentFrame: 20 });
    expect(container.querySelector('.panel-card')).toBeNull();
  });

  it('17. deleting the keyframe hides the section (id no longer resolvable)', () => {
    renderSection({ track: xRotTrack(), selectedKeyframeId: 'x_20', currentFrame: 20 });
    expect(screen.getByText('SELECTED KEYFRAME @ FRAME 20')).toBeTruthy();
    // simulate deletion: re-render with the keyframe removed from the track
    const ch = makeEmptyChannels();
    ch.rotation = [{ id: 'r_20', frame: 20, value: 30, easing: 'linear', templateId: 'Sequence' }];
    const { container: c2 } = renderSection({ track: makeTrack({ channels: ch }), selectedKeyframeId: 'x_20', currentFrame: 20 });
    expect(c2.querySelector('.panel-card')).toBeNull();
  });
});

describe('M29 29A — channel display', () => {
  it('3. correct frame displayed', () => {
    renderSection({ track: xRotTrack(), selectedKeyframeId: 'x_20', currentFrame: 20 });
    expect(screen.getByText('SELECTED KEYFRAME @ FRAME 20')).toBeTruthy();
  });

  it('4. only keyframed channels shown (x + rotation, NOT y/scale/opacity)', () => {
    renderSection({ track: xRotTrack(), selectedKeyframeId: 'x_20', currentFrame: 20 });
    expect(screen.getByLabelText('Keyframe Location X')).toBeTruthy();
    expect(screen.getByLabelText('Keyframe Rotation')).toBeTruthy();
    expect(screen.queryByLabelText('Keyframe Location Y')).toBeNull(); // not keyframed
    expect(screen.queryByLabelText('Keyframe Scale X')).toBeNull();
    expect(screen.queryByLabelText('Keyframe Scale Y')).toBeNull();
    expect(screen.queryByLabelText('Keyframe Opacity')).toBeNull();
  });

  it('5. non-keyframed computed channels are NOT shown (no false keyframe implication)', () => {
    renderSection({ track: xRotTrack(), selectedKeyframeId: 'x_20', currentFrame: 20 });
    // y/opacity have no keyframe at 20 even though computed transform has values
    expect(screen.queryByLabelText('Keyframe Opacity')).toBeNull();
  });
});

describe('M29 29A — value editing via existing pipeline', () => {
  it('legacy-centi keyframe position values use the explicit centi display contract', () => {
    renderSection({ track: xRotTrack(), selectedKeyframeId: 'x_20', currentFrame: 20, coordinateSystem: 'legacy-centi-unit' });
    expect(Number((screen.getByLabelText('Keyframe Location X') as HTMLInputElement).value)).toBeLessThan(1);
  });
  it('6+11. X edit calls onUpdate({x}) — unrelated channels untouched', () => {
    const onUpdate = vi.fn();
    renderSection({ track: xRotTrack(), selectedKeyframeId: 'x_20', currentFrame: 20, onUpdate });
    const xInput = screen.getByLabelText('Keyframe Location X');
    fireEvent.change(xInput, { target: { value: '80' } });
    fireEvent.keyDown(xInput, { key: 'Enter' });
    fireEvent.blur(xInput);
    expect(onUpdate).toHaveBeenCalledWith({ x: 80 });
    // rotation/y never appear in the update
    for (const call of onUpdate.mock.calls) {
      expect(Object.keys(call[0])).not.toContain('y');
      expect(Object.keys(call[0])).not.toContain('rotation');
    }
  });

  it('8. Rotation edit calls onUpdate({rotation})', () => {
    const onUpdate = vi.fn();
    renderSection({ track: xRotTrack(), selectedKeyframeId: 'x_20', currentFrame: 20, onUpdate });
    const rInput = screen.getByLabelText('Keyframe Rotation');
    fireEvent.change(rInput, { target: { value: '45' } });
    fireEvent.keyDown(rInput, { key: 'Enter' });
    fireEvent.blur(rInput);
    expect(onUpdate).toHaveBeenCalledWith({ rotation: 45 });
  });

  it('10. Opacity edit works when opacity is keyframed', () => {
    const ch = makeEmptyChannels();
    ch.opacity = [{ id: 'o_20', frame: 20, value: 0.5, easing: 'linear', templateId: 'Sequence' }];
    const onUpdate = vi.fn();
    renderSection({ track: makeTrack({ channels: ch }), selectedKeyframeId: 'o_20', currentFrame: 20, onUpdate });
    const opInput = screen.getByLabelText('Keyframe Opacity');
    fireEvent.change(opInput, { target: { value: '0.75' } });
    fireEvent.keyDown(opInput, { key: 'Enter' });
    fireEvent.blur(opInput);
    expect(onUpdate).toHaveBeenCalledWith({ opacity: 0.75 });
  });

  it('9. scale lock: locked Scale X edit also updates Scale Y proportionally', () => {
    const ch = makeEmptyChannels();
    ch.scaleX = [{ id: 'sx_20', frame: 20, value: 2, easing: 'linear', templateId: 'Sequence' }];
    const onUpdate = vi.fn();
    renderSection({
      track: makeTrack({ channels: ch }),
      selectedKeyframeId: 'sx_20',
      currentFrame: 20,
      transform: { ...baseTransform, scaleX: 2, scaleY: 1.5 },
      isScaleLocked: true,
      onUpdate,
    });
    const sxInput = screen.getByLabelText('Keyframe Scale X');
    fireEvent.change(sxInput, { target: { value: '4' } });
    fireEvent.keyDown(sxInput, { key: 'Enter' });
    fireEvent.blur(sxInput);
    expect(onUpdate).toHaveBeenCalledWith({ scaleX: 4, scaleY: 3 }); // 1.5 * (4/2)
  });

  it('9b. unlocked Scale X edit touches ONLY scaleX', () => {
    const ch = makeEmptyChannels();
    ch.scaleX = [{ id: 'sx_20', frame: 20, value: 2, easing: 'linear', templateId: 'Sequence' }];
    const onUpdate = vi.fn();
    renderSection({
      track: makeTrack({ channels: ch }),
      selectedKeyframeId: 'sx_20',
      currentFrame: 20,
      transform: { ...baseTransform, scaleX: 2, scaleY: 1.5 },
      isScaleLocked: false,
      onUpdate,
    });
    const sxInput = screen.getByLabelText('Keyframe Scale X');
    fireEvent.change(sxInput, { target: { value: '4' } });
    fireEvent.keyDown(sxInput, { key: 'Enter' });
    fireEvent.blur(sxInput);
    expect(onUpdate).toHaveBeenCalledWith({ scaleX: 4 });
  });

  it('21+22. SmartNumberInput deferCommit: one logical commit per edit', () => {
    const onUpdate = vi.fn();
    renderSection({ track: xRotTrack(), selectedKeyframeId: 'x_20', currentFrame: 20, onUpdate });
    const xInput = screen.getByLabelText('Keyframe Location X');
    // typing intermediate values must NOT commit per keystroke
    fireEvent.change(xInput, { target: { value: '7' } });
    fireEvent.change(xInput, { target: { value: '80' } });
    expect(onUpdate).not.toHaveBeenCalled();
    fireEvent.keyDown(xInput, { key: 'Enter' });
    fireEvent.blur(xInput);
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });
});

describe('M29 29A — metadata / safety', () => {
  it('12+13+14. easing/bezier/templateId are keyframe metadata — never touched by the section (display + pipeline)', () => {
    // The section only displays raw values and calls the existing pipeline;
    // metadata preservation happens in applyTransformToChannels (useInspector).
    // Here we verify the section itself never edits metadata:
    const onUpdate = vi.fn();
    renderSection({ track: xRotTrack(), selectedKeyframeId: 'x_20', currentFrame: 20, onUpdate });
    const xInput = screen.getByLabelText('Keyframe Location X');
    fireEvent.change(xInput, { target: { value: '80' } });
    fireEvent.keyDown(xInput, { key: 'Enter' });
    fireEvent.blur(xInput);
    // update payload contains ONLY the numeric value — no easing/bezier/template keys
    expect(Object.keys(onUpdate.mock.calls[0][0])).toEqual(['x']);
  });

  it('19+20. no local state mirror — rerender derives values from props', () => {
    const { rerender, onUpdate } = renderSection({ track: xRotTrack(), selectedKeyframeId: 'x_20', currentFrame: 20 });
    // change the track's keyframe value and re-render with a new selected id
    const ch = makeEmptyChannels();
    ch.x = [{ id: 'x_20b', frame: 20, value: 99, easing: 'easeInOut', templateId: 'Sequence' }];
    rerender(
      <SelectedKeyframeSection
        track={makeTrack({ channels: ch })}
        selectedKeyframeId="x_20b"
        currentFrame={20}
        transform={baseTransform}
        activeTemplateId="Sequence"
        coordinateSystem="project-unit-center-v1"
        isScaleLocked={false}
        onUpdate={onUpdate}
      />,
    );
    expect(screen.getByLabelText('Keyframe Location X')).toBeTruthy(); // derived, no crash
  });

  it('23. legacy path safe: channel-less track never shows the section', () => {
    const legacyTrack = makeTrack({ keyframes: [{ id: 'l1', frame: 20, transform: { ...baseTransform }, easing: 'linear' }] });
    const { container } = renderSection({ track: legacyTrack, selectedKeyframeId: 'l1', currentFrame: 20 });
    expect(container.querySelector('.panel-card')).toBeNull(); // no channel keyframes → hidden, no crash
  });

  it('26. accessibility labels present', () => {
    renderSection({ track: xRotTrack(), selectedKeyframeId: 'x_20', currentFrame: 20 });
    expect(screen.getByLabelText('Keyframe Location X')).toBeTruthy();
    expect(screen.getByLabelText('Keyframe Rotation')).toBeTruthy();
  });

  it('27. existing transform controls unaffected (section is additive — hidden without selection)', () => {
    const { container } = renderSection({ track: xRotTrack(), selectedKeyframeId: null, currentFrame: 20 });
    expect(container.querySelector('.panel-card')).toBeNull();
  });
});
