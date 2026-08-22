import { describe, it, expect, vi, type Mock } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TransformInOutPresetCard } from '../components/Inspector/sections/transform/TransformInOutPresetCard';
import type { CharacterPart, CustomMotionPreset } from '../types/animator';
import { DEFAULT_INITIAL_PRESETS } from '../context/initialStateData';

/**
 * M25 25C — user-saved custom preset Inspector UI (Custom optgroup,
 * Save Current as Preset dialog, Delete Preset — builtin protection).
 */

function makePart(overrides: Partial<CharacterPart> = {}): CharacterPart {
  return {
    id: 'p1', name: 'Part One', type: 'custom_box',
    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
    visible: true, zIndex: 1, fillColor: '#fff', strokeColor: '#000',
    strokeWidth: 2, width: 60, height: 60, borderRadius: 0,
    inAnimPreset: 'none', outAnimPreset: 'none',
    inAnimDuration: 30, outAnimDuration: 30,
    ...overrides,
  } as CharacterPart;
}

function makeCustom(id: string, name: string, type: 'in' | 'out'): CustomMotionPreset {
  return {
    id, name, type, durationFrames: 20,
    keyframes: [
      { progress: 0, deltaX: 0, deltaY: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
      { progress: 1, deltaX: 0, deltaY: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    ],
  };
}

const CUSTOM_IN = makeCustom('user-in-1', 'My Logo Reveal', 'in');
const CUSTOM_OUT = makeCustom('user-out-1', 'My Exit Slide', 'out');

function renderCard(
  part: CharacterPart,
  customPresets: CustomMotionPreset[] = [],
  onSave: Mock = vi.fn(),
  onUpdate: Mock = vi.fn(),
  onDelete: Mock = vi.fn(),
  onProp: Mock = vi.fn(),
) {
  const utils = render(
    <TransformInOutPresetCard
      selectedPart={part}
      onPartPropChange={onProp}
      customPresets={customPresets}
      onSavePreset={onSave}
      onUpdatePreset={onUpdate}
      onDeletePreset={onDelete}
    />,
  );
  return { ...utils, onSave, onUpdate, onDelete, onProp };
}

function optionValues(label: string): string[] {
  const select = screen.getByLabelText(label) as HTMLSelectElement;
  return [...select.options].map((o) => o.value);
}

describe('M25 25C — custom optgroup', () => {
  it('1. Custom optgroup renders with saved presets', () => {
    renderCard(makePart(), [CUSTOM_IN, CUSTOM_OUT]);
    expect(screen.getAllByRole('group', { name: 'Custom' })).toHaveLength(2); // IN + OUT selects
  });

  it('2. no custom presets → Custom group hidden', () => {
    renderCard(makePart(), []);
    expect(screen.queryAllByRole('group', { name: 'Custom' })).toHaveLength(0);
  });

  it('9+10. option value = preset.id, label = preset.name (IN select filters type in)', () => {
    renderCard(makePart(), [CUSTOM_IN, CUSTOM_OUT]);
    const inSelect = screen.getByLabelText('Animation In Preset') as HTMLSelectElement;
    const inOptions = [...inSelect.options].filter((o) => o.parentElement?.getAttribute('label') === 'Custom');
    expect(inOptions.map((o) => o.value)).toEqual(['user-in-1']);
    expect(inOptions[0].text).toBe('My Logo Reveal');
    // OUT select filters type out
    const outOptions = [...(screen.getByLabelText('Animation Out Preset') as HTMLSelectElement).options]
      .filter((o) => o.parentElement?.getAttribute('label') === 'Custom');
    expect(outOptions.map((o) => o.value)).toEqual(['user-out-1']);
  });

  it('11. IN custom preset can be selected (writes inAnimPreset only)', () => {
    const { onProp } = renderCard(makePart(), [CUSTOM_IN, CUSTOM_OUT]);
    fireEvent.change(screen.getByLabelText('Animation In Preset'), { target: { value: 'user-in-1' } });
    expect(onProp).toHaveBeenCalledWith('inAnimPreset', 'user-in-1');
  });

  it('12+14. OUT custom preset can be selected without touching IN', () => {
    const { onProp } = renderCard(makePart(), [CUSTOM_IN, CUSTOM_OUT]);
    fireEvent.change(screen.getByLabelText('Animation Out Preset'), { target: { value: 'user-out-1' } });
    expect(onProp).toHaveBeenCalledWith('outAnimPreset', 'user-out-1');
    expect(onProp).not.toHaveBeenCalledWith('inAnimPreset', expect.anything());
  });

  it('13. selecting IN custom does not alter OUT', () => {
    const { onProp } = renderCard(makePart(), [CUSTOM_IN, CUSTOM_OUT]);
    fireEvent.change(screen.getByLabelText('Animation In Preset'), { target: { value: 'user-in-1' } });
    expect(onProp).not.toHaveBeenCalledWith('outAnimPreset', expect.anything());
  });

  it('selected custom preset is displayed (not forced to None)', () => {
    renderCard(makePart({ inAnimPreset: 'user-in-1' }), [CUSTOM_IN]);
    expect((screen.getByLabelText('Animation In Preset') as HTMLSelectElement).value).toBe('user-in-1');
  });

  it('26. custom_timeline remains hidden from the option lists', () => {
    renderCard(makePart({ inAnimPreset: 'custom_timeline' }), [CUSTOM_IN]);
    const values = optionValues('Animation In Preset');
    expect(values).not.toContain('custom_timeline');
    // display falls back to the safe None without mutating
    expect((screen.getByLabelText('Animation In Preset') as HTMLSelectElement).value).toBe('none');
  });

  it('30. existing Basic/Combinations options unchanged', () => {
    renderCard(makePart(), []);
    const inValues = optionValues('Animation In Preset');
    expect(inValues).toEqual([
      'none', 'fade', 'slide-left', 'slide-right', 'slide-up', 'slide-down', 'pop', 'spin',
      'slide-scale-left', 'slide-scale-right', 'soft-pop',
    ]);
  });

  it('groups custom presets by optional category without changing ids or order', () => {
    const branded = { ...CUSTOM_IN, category: 'Branding' };
    renderCard(makePart(), [branded]);
    const group = screen.getByRole('group', { name: 'Custom · Branding' });
    const option = group.querySelector('option')!;
    expect(option.value).toBe(CUSTOM_IN.id);
    expect(option.textContent).toBe(CUSTOM_IN.name);
  });
});

describe('M25 25C — save current as preset', () => {
  it('3. save button renders for IN and OUT', () => {
    renderCard(makePart());
    expect(screen.getAllByTitle('Save current animation as a custom preset')).toHaveLength(2);
  });

  it('4. save dialog opens with accessible labels', () => {
    const { onProp } = renderCard(makePart());
    fireEvent.click(screen.getAllByTitle('Save current animation as a custom preset')[0]);
    expect(screen.getByRole('dialog', { name: 'Save Animation Preset' })).toBeTruthy();
    expect(screen.getByLabelText('Preset Name')).toBeTruthy();
    expect(screen.getByText('Save Animation Preset (IN)')).toBeTruthy();
    // opening the dialog must not touch the part
    expect(onProp).not.toHaveBeenCalled();
  });

  it('5+6. empty / whitespace name keeps Save disabled', () => {
    renderCard(makePart());
    fireEvent.click(screen.getAllByTitle('Save current animation as a custom preset')[0]);
    const saveBtn = screen.getByText('Save') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Preset Name'), { target: { value: '   ' } });
    expect(saveBtn.disabled).toBe(true);
  });

  it('7. valid name saves through onSavePreset with the current behavior + duration + type', () => {
    const part = makePart({ inAnimPreset: 'slide-scale-left', inAnimDuration: 18 });
    const { onSave, onProp } = renderCard(part);
    fireEvent.click(screen.getAllByTitle('Save current animation as a custom preset')[0]);
    fireEvent.change(screen.getByLabelText('Preset Name'), { target: { value: '  My Slide  ' } });
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledTimes(1);
    const input = onSave.mock.calls[0][0];
    expect(input.name).toBe('My Slide');           // trimmed
    expect(input.type).toBe('in');
    expect(input.durationFrames).toBe(18);          // 18 preserved (18. saved duration)
    expect(Array.isArray(input.keyframes)).toBe(true);
    expect(input.keyframes.length).toBeGreaterThanOrEqual(2);
    expect(input.keyframes[0].progress).toBe(0);    // sampled keyframes, not the builtin id
    expect(onProp).not.toHaveBeenCalled();          // 15. part untouched on save
  });

  it('saves the trimmed optional category with the existing sampled preset input', () => {
    const { onSave } = renderCard(makePart({ inAnimPreset: 'fade' }));
    fireEvent.click(screen.getAllByTitle('Save current animation as a custom preset')[0]);
    fireEvent.change(screen.getByLabelText('Preset Name'), { target: { value: 'Brand Fade' } });
    fireEvent.change(screen.getByLabelText('Preset Category'), { target: { value: ' Branding ' } });
    fireEvent.click(screen.getByText('Save'));
    expect(onSave.mock.calls[0][0]).toMatchObject({
      name: 'Brand Fade',
      category: ' Branding ',
      type: 'in',
    });
  });

  it('18+19. saved OUT duration and type are preserved', () => {
    const part = makePart({ outAnimPreset: 'soft-pop', outAnimDuration: 24 });
    const { onSave } = renderCard(part);
    fireEvent.click(screen.getAllByTitle('Save current animation as a custom preset')[1]);
    fireEvent.change(screen.getByLabelText('Preset Name'), { target: { value: 'Out Pop' } });
    fireEvent.click(screen.getByText('Save'));
    const input = onSave.mock.calls[0][0];
    expect(input.type).toBe('out');
    expect(input.durationFrames).toBe(24);
  });

  it('20. saved custom preset data is independent from the original builtin (keyframes sampled, no id passthrough)', () => {
    const { onSave } = renderCard(makePart({ inAnimPreset: 'slide-scale-left', inAnimDuration: 30 }));
    fireEvent.click(screen.getAllByTitle('Save current animation as a custom preset')[0]);
    fireEvent.change(screen.getByLabelText('Preset Name'), { target: { value: 'Copy Combo' } });
    fireEvent.click(screen.getByText('Save'));
    const input = onSave.mock.calls[0][0];
    expect(input.keyframes.some((k: { deltaX: number }) => k.deltaX !== 0)).toBe(true);
    // sampled deltas, not a reference to the builtin
    expect(JSON.stringify(input.keyframes)).not.toContain('slide-scale-left');
  });

  it('21. newly saved preset appears immediately (Custom group on rerender)', () => {
    const { rerender, onSave } = renderCard(makePart());
    fireEvent.click(screen.getAllByTitle('Save current animation as a custom preset')[0]);
    fireEvent.change(screen.getByLabelText('Preset Name'), { target: { value: 'Fresh' } });
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledTimes(1);
    // parent updates the collection → rerender with the new preset
    rerender(
      <TransformInOutPresetCard
        selectedPart={makePart({ inAnimPreset: 'fresh-1' })}
        onPartPropChange={vi.fn()}
        customPresets={[makeCustom('fresh-1', 'Fresh', 'in')]}
        onSavePreset={onSave}
        onDeletePreset={vi.fn()}
      />,
    );
    expect(screen.getByRole('group', { name: 'Custom' })).toBeTruthy();
    expect(optionValues('Animation In Preset')).toContain('fresh-1');
  });

  it('16+17. matte / keyframes / transform are preserved on save (part data untouched)', () => {
    const part = makePart({ inAnimPreset: 'pop', inAnimDuration: 30 });
    const { onProp } = renderCard(part);
    fireEvent.click(screen.getAllByTitle('Save current animation as a custom preset')[0]);
    fireEvent.change(screen.getByLabelText('Preset Name'), { target: { value: 'X' } });
    fireEvent.click(screen.getByText('Save'));
    expect(onProp).not.toHaveBeenCalled(); // no part field was written
  });

  it('closes without saving when the source preset changes while the save dialog is open', () => {
    const second = makeCustom('user-in-2', 'Second', 'in');
    const onSave = vi.fn();
    const { rerender } = renderCard(
      makePart({ inAnimPreset: CUSTOM_IN.id }),
      [CUSTOM_IN, second],
      onSave,
    );
    fireEvent.click(screen.getAllByTitle('Save current animation as a custom preset')[0]);
    fireEvent.change(screen.getByLabelText('Preset Name'), { target: { value: 'Must Not Save' } });

    rerender(
      <TransformInOutPresetCard
        selectedPart={makePart({ inAnimPreset: second.id })}
        onPartPropChange={vi.fn()}
        customPresets={[CUSTOM_IN, second]}
        onSavePreset={onSave}
        onDeletePreset={vi.fn()}
      />,
    );

    expect(screen.queryByRole('dialog', { name: 'Save Animation Preset' })).toBeNull();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('closes without saving when the selected part changes while the save dialog is open', () => {
    const onSave = vi.fn();
    const { rerender } = renderCard(
      makePart({ id: 'part-a', inAnimPreset: CUSTOM_IN.id }),
      [CUSTOM_IN],
      onSave,
    );
    fireEvent.click(screen.getAllByTitle('Save current animation as a custom preset')[0]);

    rerender(
      <TransformInOutPresetCard
        selectedPart={makePart({ id: 'part-b', inAnimPreset: CUSTOM_IN.id })}
        onPartPropChange={vi.fn()}
        customPresets={[CUSTOM_IN]}
        onSavePreset={onSave}
        onDeletePreset={vi.fn()}
      />,
    );

    expect(screen.queryByRole('dialog', { name: 'Save Animation Preset' })).toBeNull();
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('Animation Preset System V2 — rename and category editing', () => {
  it('edits the selected user preset without mutating the selected part', () => {
    const onUpdate = vi.fn(() => ({ ...CUSTOM_IN, name: 'Renamed', category: 'Branding' }));
    const { onProp } = renderCard(
      makePart({ inAnimPreset: CUSTOM_IN.id }),
      [CUSTOM_IN],
      vi.fn(),
      onUpdate,
    );
    fireEvent.click(screen.getByLabelText('Edit Animation Preset'));
    expect(screen.getByRole('dialog', { name: 'Edit Animation Preset' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Edit Preset Name'), { target: { value: '  Renamed  ' } });
    fireEvent.change(screen.getByLabelText('Edit Preset Category'), { target: { value: '  Branding  ' } });
    fireEvent.click(screen.getByRole('dialog', { name: 'Edit Animation Preset' }).querySelector('button:last-child')!);
    expect(onUpdate).toHaveBeenCalledWith(CUSTOM_IN.id, {
      name: '  Renamed  ',
      category: '  Branding  ',
    });
    expect(onProp).not.toHaveBeenCalled();
  });

  it('does not expose edit controls for builtins or default presets', () => {
    renderCard(makePart({ inAnimPreset: 'fade' }), [...DEFAULT_INITIAL_PRESETS]);
    expect(screen.queryByLabelText('Edit Animation Preset')).toBeNull();
  });

  it('closes without mutation when the selected preset changes while editing', () => {
    const second = makeCustom('user-in-2', 'Second', 'in');
    const onUpdate = vi.fn();
    const { rerender } = renderCard(
      makePart({ inAnimPreset: CUSTOM_IN.id }),
      [CUSTOM_IN, second],
      vi.fn(),
      onUpdate,
    );
    fireEvent.click(screen.getByLabelText('Edit Animation Preset'));
    fireEvent.change(screen.getByLabelText('Edit Preset Name'), { target: { value: 'Wrong Target' } });

    rerender(
      <TransformInOutPresetCard
        selectedPart={makePart({ inAnimPreset: second.id })}
        onPartPropChange={vi.fn()}
        customPresets={[CUSTOM_IN, second]}
        onSavePreset={vi.fn()}
        onUpdatePreset={onUpdate}
        onDeletePreset={vi.fn()}
      />,
    );

    expect(screen.queryByRole('dialog', { name: 'Edit Animation Preset' })).toBeNull();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('closes without mutation when the selected part changes while editing', () => {
    const onUpdate = vi.fn();
    const { rerender } = renderCard(
      makePart({ id: 'part-a', inAnimPreset: CUSTOM_IN.id }),
      [CUSTOM_IN],
      vi.fn(),
      onUpdate,
    );
    fireEvent.click(screen.getByLabelText('Edit Animation Preset'));

    rerender(
      <TransformInOutPresetCard
        selectedPart={makePart({ id: 'part-b', inAnimPreset: CUSTOM_IN.id })}
        onPartPropChange={vi.fn()}
        customPresets={[CUSTOM_IN]}
        onSavePreset={vi.fn()}
        onUpdatePreset={onUpdate}
        onDeletePreset={vi.fn()}
      />,
    );

    expect(screen.queryByRole('dialog', { name: 'Edit Animation Preset' })).toBeNull();
    expect(onUpdate).not.toHaveBeenCalled();
  });
});

describe('M25 25C — delete custom preset', () => {
  it('23. builtin preset → delete control absent', () => {
    renderCard(makePart({ inAnimPreset: 'slide-left' }));
    expect(screen.queryByLabelText('Delete Animation Preset')).toBeNull();
  });

  it('22. selected custom preset → delete button calls onDeletePreset with its id', () => {
    const { onDelete } = renderCard(makePart({ inAnimPreset: 'user-in-1' }), [CUSTOM_IN]);
    const btn = screen.getByLabelText('Delete Animation Preset');
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(onDelete).toHaveBeenCalledWith('user-in-1');
  });

  it('24. deleting one custom preset leaves the other intact (per-slot controls)', () => {
    const part = makePart({ inAnimPreset: 'user-in-1', outAnimPreset: 'user-out-1' });
    const { onDelete } = renderCard(part, [CUSTOM_IN, CUSTOM_OUT]);
    fireEvent.click(screen.getAllByLabelText('Delete Animation Preset')[0]);
    expect(onDelete).toHaveBeenCalledWith('user-in-1');
    expect(onDelete).not.toHaveBeenCalledWith('user-out-1');
  });

  it('25. deleted preset referenced by a part → safe fallback display (None), part data untouched', () => {
    const { rerender, onProp } = renderCard(makePart({ inAnimPreset: 'user-in-1' }), [CUSTOM_IN]);
    // simulate deletion: collection shrinks (rerender), part still references the id
    rerender(
      <TransformInOutPresetCard
        selectedPart={makePart({ inAnimPreset: 'user-in-1' })}
        onPartPropChange={onProp}
        customPresets={[]}
        onSavePreset={vi.fn()}
        onDeletePreset={vi.fn()}
      />,
    );
    expect((screen.getByLabelText('Animation In Preset') as HTMLSelectElement).value).toBe('none');
    expect(onProp).not.toHaveBeenCalled(); // fallback is display-only
  });
});

describe('M25 25E-fix — DEFAULT_INITIAL_PRESETS excluded from Custom group', () => {
  it('Custom optgroup shows only user-created presets, never default seeds', () => {
    const userIn = makeCustom('user-x', 'My Own', 'in');
    renderCard(makePart(), [...DEFAULT_INITIAL_PRESETS, userIn]);
    const inCustom = [...(screen.getByLabelText('Animation In Preset') as HTMLSelectElement).options]
      .filter((o) => o.parentElement?.getAttribute('label') === 'Custom');
    expect(inCustom.map((o) => o.value)).toEqual(['user-x']);
    // no default id ('preset_1' …) leaks into Custom
    expect(inCustom.map((o) => o.value)).not.toContain(DEFAULT_INITIAL_PRESETS[0].id);
  });

  it('default seed preset selected on a part → NO Delete control, display-only fallback', () => {
    renderCard(makePart({ inAnimPreset: DEFAULT_INITIAL_PRESETS[0].id }), [...DEFAULT_INITIAL_PRESETS]);
    expect(screen.queryByLabelText('Delete Animation Preset')).toBeNull();
    // defaults are not user-facing options — the select shows the safe
    // fallback (None) without mutating the part (M23 custom_timeline pattern)
    expect((screen.getByLabelText('Animation In Preset') as HTMLSelectElement).value).toBe('none');
  });

  it('user preset still gets the Delete control (contract intact)', () => {
    renderCard(makePart({ inAnimPreset: 'user-in-1' }), [CUSTOM_IN]);
    expect(screen.getByLabelText('Delete Animation Preset')).toBeTruthy();
  });

  it('IN/OUT type filtering still correct with defaults present', () => {
    const userIn = makeCustom('user-x', 'My Own', 'in');
    const userOut = makeCustom('user-y', 'My Out', 'out');
    renderCard(makePart(), [...DEFAULT_INITIAL_PRESETS, userIn, userOut]);
    const inCustom = [...(screen.getByLabelText('Animation In Preset') as HTMLSelectElement).options]
      .filter((o) => o.parentElement?.getAttribute('label') === 'Custom');
    const outCustom = [...(screen.getByLabelText('Animation Out Preset') as HTMLSelectElement).options]
      .filter((o) => o.parentElement?.getAttribute('label') === 'Custom');
    expect(inCustom.map((o) => o.value)).toEqual(['user-x']);
    expect(outCustom.map((o) => o.value)).toEqual(['user-y']);
  });
});

describe('M25 25C — accessibility', () => {
  it('27. meaningful labels exist', () => {
    renderCard(makePart({ inAnimPreset: 'user-in-1' }), [CUSTOM_IN, CUSTOM_OUT]);
    // aria/title labels on the preset controls
    expect(screen.getByLabelText('Animation In Preset')).toBeTruthy();
    expect(screen.getByLabelText('Animation Out Preset')).toBeTruthy();
    expect(screen.getByLabelText('Delete Animation Preset')).toBeTruthy();
    expect(screen.getAllByRole('group', { name: 'Custom' })).toHaveLength(2);
  });
});
