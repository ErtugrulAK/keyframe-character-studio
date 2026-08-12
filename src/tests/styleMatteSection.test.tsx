/**
 * M11 Step 3 — StyleMatteSection editor UI behavior tests.
 *
 * Behavior-level: source eligibility (self excluded, unsupported excluded),
 * source selection builds the correct PartMatte, None/Remove clear it,
 * enabled toggle preserves the relationship, missing source degrades
 * gracefully.
 */
import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { StyleMatteSection } from '../components/Inspector/sections/style/StyleMatteSection';
import type { CharacterPart } from '../types/animator';

function makePart(id: string, type: string, name: string, matte?: CharacterPart['matte']): CharacterPart {
  return {
    id, type, name, zIndex: 1,
    baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    fillColor: '#ff0000', strokeColor: '#101218',
    matte,
  } as CharacterPart;
}

function renderMatte(target: CharacterPart, allParts: CharacterPart[]) {
  const onPartPropChange = vi.fn();
  const utils = render(
    <StyleMatteSection selectedPart={target} characterParts={allParts} onPartPropChange={onPartPropChange} />
  );
  return { onPartPropChange, ...utils };
}

const STAR = makePart('src', 'custom_star', 'Star Part');
const BOX = makePart('tgt', 'custom_box', 'Box Part');
const FREEFORM = makePart('free', 'custom_freeform', 'Free Part');
const TEXT = makePart('txt', 'custom_text', 'Text Part');

describe('StyleMatteSection — track matte editor UI', () => {
  it('starts with None when no matte is set', () => {
    const { container } = renderMatte(BOX, [STAR, BOX, FREEFORM, TEXT]);
    const select = container.querySelector('select') as HTMLSelectElement;
    expect(select.value).toBe('');
    expect(screen.getByText('None')).toBeTruthy();
  });

  it('lists eligible sources (static shapes + M15 freeform + M18 text); excludes self and image/video', () => {
    const { container } = renderMatte(BOX, [STAR, BOX, FREEFORM, TEXT]);
    const options = Array.from(container.querySelectorAll('option')).map((o) => o.textContent);
    expect(options).toContain('Star Part');           // shape source eligible
    expect(options).toContain('Free Part');           // M15: freeform eligible
    expect(options).toContain('Text Part');           // M18: text eligible (mask content element)
    expect(options).not.toContain('Box Part');        // self excluded
  });

  it('selecting a source creates the canonical PartMatte', () => {
    const { onPartPropChange, container } = renderMatte(BOX, [STAR, BOX]);
    const select = container.querySelector('select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'src' } });
    expect(onPartPropChange).toHaveBeenCalledWith('matte', {
      sourcePartId: 'src',
      mode: 'clip',
      enabled: true,
    });
  });

  it('selecting None removes the matte entirely (undefined)', () => {
    const target = makePart('tgt', 'custom_box', 'Box Part', { sourcePartId: 'src', mode: 'clip', enabled: true });
    const { onPartPropChange, container } = renderMatte(target, [STAR, target]);
    const select = container.querySelector('select') as HTMLSelectElement;
    expect(select.value).toBe('src');
    fireEvent.change(select, { target: { value: '' } });
    expect(onPartPropChange).toHaveBeenCalledWith('matte', undefined);
  });

  it('enabled toggle flips enabled without losing the source relationship', () => {
    const target = makePart('tgt', 'custom_box', 'Box Part', { sourcePartId: 'src', mode: 'clip', enabled: true });
    const { onPartPropChange, container } = renderMatte(target, [STAR, target]);
    const checkbox = container.querySelector('input[aria-label="Enabled"]') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);

    fireEvent.click(checkbox);
    expect(onPartPropChange).toHaveBeenCalledWith('matte', { sourcePartId: 'src', mode: 'clip', enabled: false });

    // re-render with disabled matte → checkbox unchecked, relationship intact
    const disabled = makePart('tgt', 'custom_box', 'Box Part', { sourcePartId: 'src', mode: 'clip', enabled: false });
    const { onPartPropChange: cb2, container: c2 } = renderMatte(disabled, [STAR, disabled]);
    expect((c2.querySelector('input[aria-label="Enabled"]') as HTMLInputElement).checked).toBe(false);
    fireEvent.click(c2.querySelector('input[aria-label="Enabled"]') as HTMLInputElement);
    expect(cb2).toHaveBeenCalledWith('matte', { sourcePartId: 'src', mode: 'clip', enabled: true });
  });

  it('Remove clears the matte to undefined', () => {
    const target = makePart('tgt', 'custom_box', 'Box Part', { sourcePartId: 'src', mode: 'clip', enabled: true });
    const { onPartPropChange } = renderMatte(target, [STAR, target]);
    fireEvent.click(screen.getByText('Remove'));
    expect(onPartPropChange).toHaveBeenCalledWith('matte', undefined);
  });

  it('missing source shows a warning and selects None (no auto-delete)', () => {
    const target = makePart('tgt', 'custom_box', 'Box Part', { sourcePartId: 'ghost', mode: 'clip' });
    const { container, onPartPropChange } = renderMatte(target, [STAR, target]);
    expect(screen.getByText(/Missing source/)).toBeTruthy();
    const select = container.querySelector('select') as HTMLSelectElement;
    expect(select.value).toBe('');
    // No automatic mutation — onPartPropChange was never called by render
    expect(onPartPropChange).not.toHaveBeenCalled();
  });

  // ─── M13 Step 2D: mode + inverted controls ──────────────────────────

  it('M13: mode select offers Clip / Alpha / Luminance', () => {
    const target = makePart('tgt', 'custom_box', 'Box Part', { sourcePartId: 'src', mode: 'clip' });
    const { container } = renderMatte(target, [STAR, target]);
    const selects = container.querySelectorAll('select');
    // selects[0] = source, selects[1] = mode
    const options = Array.from(selects[1].querySelectorAll('option')).map((o) => o.textContent);
    expect(options).toEqual(['Clip', 'Alpha', 'Luminance']);
  });

  it('M13: changing mode Clip → Alpha preserves sourcePartId/enabled/inverted', () => {
    const target = makePart('tgt', 'custom_box', 'Box Part', {
      sourcePartId: 'src', mode: 'clip', inverted: true, enabled: true,
    });
    const { onPartPropChange, container } = renderMatte(target, [STAR, target]);
    const modeSelect = container.querySelectorAll('select')[1] as HTMLSelectElement;
    fireEvent.change(modeSelect, { target: { value: 'alpha' } });
    expect(onPartPropChange).toHaveBeenCalledWith('matte', {
      sourcePartId: 'src', mode: 'alpha', inverted: true, enabled: true,
    });
  });

  it('M13: changing mode Alpha → Luminance preserves all fields', () => {
    const target = makePart('tgt', 'custom_box', 'Box Part', {
      sourcePartId: 'src', mode: 'alpha', enabled: false,
    });
    const { onPartPropChange, container } = renderMatte(target, [STAR, target]);
    const modeSelect = container.querySelectorAll('select')[1] as HTMLSelectElement;
    fireEvent.change(modeSelect, { target: { value: 'luminance' } });
    expect(onPartPropChange).toHaveBeenCalledWith('matte', {
      sourcePartId: 'src', mode: 'luminance', enabled: false,
    });
  });

  it('M13: inverted OFF → ON', () => {
    const target = makePart('tgt', 'custom_box', 'Box Part', { sourcePartId: 'src', mode: 'clip' });
    const { onPartPropChange, container } = renderMatte(target, [STAR, target]);
    const invertedCheckbox = container.querySelector('input[aria-label="Inverted"]') as HTMLInputElement;
    expect(invertedCheckbox.checked).toBe(false);
    fireEvent.click(invertedCheckbox);
    expect(onPartPropChange).toHaveBeenCalledWith('matte', { sourcePartId: 'src', mode: 'clip', inverted: true });
  });

  it('M13: inverted ON → OFF', () => {
    const target = makePart('tgt', 'custom_box', 'Box Part', {
      sourcePartId: 'src', mode: 'alpha', inverted: true,
    });
    const { onPartPropChange, container } = renderMatte(target, [STAR, target]);
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    expect((checkboxes[0] as HTMLInputElement).checked).toBe(true);
    fireEvent.click(checkboxes[0]);
    expect(onPartPropChange).toHaveBeenCalledWith('matte', {
      sourcePartId: 'src', mode: 'alpha', inverted: false,
    });
  });

  it('M13: legacy matte (no mode/inverted) displays Clip + OFF', () => {
    const legacy = makePart('tgt', 'custom_box', 'Box Part', { sourcePartId: 'src' });
    const { container } = renderMatte(legacy, [STAR, legacy]);
    const modeSelect = container.querySelectorAll('select')[1] as HTMLSelectElement;
    expect(modeSelect.value).toBe('clip'); // resolveMatteMode fallback
    expect((container.querySelector('input[aria-label="Inverted"]') as HTMLInputElement).checked).toBe(false); // inverted OFF
    expect((container.querySelector('input[aria-label="Enabled"]') as HTMLInputElement).checked).toBe(true);  // enabled (undefined → active)
  });
});

describe('StyleMatteSection — M14 feather control', () => {
  const ALPHA = (feather?: number) =>
    makePart('tgt', 'custom_box', 'Box Part', { sourcePartId: 'src', mode: 'alpha', feather });

  const getSlider = (container: HTMLElement) =>
    container.querySelector('input[type="range"][aria-label="Feather"]') as HTMLInputElement;

  it('feather control visible with a valid matte + valid source', () => {
    const { container } = renderMatte(ALPHA(), [STAR, ALPHA()]);
    expect(getSlider(container)).toBeTruthy();
    expect(screen.getByText('FEATHER')).toBeTruthy();
  });

  it('default: feather undefined → slider 0, "0px" shown', () => {
    const { container } = renderMatte(ALPHA(), [STAR, ALPHA()]);
    expect(getSlider(container).value).toBe('0');
    expect(screen.getByText('0px')).toBeTruthy();
  });

  it('existing value: feather 12 → slider 12, "12px" shown', () => {
    const { container } = renderMatte(ALPHA(12), [STAR, ALPHA(12)]);
    expect(getSlider(container).value).toBe('12');
    expect(screen.getByText('12px')).toBeTruthy();
  });

  it('change 12 → 20 updates matte.feather', () => {
    const { onPartPropChange, container } = renderMatte(ALPHA(12), [STAR, ALPHA(12)]);
    fireEvent.change(getSlider(container), { target: { value: '20' } });
    expect(onPartPropChange).toHaveBeenCalledWith('matte', {
      sourcePartId: 'src', mode: 'alpha', feather: 20,
    });
  });

  it('field preservation: feather change keeps sourcePartId/mode/inverted/enabled', () => {
    const target = makePart('tgt', 'custom_box', 'Box Part', {
      sourcePartId: 'src', mode: 'luminance', inverted: true, enabled: true, feather: 12,
    });
    const { onPartPropChange, container } = renderMatte(target, [STAR, target]);
    fireEvent.change(getSlider(container), { target: { value: '20' } });
    expect(onPartPropChange).toHaveBeenCalledWith('matte', {
      sourcePartId: 'src', mode: 'luminance', inverted: true, enabled: true, feather: 20,
    });
  });

  it('malformed values normalize to 0 (negative / NaN / Infinity)', () => {
    for (const bad of [-5, NaN, Infinity]) {
      const target = makePart('tgt', 'custom_box', 'Box Part', {
        sourcePartId: 'src', mode: 'alpha', feather: bad,
      });
      const { container, unmount } = renderMatte(target, [STAR, target]);
      expect(getSlider(container).value).toBe('0');
      expect(screen.getByText('0px')).toBeTruthy();
      unmount();
    }
  });

  it('slider range: min 0, max 100, step 1', () => {
    const { container } = renderMatte(ALPHA(50), [STAR, ALPHA(50)]);
    const slider = getSlider(container);
    expect(slider.min).toBe('0');
    expect(slider.max).toBe('100');
    expect(slider.step).toBe('1');
  });

  it('no matte → no feather control', () => {
    const { container } = renderMatte(makePart('tgt', 'custom_box', 'Box Part'), [STAR]);
    expect(getSlider(container)).toBeNull();
  });

  it('missing source → no feather control', () => {
    const target = makePart('tgt', 'custom_box', 'Box Part', { sourcePartId: 'ghost', mode: 'alpha', feather: 8 });
    const { container } = renderMatte(target, [STAR, target]);
    expect(getSlider(container)).toBeNull();
  });

  it('M14: clip mode → feather control DISABLED (feather only on mask modes)', () => {
    const target = makePart('tgt', 'custom_box', 'Box Part', { sourcePartId: 'src', mode: 'clip', feather: 12 });
    const { container } = renderMatte(target, [STAR, target]);
    const slider = getSlider(container);
    expect(slider).toBeTruthy();
    expect(slider.disabled).toBe(true);
    // value still shown so the user sees their preserved setting
    expect(screen.getByText('12px')).toBeTruthy();
  });

  it('M14: alpha mode → feather control enabled', () => {
    const { container } = renderMatte(ALPHA(8), [STAR, ALPHA(8)]);
    expect(getSlider(container).disabled).toBe(false);
  });
});

describe('StyleMatteSection — M15 freeform source UI', () => {
  const FREEFORM_PART = makePart('ff', 'custom_freeform', 'Freeform Part');
  const IMAGE = makePart('img', 'custom_image', 'Image Part');
  const VIDEO = makePart('vid', 'custom_video', 'Video Part');
  const target = (matte?: CharacterPart['matte']) => makePart('tgt', 'custom_box', 'Box Part', matte);

  const options = (container: HTMLElement) =>
    Array.from(container.querySelectorAll('option')).map((o) => o.textContent);

  it('freeform source is visible in the list', () => {
    const { container } = renderMatte(target(), [FREEFORM_PART, target()]);
    expect(options(container)).toContain('Freeform Part');
  });

  it('freeform source is selectable → sourcePartId becomes the freeform id', () => {
    const { onPartPropChange, container } = renderMatte(target(), [FREEFORM_PART, target()]);
    const select = container.querySelector('select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'ff' } });
    expect(onPartPropChange).toHaveBeenCalledWith('matte', {
      sourcePartId: 'ff', mode: 'clip', enabled: true,
    });
  });

  it('image and video are NOT eligible sources', () => {
    const { container } = renderMatte(target(), [IMAGE, VIDEO, STAR, target()]);
    const list = options(container);
    expect(list).not.toContain('Image Part');
    expect(list).not.toContain('Video Part');
    expect(list).toContain('Star Part');
  });

  it('self reference still excluded (freeform target cannot select itself)', () => {
    const selfFreeform = makePart('self', 'custom_freeform', 'Self Freeform');
    const { container } = renderMatte(selfFreeform, [selfFreeform, STAR]);
    expect(options(container)).not.toContain('Self Freeform');
  });

  it('M15 field preservation: source swap keeps mode/inverted/enabled/feather', () => {
    const withMatte = target({ sourcePartId: 'star', mode: 'alpha', inverted: true, enabled: true, feather: 12 });
    const { onPartPropChange, container } = renderMatte(withMatte, [FREEFORM_PART, STAR, withMatte]);
    const select = container.querySelector('select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'ff' } });
    expect(onPartPropChange).toHaveBeenCalledWith('matte', {
      sourcePartId: 'ff', mode: 'alpha', inverted: true, enabled: true, feather: 12,
    });
  });
});

describe('StyleMatteSection — M16 strength slider', () => {
  const star = () => makePart('src', 'custom_star', 'Star Part');
  const target = (matte?: CharacterPart['matte']) => makePart('tgt', 'custom_box', 'Box Part', matte);
  const strength = (container: HTMLElement) =>
    container.querySelector('input[aria-label="Strength"]') as HTMLInputElement;
  const strengthLabel = (container: HTMLElement) =>
    Array.from(container.querySelectorAll('.form-label span')).map((s) => s.textContent);

  it('strength slider is visible when a matte exists (alpha mode)', () => {
    const { container } = renderMatte(target({ sourcePartId: 'src', mode: 'alpha' }), [star(), target({ sourcePartId: 'src', mode: 'alpha' })]);
    expect(strength(container)).toBeTruthy();
    expect(strength(container).min).toBe('0');
    expect(strength(container).max).toBe('100');
    expect(strength(container).step).toBe('1');
  });

  it('undefined strength → shows 100% (legacy full strength)', () => {
    const { container } = renderMatte(target({ sourcePartId: 'src', mode: 'alpha' }), [star(), target({ sourcePartId: 'src', mode: 'alpha' })]);
    expect(strength(container).value).toBe('100');
    expect(strengthLabel(container)).toContain('100%');
  });

  it('strength 0 → shows 0% (valid, NOT 100)', () => {
    const { container } = renderMatte(target({ sourcePartId: 'src', mode: 'alpha', strength: 0 }), [star(), target({ sourcePartId: 'src', mode: 'alpha', strength: 0 })]);
    expect(strength(container).value).toBe('0');
    expect(strengthLabel(container)).toContain('0%');
  });

  it('strength 0.5 → shows 50%', () => {
    const { container } = renderMatte(target({ sourcePartId: 'src', mode: 'alpha', strength: 0.5 }), [star(), target({ sourcePartId: 'src', mode: 'alpha', strength: 0.5 })]);
    expect(strength(container).value).toBe('50');
    expect(strengthLabel(container)).toContain('50%');
  });

  it('strength 1 → shows 100%', () => {
    const { container } = renderMatte(target({ sourcePartId: 'src', mode: 'alpha', strength: 1 }), [star(), target({ sourcePartId: 'src', mode: 'alpha', strength: 1 })]);
    expect(strength(container).value).toBe('100');
  });

  it('slider change → writes strength as 0-1 number (50 → 0.5)', () => {
    const { onPartPropChange, container } = renderMatte(target({ sourcePartId: 'src', mode: 'alpha' }), [star(), target({ sourcePartId: 'src', mode: 'alpha' })]);
    fireEvent.change(strength(container), { target: { value: '50' } });
    expect(onPartPropChange).toHaveBeenCalledWith('matte', {
      sourcePartId: 'src', mode: 'alpha', strength: 0.5,
    });
  });

  it('field preservation: only strength changes; source/mode/inverted/enabled/feather kept', () => {
    const full = target({ sourcePartId: 'src', mode: 'alpha', inverted: true, enabled: true, feather: 12, strength: 0.8 });
    const { onPartPropChange, container } = renderMatte(full, [star(), full]);
    fireEvent.change(strength(container), { target: { value: '50' } });
    expect(onPartPropChange).toHaveBeenCalledWith('matte', {
      sourcePartId: 'src', mode: 'alpha', inverted: true, enabled: true, feather: 12, strength: 0.5,
    });
  });

  it('clip mode → strength slider disabled', () => {
    const { container } = renderMatte(target({ sourcePartId: 'src', mode: 'clip', strength: 0.5 }), [star(), target({ sourcePartId: 'src', mode: 'clip', strength: 0.5 })]);
    expect(strength(container).disabled).toBe(true);
  });

  it('alpha / luminance / inverted alpha / inverted luminance → strength enabled', () => {
    for (const matte of [
      { sourcePartId: 'src', mode: 'alpha' },
      { sourcePartId: 'src', mode: 'luminance' },
      { sourcePartId: 'src', mode: 'alpha', inverted: true },
      { sourcePartId: 'src', mode: 'luminance', inverted: true },
    ] as CharacterPart['matte'][]) {
      const { container } = renderMatte(target(matte), [star(), target(matte)]);
      expect(strength(container).disabled, JSON.stringify(matte)).toBe(false);
    }
  });

  it('missing source → strength control hidden (no crash)', () => {
    const { container } = renderMatte(target({ sourcePartId: 'ghost', mode: 'alpha', strength: 0.5 }), [star()]);
    expect(strength(container)).toBeNull();
  });

  it('malformed strength (NaN / negative / >1 / Infinity) → shows 100%', () => {
    for (const bad of [NaN, -1, 2, Infinity, -Infinity] as number[]) {
      const { container } = renderMatte(target({ sourcePartId: 'src', mode: 'alpha', strength: bad }), [star(), target({ sourcePartId: 'src', mode: 'alpha', strength: bad })]);
      expect(strength(container).value, String(bad)).toBe('100');
    }
  });

  it('no matte → no strength slider', () => {
    const { container } = renderMatte(target(), [star(), target()]);
    expect(strength(container)).toBeNull();
  });
});

describe('StyleMatteSection — M17 gradient controls', () => {
  const star = () => makePart('src', 'custom_star', 'Star Part');
  const freeform = () => makePart('ff', 'custom_freeform', 'Free Part');
  const target = (matte?: CharacterPart['matte']) => makePart('tgt', 'custom_box', 'Box Part', matte);
  const gradientToggle = (container: HTMLElement) =>
    container.querySelector('input[aria-label="Gradient"]') as HTMLInputElement;
  const angle = (container: HTMLElement) =>
    container.querySelector('input[aria-label="Gradient angle"]') as HTMLInputElement;
  const angleLabel = (container: HTMLElement) =>
    Array.from(container.querySelectorAll('.form-label span')).map((s) => s.textContent);

  const render = (matte: CharacterPart['matte'], parts: CharacterPart[] = [star()]) =>
    renderMatte(target(matte), [...parts, target(matte)]);

  it('gradient controls visible for alpha matte', () => {
    const { container } = render({ sourcePartId: 'src', mode: 'alpha', gradient: { angle: 45 } });
    expect(gradientToggle(container)).toBeTruthy();
    expect(angle(container)).toBeTruthy();
  });

  it('gradient controls visible for luminance / inverted alpha / inverted luminance', () => {
    for (const m of [
      { sourcePartId: 'src', mode: 'luminance', gradient: { angle: 0 } },
      { sourcePartId: 'src', mode: 'alpha', inverted: true, gradient: { angle: 0 } },
      { sourcePartId: 'src', mode: 'luminance', inverted: true, gradient: { angle: 0 } },
    ] as CharacterPart['matte'][]) {
      const { container } = render(m);
      expect(gradientToggle(container), JSON.stringify(m)).toBeTruthy();
      expect(gradientToggle(container).disabled).toBe(false);
    }
  });

  it('gradient controls work with a freeform matte source', () => {
    const { container } = render({ sourcePartId: 'ff', mode: 'alpha', gradient: { angle: 90 } }, [freeform()]);
    expect(gradientToggle(container).checked).toBe(true);
    expect(angle(container).value).toBe('90');
  });

  it('clip mode → gradient toggle + angle disabled', () => {
    const { container } = render({ sourcePartId: 'src', mode: 'clip', gradient: { angle: 45 } });
    expect(gradientToggle(container).disabled).toBe(true);
    expect(angle(container).disabled).toBe(true);
  });

  it('gradient absent → toggle OFF, no angle slider', () => {
    const { container } = render({ sourcePartId: 'src', mode: 'alpha' });
    expect(gradientToggle(container).checked).toBe(false);
    expect(angle(container)).toBeNull();
  });

  it('gradient present → toggle ON + existing angle displayed', () => {
    const { container } = render({ sourcePartId: 'src', mode: 'alpha', gradient: { angle: 45 } });
    expect(gradientToggle(container).checked).toBe(true);
    expect(angle(container).value).toBe('45');
    expect(angleLabel(container)).toContain('45°');
  });

  it('angle range 0-360, step 1', () => {
    const { container } = render({ sourcePartId: 'src', mode: 'alpha', gradient: { angle: 0 } });
    expect(angle(container).min).toBe('0');
    expect(angle(container).max).toBe('360');
    expect(angle(container).step).toBe('1');
  });

  it('changing angle writes the NORMALIZED value (360 → 0, 45 → 45, 180 → 180)', () => {
    const { onPartPropChange, container } = render({ sourcePartId: 'src', mode: 'alpha', gradient: { angle: 0 } });
    // NOTE: the range input clamps to [0, 360] before the change event, so
    // out-of-range values (370) never reach the handler — the pure
    // normalizeGradientAngle tests in matte.test.ts cover those. Here we
    // verify the slider path: 360 (≡ 0) normalizes on write.
    fireEvent.change(angle(container), { target: { value: '360' } });
    expect(onPartPropChange).toHaveBeenLastCalledWith('matte', {
      sourcePartId: 'src', mode: 'alpha', gradient: { angle: 0 },
    });
    fireEvent.change(angle(container), { target: { value: '45' } });
    expect(onPartPropChange).toHaveBeenLastCalledWith('matte', {
      sourcePartId: 'src', mode: 'alpha', gradient: { angle: 45 },
    });
    fireEvent.change(angle(container), { target: { value: '180' } });
    expect(onPartPropChange).toHaveBeenLastCalledWith('matte', {
      sourcePartId: 'src', mode: 'alpha', gradient: { angle: 180 },
    });
  });

  it('malformed existing angle is safely normalized for display (-10 → 350, NaN → 0)', () => {
    const a = render({ sourcePartId: 'src', mode: 'alpha', gradient: { angle: -10 } });
    expect(angle(a.container).value).toBe('350');
    const b = render({ sourcePartId: 'src', mode: 'alpha', gradient: { angle: NaN } });
    expect(angle(b.container).value).toBe('0');
  });

  it('toggling gradient ON writes { angle: 0 }; toggling OFF removes it', () => {
    const { onPartPropChange, container } = render({ sourcePartId: 'src', mode: 'alpha' });
    fireEvent.click(gradientToggle(container));
    expect(onPartPropChange).toHaveBeenCalledWith('matte', {
      sourcePartId: 'src', mode: 'alpha', gradient: { angle: 0 },
    });
    const { onPartPropChange: off, container: c2 } = render({ sourcePartId: 'src', mode: 'alpha', gradient: { angle: 45 } });
    fireEvent.click(gradientToggle(c2));
    expect(off).toHaveBeenCalledWith('matte', { sourcePartId: 'src', mode: 'alpha' });
  });

  it('toggle preserves all existing matte fields (only gradient changes)', () => {
    const full = target({ sourcePartId: 'src', mode: 'alpha', inverted: true, enabled: true, feather: 12, strength: 0.5, gradient: { angle: 45 } });
    const { onPartPropChange, container } = renderMatte(full, [star(), full]);
    fireEvent.click(gradientToggle(container));
    expect(onPartPropChange).toHaveBeenCalledWith('matte', {
      sourcePartId: 'src', mode: 'alpha', inverted: true, enabled: true, feather: 12, strength: 0.5,
    });
  });

  it('angle change preserves all existing matte fields (only angle changes)', () => {
    const full = target({ sourcePartId: 'src', mode: 'alpha', inverted: true, enabled: true, feather: 12, strength: 0.5, gradient: { angle: 45 } });
    const { onPartPropChange, container } = renderMatte(full, [star(), full]);
    fireEvent.change(angle(container), { target: { value: '90' } });
    expect(onPartPropChange).toHaveBeenCalledWith('matte', {
      sourcePartId: 'src', mode: 'alpha', inverted: true, enabled: true, feather: 12, strength: 0.5, gradient: { angle: 90 },
    });
  });

  it('missing source → gradient controls hidden (no crash)', () => {
    const { container } = render({ sourcePartId: 'ghost', mode: 'alpha', gradient: { angle: 45 } }, [star()]);
    expect(gradientToggle(container)).toBeNull();
  });

  it('no matte → gradient controls absent', () => {
    const { container } = renderMatte(target(), [star(), target()]);
    expect(gradientToggle(container)).toBeNull();
    expect(angle(container)).toBeNull();
  });
});

describe('StyleMatteSection — M18 text source UI policy', () => {
  const star = () => makePart('src', 'custom_star', 'Star Part');
  const text = () => makePart('txt', 'custom_text', 'Text Part');
  const target = (matte?: CharacterPart['matte']) => makePart('tgt', 'custom_box', 'Box Part', matte);
  const render = (matte: CharacterPart['matte'], parts: CharacterPart[]) => renderMatte(target(matte), [...parts, target(matte)]);
  const gradientToggle = (container: HTMLElement) => container.querySelector('input[aria-label="Gradient"]') as HTMLInputElement;
  const angle = (container: HTMLElement) => container.querySelector('input[aria-label="Gradient angle"]') as HTMLInputElement;
  const feather = (container: HTMLElement) => container.querySelector('input[aria-label="Feather"]') as HTMLInputElement;
  const strength = (container: HTMLElement) => container.querySelector('input[aria-label="Strength"]') as HTMLInputElement;
  const inverted = (container: HTMLElement) => container.querySelector('input[aria-label="Inverted"]') as HTMLInputElement;

  it('1. text source is selectable from the source list (isMatteEligible authority)', () => {
    const { container } = render({ sourcePartId: 'txt', mode: 'alpha' }, [star(), text()]);
    const options = Array.from(container.querySelectorAll('option')).map((o) => o.textContent);
    expect(options).toContain('Text Part');
    expect((container.querySelector('select') as HTMLSelectElement).value).toBe('txt');
  });

  it('2. text + clip → Clip OPTION disabled (no dead combination)', () => {
    const { container } = render({ sourcePartId: 'txt', mode: 'alpha' }, [text()]);
    const clipOption = Array.from(container.querySelectorAll('option')).find((o) => o.textContent === 'Clip') as HTMLOptionElement;
    expect(clipOption.disabled).toBe(true);
    // shape source → Clip stays enabled
    const shape = render({ sourcePartId: 'src', mode: 'clip' }, [star()]);
    const clipOptionShape = Array.from(shape.container.querySelectorAll('option')).find((o) => o.textContent === 'Clip') as HTMLOptionElement;
    expect(clipOptionShape.disabled).toBe(false);
  });

  it('3. text + clip ACTIVE → non-blocking note shown (matte inert otherwise)', () => {
    const { onPartPropChange, container } = render({ sourcePartId: 'txt', mode: 'clip' }, [text()]);
    expect(screen.getByText(/Text sources require Alpha or Luminance/)).toBeTruthy();
    // switching to alpha (via the real callback channel) clears the note
    const modeSelect = container.querySelectorAll('select')[1] as HTMLSelectElement;
    fireEvent.change(modeSelect, { target: { value: 'alpha' } });
    expect(onPartPropChange).toHaveBeenCalledWith('matte', { sourcePartId: 'txt', mode: 'alpha' });
  });

  it('4. text + alpha → inverted / feather / strength / gradient ALL enabled', () => {
    const { container } = render({ sourcePartId: 'txt', mode: 'alpha', gradient: { angle: 45 } }, [text()]);
    expect(inverted(container).disabled).toBe(false);
    expect(feather(container).disabled).toBe(false);
    expect(strength(container).disabled).toBe(false);
    expect(gradientToggle(container).disabled).toBe(false);
    expect(angle(container).disabled).toBe(false);
  });

  it('5. text + inverted → normal inverted checkbox (no extra luminance-fallback UI)', () => {
    const { onPartPropChange, container } = render({ sourcePartId: 'txt', mode: 'alpha' }, [text()]);
    fireEvent.click(inverted(container));
    expect(onPartPropChange).toHaveBeenCalledWith('matte', { sourcePartId: 'txt', mode: 'alpha', inverted: true });
    // no internal-renderer detail surfaced (mode select options are the normal ones)
    expect(screen.queryByText(/fallback/i)).toBeNull();
  });

  it('6. text + gradient toggle/angle work with field preservation', () => {
    const full = target({ sourcePartId: 'txt', mode: 'alpha', inverted: true, enabled: true, feather: 12, strength: 0.5, gradient: { angle: 45 } });
    const { onPartPropChange, container } = renderMatte(full, [text(), full]);
    fireEvent.change(angle(container), { target: { value: '90' } });
    expect(onPartPropChange).toHaveBeenCalledWith('matte', {
      sourcePartId: 'txt', mode: 'alpha', inverted: true, enabled: true, feather: 12, strength: 0.5, gradient: { angle: 90 },
    });
    fireEvent.click(gradientToggle(container));
    expect(onPartPropChange).toHaveBeenLastCalledWith('matte', {
      sourcePartId: 'txt', mode: 'alpha', inverted: true, enabled: true, feather: 12, strength: 0.5,
    });
  });

  it('7. text + feather + strength work (existing controls, no text-specific state)', () => {
    const { onPartPropChange, container } = render({ sourcePartId: 'txt', mode: 'luminance' }, [text()]);
    fireEvent.change(feather(container), { target: { value: '10' } });
    expect(onPartPropChange).toHaveBeenCalledWith('matte', { sourcePartId: 'txt', mode: 'luminance', feather: 10 });
    fireEvent.change(strength(container), { target: { value: '30' } });
    expect(onPartPropChange).toHaveBeenLastCalledWith('matte', { sourcePartId: 'txt', mode: 'luminance', strength: 0.3 });
  });

  it('8. source switching shape ↔ text preserves all matte fields', () => {
    const full = target({ sourcePartId: 'src', mode: 'alpha', inverted: true, enabled: true, feather: 12, strength: 0.5, gradient: { angle: 45 } });
    const { onPartPropChange, container } = renderMatte(full, [star(), text(), full]);
    const sourceSelect = container.querySelector('select') as HTMLSelectElement;
    // shape → text: only sourcePartId changes
    fireEvent.change(sourceSelect, { target: { value: 'txt' } });
    expect(onPartPropChange).toHaveBeenCalledWith('matte', {
      sourcePartId: 'txt', mode: 'alpha', inverted: true, enabled: true, feather: 12, strength: 0.5, gradient: { angle: 45 },
    });
    // text → shape: only sourcePartId changes back
    fireEvent.change(sourceSelect, { target: { value: 'src' } });
    expect(onPartPropChange).toHaveBeenLastCalledWith('matte', {
      sourcePartId: 'src', mode: 'alpha', inverted: true, enabled: true, feather: 12, strength: 0.5, gradient: { angle: 45 },
    });
  });

  it('9. missing text source → controls hidden (no crash), same as shape', () => {
    const { container } = render({ sourcePartId: 'ghost', mode: 'alpha' }, [star()]);
    expect(gradientToggle(container)).toBeNull();
    expect(feather(container)).toBeNull();
  });
});
