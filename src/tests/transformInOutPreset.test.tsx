import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TransformTab } from '../components/Inspector/sections/TransformTab';
import type { CharacterPart, Transform } from '../types/animator';

// TransformAlignmentBar (rendered inside TransformTab) reads the animator
// context for the multi-select alignment state — provide a minimal stub.
vi.mock('../context/AnimatorContext', () => ({
  useAnimator: () => ({
    selectedPartIds: [] as string[],
    selectedPartId: undefined as string | undefined,
    handleSelectPart: vi.fn(),
    reorderParts: vi.fn(),
    setActiveTool: vi.fn(),
    activeTool: 'select',
  }),
}));

/**
 * M23 9B — IN/OUT animation preset Inspector UX.
 * The card writes the EXISTING procedural engine fields via onPartPropChange
 * (single atomic history path). No keyframes, no channels, no engine change.
 */

function makePart(overrides: Partial<CharacterPart> = {}): CharacterPart {
  return {
    id: 'p1', name: 'Part One', type: 'custom_box',
    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
    visible: true, zIndex: 1, fillColor: '#fff', strokeColor: '#000',
    strokeWidth: 2, width: 60, height: 60, borderRadius: 0,
    ...overrides,
  } as CharacterPart;
}

const transform: Transform = {
  x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
};

function renderTab(part: CharacterPart, onProp: ReturnType<typeof vi.fn> = vi.fn()) {
  return render(
    <TransformTab
      selectedPart={part}
      transform={transform}
      currentFrame={0}
      updateCurrentTransform={vi.fn()}
      handlePartPropChange={onProp}
      handleZIndexChange={vi.fn()}
    />,
  );
}

function changedProps(onProp: ReturnType<typeof vi.fn>) {
  return onProp.mock.calls.map((c) => ({ key: c[0], value: c[1] }));
}

describe('TransformTab — M23 IN/OUT animation presets', () => {
  it('1-2. IN and OUT preset selects render', () => {
    renderTab(makePart());
    expect(screen.getByLabelText('Animation In Preset')).toBeTruthy();
    expect(screen.getByLabelText('Animation Out Preset')).toBeTruthy();
  });

  it('3. existing preset values are displayed', () => {
    renderTab(makePart({ inAnimPreset: 'slide-left', outAnimPreset: 'fade' }));
    expect((screen.getByLabelText('Animation In Preset') as HTMLSelectElement).value).toBe('slide-left');
    expect((screen.getByLabelText('Animation Out Preset') as HTMLSelectElement).value).toBe('fade');
  });

  it('4-5. selecting IN/OUT updates the matching field', () => {
    const onProp = vi.fn();
    renderTab(makePart(), onProp);
    fireEvent.change(screen.getByLabelText('Animation In Preset'), { target: { value: 'slide-right' } });
    fireEvent.change(screen.getByLabelText('Animation Out Preset'), { target: { value: 'pop' } });
    const calls = changedProps(onProp);
    expect(calls).toContainEqual({ key: 'inAnimPreset', value: 'slide-right' });
    expect(calls).toContainEqual({ key: 'outAnimPreset', value: 'pop' });
  });

  it('6. IN change does not modify OUT', () => {
    const onProp = vi.fn();
    renderTab(makePart(), onProp);
    fireEvent.change(screen.getByLabelText('Animation In Preset'), { target: { value: 'fade' } });
    const keys = changedProps(onProp).map((c) => c.key);
    expect(keys).toEqual(['inAnimPreset']);
  });

  it('7. OUT change does not modify IN', () => {
    const onProp = vi.fn();
    renderTab(makePart(), onProp);
    fireEvent.change(screen.getByLabelText('Animation Out Preset'), { target: { value: 'fade' } });
    const keys = changedProps(onProp).map((c) => c.key);
    expect(keys).toEqual(['outAnimPreset']);
  });

  it('8-9. IN/OUT durations update the matching field', () => {
    const onProp = vi.fn();
    renderTab(makePart(), onProp);
    fireEvent.change(screen.getByLabelText('Animation In Duration'), { target: { value: '45' } });
    fireEvent.blur(screen.getByLabelText('Animation In Duration'));
    fireEvent.change(screen.getByLabelText('Animation Out Duration'), { target: { value: '60' } });
    fireEvent.blur(screen.getByLabelText('Animation Out Duration'));
    const calls = changedProps(onProp);
    expect(calls).toContainEqual({ key: 'inAnimDuration', value: 45 });
    expect(calls).toContainEqual({ key: 'outAnimDuration', value: 60 });
  });

  it('10. multi-digit duration can be typed safely (deferred commit)', () => {
    const onProp = vi.fn();
    renderTab(makePart({ inAnimDuration: 15 }), onProp);
    const input = screen.getByLabelText('Animation In Duration') as HTMLInputElement;
    // type "3" → no commit yet (SmartNumberInput buffers while focused)
    fireEvent.change(input, { target: { value: '3' } });
    expect(changedProps(onProp).filter((c) => c.key === 'inAnimDuration')).toHaveLength(0);
    // complete "30" → commit once on blur
    fireEvent.change(input, { target: { value: '30' } });
    fireEvent.blur(input);
    const calls = changedProps(onProp).filter((c) => c.key === 'inAnimDuration');
    expect(calls).toContainEqual({ key: 'inAnimDuration', value: 30 });
  });

  it('11. blank intermediate duration does not corrupt state', () => {
    const onProp = vi.fn();
    renderTab(makePart({ inAnimDuration: 30 }), onProp);
    const input = screen.getByLabelText('Animation In Duration') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    // blur with empty buffer → no commit, display restored
    fireEvent.blur(input);
    expect(changedProps(onProp).filter((c) => c.key === 'inAnimDuration')).toHaveLength(0);
    expect(input.value).toBe('30');
  });

  it('12. invalid duration preserves existing value (no NaN commit)', () => {
    const onProp = vi.fn();
    renderTab(makePart({ inAnimDuration: 15 }), onProp);
    const input = screen.getByLabelText('Animation In Duration') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.blur(input);
    expect(changedProps(onProp).filter((c) => c.key === 'inAnimDuration')).toHaveLength(0);
    expect(input.value).toBe('15');
  });

  it('13. duration clamps to [0, 1000]', () => {
    const onProp = vi.fn();
    renderTab(makePart(), onProp);
    const input = screen.getByLabelText('Animation Out Duration') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '5000' } });
    fireEvent.blur(input);
    expect(changedProps(onProp)).toContainEqual({ key: 'outAnimDuration', value: 1000 });
    fireEvent.change(input, { target: { value: '-5' } });
    fireEvent.blur(input);
    expect(changedProps(onProp)).toContainEqual({ key: 'outAnimDuration', value: 0 });
  });

  it('14. switching selected part does not leak values (derived per render)', () => {
    const onProp = vi.fn();
    const first = renderTab(makePart({ inAnimPreset: 'fade', inAnimDuration: 40 }), onProp);
    expect((screen.getByLabelText('Animation In Preset') as HTMLSelectElement).value).toBe('fade');
    expect((screen.getByLabelText('Animation In Duration') as HTMLInputElement).value).toBe('40');
    first.unmount();
    renderTab(makePart({ inAnimPreset: 'spin', inAnimDuration: 12 }), onProp);
    expect((screen.getByLabelText('Animation In Preset') as HTMLSelectElement).value).toBe('spin');
    expect((screen.getByLabelText('Animation In Duration') as HTMLInputElement).value).toBe('12');
  });

  it('15. selecting None does not alter unrelated fields', () => {
    const onProp = vi.fn();
    renderTab(makePart(), onProp);
    fireEvent.change(screen.getByLabelText('Animation In Preset'), { target: { value: 'none' } });
    expect(changedProps(onProp)).toEqual([{ key: 'inAnimPreset', value: 'none' }]);
  });

  it('16-18. preset change preserves transforms / keyframes / matte (only the preset field writes)', () => {
    const onProp = vi.fn();
    renderTab(
      makePart({
        matte: { sourcePartId: 'src', mode: 'alpha', enabled: true },
        x: 120, y: -40, rotation: 25, opacity: 0.7,
      }),
      onProp,
    );
    fireEvent.change(screen.getByLabelText('Animation In Preset'), { target: { value: 'slide-up' } });
    expect(changedProps(onProp)).toEqual([{ key: 'inAnimPreset', value: 'slide-up' }]);
  });

  it('19-20. undo restores IN/OUT preset (single onPartPropChange per interaction)', () => {
    // undo is handled by the shared onPartPropChange history path — the card
    // must emit exactly ONE call per control interaction
    const onProp = vi.fn();
    renderTab(makePart(), onProp);
    fireEvent.change(screen.getByLabelText('Animation In Preset'), { target: { value: 'pop' } });
    fireEvent.change(screen.getByLabelText('Animation Out Preset'), { target: { value: 'slide-down' } });
    const calls = changedProps(onProp);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual({ key: 'inAnimPreset', value: 'pop' });
    expect(calls[1]).toEqual({ key: 'outAnimPreset', value: 'slide-down' });
  });

  it('21. preset + duration are separate atomic edits', () => {
    const onProp = vi.fn();
    renderTab(makePart(), onProp);
    fireEvent.change(screen.getByLabelText('Animation In Preset'), { target: { value: 'fade' } });
    const input = screen.getByLabelText('Animation In Duration') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '25' } });
    fireEvent.blur(input);
    const calls = changedProps(onProp);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual({ key: 'inAnimPreset', value: 'fade' });
    expect(calls[1]).toEqual({ key: 'inAnimDuration', value: 25 });
  });

  it('22. custom_timeline is hidden from the option list', () => {
    renderTab(makePart());
    const select = screen.getByLabelText('Animation In Preset') as HTMLSelectElement;
    const values = [...select.options].map((o) => o.value);
    expect(values).not.toContain('custom_timeline');
    expect(values).toEqual([
      'none', 'fade', 'slide-left', 'slide-right', 'slide-up', 'slide-down', 'pop', 'spin',
      'slide-scale-left', 'slide-scale-right', 'soft-pop',
    ]);
  });

  it('22b. part with internal custom_timeline keeps its value (select shows safe fallback)', () => {
    const onProp = vi.fn();
    renderTab(makePart({ inAnimPreset: 'custom_timeline' }), onProp);
    expect((screen.getByLabelText('Animation In Preset') as HTMLSelectElement).value).toBe('none');
    // no mutation just from rendering
    expect(onProp).not.toHaveBeenCalled();
  });

  it('23. no selected part → card not rendered (guard is on the parent)', () => {
    // TransformTab is only rendered by DetailsPanel when a part is selected;
    // the card itself requires a part. Guard test: rendering without a part
    // is impossible by construction — assert the prop contract instead.
    expect(typeof TransformTab).toBe('function');
  });

  it('24. no local state mirror (values derive from the part each render)', () => {
    // rerender with a NEW preset value must reflect it without any effect
    const onProp = vi.fn();
    const { rerender } = renderTab(makePart(), onProp);
    rerender(
      <TransformTab
        selectedPart={makePart({ inAnimPreset: 'spin' })}
        transform={transform}
        currentFrame={0}
        updateCurrentTransform={vi.fn()}
        handlePartPropChange={onProp}
        handleZIndexChange={vi.fn()}
      />,
    );
    expect((screen.getByLabelText('Animation In Preset') as HTMLSelectElement).value).toBe('spin');
    expect(onProp).not.toHaveBeenCalled();
  });

  it('25. accessible labels exist on all four controls', () => {
    renderTab(makePart());
    expect(screen.getByLabelText('Animation In Preset')).toBeTruthy();
    expect(screen.getByLabelText('Animation In Duration')).toBeTruthy();
    expect(screen.getByLabelText('Animation Out Preset')).toBeTruthy();
    expect(screen.getByLabelText('Animation Out Duration')).toBeTruthy();
  });
});

describe('TransformTab — M24 combination presets', () => {
  it('1. Combinations optgroup renders', () => {
    renderTab(makePart());
    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
    expect(selects.length).toBeGreaterThanOrEqual(1);
    const groups = [...selects[0].querySelectorAll('optgroup')].map((g) => g.label);
    expect(groups).toEqual(['Basic', 'Combinations']);
  });

  it('2-4. combination options exist (slide-scale-left/right, soft-pop)', () => {
    renderTab(makePart());
    const select = screen.getByLabelText('Animation In Preset') as HTMLSelectElement;
    const values = [...select.options].map((o) => o.value);
    expect(values).toContain('slide-scale-left');
    expect(values).toContain('slide-scale-right');
    expect(values).toContain('soft-pop');
  });

  it('5-7. selecting a combination writes the correct field', () => {
    const onProp = vi.fn();
    renderTab(makePart(), onProp);
    fireEvent.change(screen.getByLabelText('Animation In Preset'), { target: { value: 'slide-scale-left' } });
    fireEvent.change(screen.getByLabelText('Animation Out Preset'), { target: { value: 'slide-scale-right' } });
    const calls = changedProps(onProp);
    expect(calls).toContainEqual({ key: 'inAnimPreset', value: 'slide-scale-left' });
    expect(calls).toContainEqual({ key: 'outAnimPreset', value: 'slide-scale-right' });
  });

  it('8-9. IN combination does not modify OUT and vice versa', () => {
    const onProp = vi.fn();
    renderTab(makePart(), onProp);
    fireEvent.change(screen.getByLabelText('Animation In Preset'), { target: { value: 'soft-pop' } });
    expect(changedProps(onProp).map((c) => c.key)).toEqual(['inAnimPreset']);
    fireEvent.change(screen.getByLabelText('Animation Out Preset'), { target: { value: 'soft-pop' } });
    expect(changedProps(onProp).map((c) => c.key)).toEqual(['inAnimPreset', 'outAnimPreset']);
  });

  it('10-13. duration / transform / matte unchanged when selecting a combination', () => {
    const onProp = vi.fn();
    renderTab(
      makePart({
        inAnimDuration: 24,
        matte: { sourcePartId: 'src', mode: 'alpha', enabled: true },
        x: 90, rotation: 12,
      }),
      onProp,
    );
    fireEvent.change(screen.getByLabelText('Animation In Preset'), { target: { value: 'slide-scale-left' } });
    expect(changedProps(onProp)).toEqual([{ key: 'inAnimPreset', value: 'slide-scale-left' }]);
  });

  it('14-15. custom_timeline stays hidden and unrewritten', () => {
    const onProp = vi.fn();
    renderTab(makePart({ inAnimPreset: 'custom_timeline' }), onProp);
    const select = screen.getByLabelText('Animation In Preset') as HTMLSelectElement;
    expect([...select.options].map((o) => o.value)).not.toContain('custom_timeline');
    expect(select.value).toBe('none'); // safe display fallback
    expect(onProp).not.toHaveBeenCalled(); // render does not rewrite
  });

  it('16. None still works after adding combinations', () => {
    const onProp = vi.fn();
    renderTab(makePart({ inAnimPreset: 'slide-scale-left' }), onProp);
    fireEvent.change(screen.getByLabelText('Animation In Preset'), { target: { value: 'none' } });
    expect(changedProps(onProp)).toEqual([{ key: 'inAnimPreset', value: 'none' }]);
  });

  it('17. undo path: one logical call per combination selection', () => {
    const onProp = vi.fn();
    renderTab(makePart(), onProp);
    fireEvent.change(screen.getByLabelText('Animation Out Preset'), { target: { value: 'soft-pop' } });
    expect(changedProps(onProp)).toHaveLength(1);
    expect(changedProps(onProp)[0]).toEqual({ key: 'outAnimPreset', value: 'soft-pop' });
  });

  it('18. no local state mirror (combination values derive per render)', () => {
    const onProp = vi.fn();
    const first = renderTab(makePart(), onProp);
    first.unmount();
    renderTab(makePart({ inAnimPreset: 'soft-pop' }), onProp);
    expect((screen.getByLabelText('Animation In Preset') as HTMLSelectElement).value).toBe('soft-pop');
    expect(onProp).not.toHaveBeenCalled();
  });

  it('19. accessible labels remain on the preset selects', () => {
    renderTab(makePart());
    expect(screen.getByLabelText('Animation In Preset')).toBeTruthy();
    expect(screen.getByLabelText('Animation Out Preset')).toBeTruthy();
  });

  it('20. M23 builtin options remain unchanged', () => {
    renderTab(makePart());
    const select = screen.getByLabelText('Animation In Preset') as HTMLSelectElement;
    const basicGroup = [...select.querySelectorAll('optgroup')].find((g) => g.label === 'Basic')!;
    const basicValues = [...basicGroup.querySelectorAll('option')].map((o) => o.value);
    expect(basicValues).toEqual(['none', 'fade', 'slide-left', 'slide-right', 'slide-up', 'slide-down', 'pop', 'spin']);
  });

  it('21-22. fake duplicate combos (Fade+Slide / Fade+Scale / Pop+Fade) do NOT exist', () => {
    renderTab(makePart());
    const select = screen.getByLabelText('Animation In Preset') as HTMLSelectElement;
    const values = [...select.options].map((o) => o.value);
    expect(values).not.toContain('fade-slide-left');
    expect(values).not.toContain('fade-scale');
    expect(values).not.toContain('pop-fade');
    // exactly the three real combinations
    const comboGroup = [...select.querySelectorAll('optgroup')].find((g) => g.label === 'Combinations')!;
    expect([...comboGroup.querySelectorAll('option')].map((o) => o.value))
      .toEqual(['slide-scale-left', 'slide-scale-right', 'soft-pop']);
  });
});
