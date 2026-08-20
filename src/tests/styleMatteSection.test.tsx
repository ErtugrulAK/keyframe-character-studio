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
import { normalizeGradientType, normalizeGradientStops, gradientId, gradientStopsHash } from '../utils/matte';
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
const IMAGE = makePart('img', 'custom_image', 'Image Part');
const VIDEO = makePart('vid', 'custom_video', 'Video Part');

describe('StyleMatteSection — track matte editor UI', () => {
  it('uses a compact grid with source and mode in independent fields', () => {
    const target = makePart('tgt', 'custom_box', 'Box Part', { sourcePartId: 'src', mode: 'clip', enabled: true });
    const { container } = renderMatte(target, [STAR, target]);
    const grid = container.querySelector('.matte-control-grid');
    const source = screen.getByText('MATTE SOURCE').closest('.matte-field');
    const mode = screen.getByText('MODE').closest('.matte-field');

    expect(grid).toBeTruthy();
    expect(source).toBeTruthy();
    expect(mode).toBeTruthy();
    expect(source).not.toBe(mode);
    expect(grid?.contains(source)).toBe(true);
    expect(grid?.contains(mode)).toBe(true);
  });

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

  it('image IS an eligible source (M21); video is NOT', () => {
    const { container } = renderMatte(target(), [IMAGE, VIDEO, STAR, target()]);
    const list = options(container);
    expect(list).toContain('Image Part'); // M21: image → mask content element
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

describe('StyleMatteSection — M19 multi-stop gradient editor', () => {
  const star = () => makePart('src', 'custom_star', 'Star Part');
  const text = () => makePart('txt', 'custom_text', 'Text Part');
  const target = (matte?: CharacterPart['matte']) => makePart('tgt', 'custom_box', 'Box Part', matte);
  const render = (matte: CharacterPart['matte'], parts: CharacterPart[]) => renderMatte(target(matte), [...parts, target(matte)]);
  const addBtn = (container: HTMLElement) => container.querySelector('button[aria-label="Add gradient stop"]') as HTMLButtonElement;
  const removeBtn = (container: HTMLElement, i: number) => container.querySelector(`button[aria-label="Remove gradient stop ${i}"]`) as HTMLButtonElement;
  const color = (container: HTMLElement, i: number) => container.querySelector(`input[aria-label="Gradient stop ${i} color"]`) as HTMLInputElement;
  const offset = (container: HTMLElement, i: number) => container.querySelector(`input[aria-label="Gradient stop ${i} offset"]`) as HTMLInputElement;
  const opacity = (container: HTMLElement, i: number) => container.querySelector(`input[aria-label="Gradient stop ${i} opacity"]`) as HTMLInputElement;

  it('1. legacy {angle} → editor shows the normalized DEFAULT stops (2), legacy NOT rewritten', () => {
    const { onPartPropChange, container } = render({ sourcePartId: 'src', mode: 'alpha', gradient: { angle: 45 } }, [star()]);
    expect(color(container, 0)).not.toBeNull();
    expect(color(container, 1)).not.toBeNull();
    expect(color(container, 2)).toBeNull(); // exactly 2 defaults
    expect(offset(container, 0).value).toBe('0');
    expect(offset(container, 1).value).toBe('1');
    expect(opacity(container, 0).value).toBe('1');
    expect(opacity(container, 1).value).toBe('0'); // alpha default: white→transparent
    expect(onPartPropChange).not.toHaveBeenCalled(); // display only — no rewrite
  });

  it('2. min 2: remove disabled at 2 stops', () => {
    const { container } = render({ sourcePartId: 'src', mode: 'alpha', gradient: { angle: 45, stops: [{ offset: 0, color: '#ffffff', opacity: 1 }, { offset: 1, color: '#ffffff', opacity: 0 }] } }, [star()]);
    expect(removeBtn(container, 0).disabled).toBe(true);
    expect(removeBtn(container, 1).disabled).toBe(true);
    expect(addBtn(container).disabled).toBe(false);
  });

  it('3. max 4: add disabled at 4 stops', () => {
    const stops = [0, 0.33, 0.66, 1].map((offset, i) => ({ offset, color: '#ffffff', opacity: 1 - i * 0.2 }));
    const { container } = render({ sourcePartId: 'src', mode: 'alpha', gradient: { angle: 45, stops } }, [star()]);
    expect(addBtn(container).disabled).toBe(true);
    expect(removeBtn(container, 0).disabled).toBe(false);
  });

  it('4. add stop → deterministic midpoint in the LARGEST gap, inheriting the left stop', () => {
    const stops = [
      { offset: 0, color: '#ff0000', opacity: 1 },
      { offset: 0.2, color: '#00ff00', opacity: 0.8 },
      { offset: 1, color: '#0000ff', opacity: 0.5 },
    ];
    const { onPartPropChange, container } = render({ sourcePartId: 'src', mode: 'alpha', gradient: { angle: 45, stops } }, [star()]);
    fireEvent.click(addBtn(container));
    expect(onPartPropChange).toHaveBeenCalledWith('matte', {
      sourcePartId: 'src', mode: 'alpha', gradient: {
        angle: 45,
        stops: [
          { offset: 0, color: '#ff0000', opacity: 1 },
          { offset: 0.2, color: '#00ff00', opacity: 0.8 },
          { offset: 0.6, color: '#00ff00', opacity: 0.8 }, // midpoint of 0.2→1 gap, inherits left
          { offset: 1, color: '#0000ff', opacity: 0.5 },
        ],
      },
    });
  });

  it('5. remove stop → filtered; keeps angle + other fields', () => {
    const stops = [
      { offset: 0, color: '#ffffff', opacity: 1 },
      { offset: 0.5, color: '#ffffff', opacity: 0.5 },
      { offset: 1, color: '#ffffff', opacity: 0 },
    ];
    const full = target({ sourcePartId: 'src', mode: 'alpha', inverted: true, enabled: true, feather: 12, strength: 0.5, gradient: { angle: 90, stops } });
    const { onPartPropChange, container } = renderMatte(full, [star(), full]);
    fireEvent.click(removeBtn(container, 1));
    expect(onPartPropChange).toHaveBeenCalledWith('matte', {
      sourcePartId: 'src', mode: 'alpha', inverted: true, enabled: true, feather: 12, strength: 0.5,
      gradient: { angle: 90, stops: [stops[0], stops[2]] },
    });
  });

  it('6. color update → explicit stops materialized; every other field preserved', () => {
    const { onPartPropChange, container } = render({ sourcePartId: 'src', mode: 'alpha', gradient: { angle: 45 } }, [star()]);
    fireEvent.change(color(container, 0), { target: { value: '#ff0000' } });
    expect(onPartPropChange).toHaveBeenCalledWith('matte', {
      sourcePartId: 'src', mode: 'alpha', gradient: {
        angle: 45,
        stops: [
          { offset: 0, color: '#ff0000', opacity: 1 },
          { offset: 1, color: 'white', opacity: 0 }, // 5B defaults: 'white' (not hex)
        ],
      },
    });
  });

  it('7. offset update → single-stop patch (normalization happens on render)', () => {
    const stops = [
      { offset: 0, color: '#ffffff', opacity: 1 },
      { offset: 1, color: '#ffffff', opacity: 0 },
    ];
    const { onPartPropChange, container } = render({ sourcePartId: 'src', mode: 'alpha', gradient: { angle: 45, stops } }, [star()]);
    fireEvent.change(offset(container, 1), { target: { value: '0.7' } });
    expect(onPartPropChange).toHaveBeenCalledWith('matte', {
      sourcePartId: 'src', mode: 'alpha', gradient: { angle: 45, stops: [{ offset: 0, color: '#ffffff', opacity: 1 }, { offset: 0.7, color: '#ffffff', opacity: 0 }] },
    });
  });

  it('8. opacity update → clamped 0..1 written', () => {
    const stops = [
      { offset: 0, color: '#ffffff', opacity: 1 },
      { offset: 1, color: '#ffffff', opacity: 0 },
    ];
    const { onPartPropChange, container } = render({ sourcePartId: 'src', mode: 'alpha', gradient: { angle: 45, stops } }, [star()]);
    fireEvent.change(opacity(container, 1), { target: { value: '0.35' } });
    expect(onPartPropChange).toHaveBeenCalledWith('matte', {
      sourcePartId: 'src', mode: 'alpha', gradient: { angle: 45, stops: [{ offset: 0, color: '#ffffff', opacity: 1 }, { offset: 1, color: '#ffffff', opacity: 0.35 }] },
    });
  });

  it('9. display is normalized (unsorted stored stops shown sorted)', () => {
    const stops = [
      { offset: 1, color: '#ffffff', opacity: 0 },
      { offset: 0, color: '#ff0000', opacity: 1 },
      { offset: 0.5, color: '#00ff00', opacity: 0.5 },
    ];
    const { container } = render({ sourcePartId: 'src', mode: 'alpha', gradient: { angle: 45, stops } }, [star()]);
    expect(color(container, 0).value).toBe('#ff0000'); // sorted by offset: 0 first
    expect(offset(container, 0).value).toBe('0');
    expect(offset(container, 1).value).toBe('0.5');
    expect(offset(container, 2).value).toBe('1');
  });

  it('10. field preservation: shape ↔ text source swap keeps angle + stops', () => {
    const full = target({ sourcePartId: 'src', mode: 'alpha', inverted: true, enabled: true, feather: 12, strength: 0.5, gradient: { angle: 45, stops: [{ offset: 0, color: '#ff0000', opacity: 1 }, { offset: 1, color: '#0000ff', opacity: 1 }] } });
    const { onPartPropChange, container } = renderMatte(full, [star(), text(), full]);
    const sourceSelect = container.querySelector('select') as HTMLSelectElement;
    fireEvent.change(sourceSelect, { target: { value: 'txt' } });
    expect(onPartPropChange).toHaveBeenCalledWith('matte', {
      sourcePartId: 'txt', mode: 'alpha', inverted: true, enabled: true, feather: 12, strength: 0.5,
      gradient: { angle: 45, stops: [{ offset: 0, color: '#ff0000', opacity: 1 }, { offset: 1, color: '#0000ff', opacity: 1 }] },
    });
    // text → shape: stops survive
    fireEvent.change(sourceSelect, { target: { value: 'src' } });
    const last = onPartPropChange.mock.calls.at(-1)?.[1] as PartMatte;
    expect(last.sourcePartId).toBe('src');
    expect(last.gradient).toEqual({ angle: 45, stops: [{ offset: 0, color: '#ff0000', opacity: 1 }, { offset: 1, color: '#0000ff', opacity: 1 }] });
  });

  it('11. text source: stop editor works (no text-specific gradient system)', () => {
    const { container } = render({ sourcePartId: 'txt', mode: 'alpha', gradient: { angle: 0, stops: [{ offset: 0, color: '#ffffff', opacity: 1 }, { offset: 0.5, color: '#ffffff', opacity: 0.5 }, { offset: 1, color: '#ffffff', opacity: 0 }] } }, [text()]);
    expect(color(container, 0)).not.toBeNull();
    expect(color(container, 2)).not.toBeNull();
    expect(addBtn(container).disabled).toBe(false);
  });

  it('12. no local state: matte untouched → zero callbacks fired after render', () => {
    const { onPartPropChange, container } = render({ sourcePartId: 'src', mode: 'alpha', gradient: { angle: 45, stops: [{ offset: 0, color: '#ffffff', opacity: 1 }, { offset: 1, color: '#ffffff', opacity: 0 }] } }, [star()]);
    expect(color(container, 0).value).toBe('#ffffff');
    expect(onPartPropChange).not.toHaveBeenCalled();
  });
});

describe('StyleMatteSection — M20 radial gradient type UI', () => {
  const star = () => makePart('src', 'custom_star', 'Star Part');
  const text = () => makePart('txt', 'custom_text', 'Text Part');
  const target = (matte?: CharacterPart['matte']) => makePart('tgt', 'custom_box', 'Box Part', matte);
  const render = (matte: CharacterPart['matte'], parts: CharacterPart[] = [star()]) =>
    renderMatte(target(matte), [...parts, target(matte)]);
  const gradientToggle = (container: HTMLElement) =>
    container.querySelector('input[aria-label="Gradient"]') as HTMLInputElement;
  const typeSelect = (container: HTMLElement) =>
    container.querySelector('select[aria-label="Gradient type"]') as HTMLSelectElement;
  const angle = (container: HTMLElement) =>
    container.querySelector('input[aria-label="Gradient angle"]') as HTMLInputElement;
  const addBtn = (container: HTMLElement) =>
    container.querySelector('button[aria-label="Add gradient stop"]') as HTMLButtonElement;

  it('1. type control visible when gradient is active', () => {
    const { container } = render({ sourcePartId: 'src', mode: 'alpha', gradient: { angle: 45 } });
    expect(gradientToggle(container).checked).toBe(true);
    expect(typeSelect(container)).toBeTruthy();
  });

  it('2-3. legacy { angle: 45 } displays Linear; rendering does NOT rewrite the data', () => {
    const { onPartPropChange, container } = render({ sourcePartId: 'src', mode: 'alpha', gradient: { angle: 45 } });
    expect(typeSelect(container).value).toBe('linear');
    expect(angle(container).value).toBe('45');
    expect(onPartPropChange).not.toHaveBeenCalled(); // no automatic {type:'linear'} rewrite
  });

  it('4. Linear → Radial persists type, keeps angle inert + stops', () => {
    const matte: CharacterPart['matte'] = { sourcePartId: 'src', mode: 'alpha', gradient: { angle: 45, stops: [{ offset: 0, color: '#ffffff', opacity: 1 }, { offset: 1, color: '#ffffff', opacity: 0 }] } };
    const { onPartPropChange, container } = render(matte);
    fireEvent.change(typeSelect(container), { target: { value: 'radial' } });
    expect(onPartPropChange).toHaveBeenCalledWith('matte', {
      ...matte,
      gradient: { angle: 45, type: 'radial', stops: matte.gradient!.stops },
    });
  });

  it('5. Radial → Linear: type is OMITTED (canonical legacy form), stops/angle survive', () => {
    const matte: CharacterPart['matte'] = { sourcePartId: 'src', mode: 'alpha', gradient: { type: 'radial', angle: 30, stops: [{ offset: 0, color: '#ffffff', opacity: 1 }, { offset: 1, color: '#ffffff', opacity: 0 }] } };
    const { onPartPropChange, container } = render(matte);
    fireEvent.change(typeSelect(container), { target: { value: 'linear' } });
    expect(onPartPropChange).toHaveBeenCalledWith('matte', {
      ...matte,
      gradient: { angle: 30, stops: matte.gradient!.stops }, // type removed — missing ≡ linear
    });
  });

  it('6-12. type switch preserves sourcePartId/mode/inverted/enabled/feather/strength/stops', () => {
    const matte: CharacterPart['matte'] = {
      sourcePartId: 'src', mode: 'luminance', inverted: true, enabled: true, feather: 12, strength: 0.5,
      gradient: { angle: 90, stops: [{ offset: 0, color: '#ff0000', opacity: 1 }, { offset: 1, color: '#0000ff', opacity: 0.5 }] },
    };
    const { onPartPropChange, container } = render(matte);
    fireEvent.change(typeSelect(container), { target: { value: 'radial' } });
    const next = onPartPropChange.mock.calls.at(-1)?.[1] as CharacterPart['matte'];
    expect(next.sourcePartId).toBe('src');
    expect(next.mode).toBe('luminance');
    expect(next.inverted).toBe(true);
    expect(next.enabled).toBe(true);
    expect(next.feather).toBe(12);
    expect(next.strength).toBe(0.5);
    expect(next.gradient).toEqual({ angle: 90, type: 'radial', stops: [{ offset: 0, color: '#ff0000', opacity: 1 }, { offset: 1, color: '#0000ff', opacity: 0.5 }] });
  });

  it('13. Linear shows the ANGLE control', () => {
    const { container } = render({ sourcePartId: 'src', mode: 'alpha', gradient: { angle: 0 } });
    expect(angle(container)).toBeTruthy();
  });

  it('14. Radial hides the ANGLE control (automatic geometry — no redundant radial angle UI)', () => {
    const { container } = render({ sourcePartId: 'src', mode: 'alpha', gradient: { type: 'radial' } });
    expect(angle(container)).toBeNull();
  });

  it('15. Radial shows the SAME stop editor (M19 reuse — no second editor)', () => {
    const { container } = render({ sourcePartId: 'src', mode: 'alpha', gradient: { type: 'radial', stops: [{ offset: 0, color: '#ffffff', opacity: 1 }, { offset: 1, color: '#ffffff', opacity: 0 }] } });
    expect(addBtn(container)).toBeTruthy();
    expect(container.querySelector('input[aria-label="Gradient stop 0 offset"]')).toBeTruthy();
    expect(container.querySelector('input[aria-label="Gradient stop 1 opacity"]')).toBeTruthy();
    expect(addBtn(container).disabled).toBe(false);
  });

  it('16. text source supports radial (no text-specific state)', () => {
    const { container } = render({ sourcePartId: 'txt', mode: 'alpha', gradient: { type: 'radial' } }, [text()]);
    expect(typeSelect(container).value).toBe('radial');
    expect(typeSelect(container).disabled).toBe(false);
    expect(angle(container)).toBeNull();
  });

  it('17. clip mode disables the type select (existing gradient clip policy)', () => {
    const { container } = render({ sourcePartId: 'src', mode: 'clip', gradient: { type: 'radial' } });
    expect(typeSelect(container).disabled).toBe(true);
    expect(container.querySelector('button[aria-label="Add gradient stop"]')?.hasAttribute('disabled')).toBe(true);
  });

  it('18. missing source → gradient controls not rendered (no crash, no mutation)', () => {
    const ghost = makePart('tgt', 'custom_box', 'Box Part', { sourcePartId: 'ghost', mode: 'alpha', gradient: { type: 'radial' } });
    const { onPartPropChange, container } = renderMatte(ghost, [ghost]);
    expect(container.textContent).toContain('Missing source');
    expect(typeSelect(container)).toBeNull();
    expect(onPartPropChange).not.toHaveBeenCalled();
  });

  it('19. no local state mirror: render + type read fires zero callbacks', () => {
    const { onPartPropChange, container } = render({ sourcePartId: 'src', mode: 'alpha', gradient: { type: 'radial' } });
    expect(typeSelect(container).value).toBe('radial');
    expect(onPartPropChange).not.toHaveBeenCalled();
  });

  it('20. malformed gradient type normalizes to Linear in the UI', () => {
    const { container } = render({ sourcePartId: 'src', mode: 'alpha', gradient: { type: 'foo' as any, angle: 10 } });
    expect(typeSelect(container).value).toBe('linear');
    expect(angle(container).value).toBe('10');
  });

  it('renderer integration: UI-produced radial matte is consumed by the 6C renderer contract', () => {
    // The UI mutation writes { angle, type: 'radial', stops } — assert the
    // exact structure the StagePartLayers radial branch consumes normalizes
    // to radial (same normalizeGradientType authority, no extra rewrite).
    const produced = { angle: 45, type: 'radial', stops: [{ offset: 0, color: '#ffffff', opacity: 1 }, { offset: 1, color: '#ffffff', opacity: 0 }] };
    expect(normalizeGradientType(produced.type)).toBe('radial');
    expect(gradientId('src', produced)).toBe('kcs-mg-src-radial-s' + gradientStopsHash(normalizeGradientStops(produced.stops, 'alpha')));
    expect(gradientId('src', produced)).toMatch(/^kcs-mg-src-radial-/);
  });
});

describe('StyleMatteSection — M21 image matte UI', () => {
  const imgTarget = (matte?: CharacterPart['matte']) => makePart('tgt', 'custom_box', 'Box Part', matte);
  const STOPS2 = [
    { offset: 0, color: 'white', opacity: 1 },
    { offset: 1, color: 'white', opacity: 0 },
  ];

  const options = (container: HTMLElement): string[] =>
    [...container.querySelectorAll('select option')].map((o) => (o as HTMLOptionElement).textContent ?? '');

  it('1. image source appears in the eligible source list', () => {
    const { container } = renderMatte(imgTarget(), [IMAGE, STAR, BOX, TEXT, VIDEO, imgTarget()]);
    const list = options(container);
    expect(list).toContain('Image Part');
    expect(list).toContain('Star Part');
    expect(list).toContain('Text Part');
  });

  it('2. video remains ineligible', () => {
    const { container } = renderMatte(imgTarget(), [IMAGE, VIDEO, STAR, imgTarget()]);
    expect(options(container)).not.toContain('Video Part');
  });

  it('3-4. shape and text remain eligible', () => {
    const { container } = renderMatte(imgTarget(), [STAR, TEXT, FREEFORM, IMAGE, imgTarget()]);
    const list = options(container);
    expect(list).toContain('Star Part');
    expect(list).toContain('Text Part');
    expect(list).toContain('Free Part');
  });

  it('5-6. image + alpha / luminance are selectable modes', () => {
    const { onPartPropChange } = renderMatte(
      imgTarget({ sourcePartId: 'img', mode: 'alpha', enabled: true }),
      [IMAGE, imgTarget()],
    );
    const mode = screen.getAllByRole('combobox')[1] as HTMLSelectElement;
    fireEvent.change(mode, { target: { value: 'luminance' } });
    expect(onPartPropChange).toHaveBeenLastCalledWith('matte', expect.objectContaining({ sourcePartId: 'img', mode: 'luminance', enabled: true }));
  });

  it('7. image + inverted toggle works', () => {
    const { onPartPropChange } = renderMatte(
      imgTarget({ sourcePartId: 'img', mode: 'alpha', enabled: true }),
      [IMAGE, imgTarget()],
    );
    fireEvent.click(screen.getByLabelText('Inverted'));
    expect(onPartPropChange).toHaveBeenLastCalledWith('matte', expect.objectContaining({ inverted: true }));
  });

  it('8. image + clip is DISABLED in the mode select', () => {
    const { container } = renderMatte(
      imgTarget({ sourcePartId: 'img', mode: 'alpha', enabled: true }),
      [IMAGE, imgTarget()],
    );
    const clipOpt = [...container.querySelectorAll('option')].find((o) => o.textContent === 'Clip') as HTMLOptionElement;
    expect(clipOpt.disabled).toBe(true);
  });

  it('9. legacy image + clip does not crash and shows the unsupported hint', () => {
    const { container, onPartPropChange } = renderMatte(
      imgTarget({ sourcePartId: 'img', mode: 'clip', enabled: true }),
      [IMAGE, imgTarget()],
    );
    expect(container.textContent).toContain('Image sources require Alpha or Luminance mode');
    // still fully interactive — switching to Alpha works and preserves fields
    const mode = screen.getAllByRole('combobox')[1] as HTMLSelectElement;
    fireEvent.change(mode, { target: { value: 'alpha' } });
    expect(onPartPropChange).toHaveBeenLastCalledWith('matte', expect.objectContaining({ sourcePartId: 'img', mode: 'alpha', enabled: true }));
  });

  it('10-11. image + feather / strength controls stay enabled', () => {
    const { container } = renderMatte(
      imgTarget({ sourcePartId: 'img', mode: 'alpha', enabled: true }),
      [IMAGE, imgTarget()],
    );
    expect((container.querySelector('input[aria-label="Feather"]') as HTMLInputElement).disabled).toBe(false);
    expect((container.querySelector('input[aria-label="Strength"]') as HTMLInputElement).disabled).toBe(false);
  });

  it('12. image + gradient toggle works', () => {
    const { onPartPropChange } = renderMatte(
      imgTarget({ sourcePartId: 'img', mode: 'alpha', enabled: true }),
      [IMAGE, imgTarget()],
    );
    fireEvent.click(screen.getByLabelText(/Gradient/i));
    expect(onPartPropChange).toHaveBeenLastCalledWith('matte', expect.objectContaining({ gradient: { angle: 0 } }));
  });

  it('13. image + Linear gradient shows the angle control', () => {
    const { container } = renderMatte(
      imgTarget({ sourcePartId: 'img', mode: 'alpha', enabled: true, gradient: { angle: 45 } }),
      [IMAGE, imgTarget()],
    );
    expect(container.querySelector('input[aria-label="Gradient Angle"]')).toBeTruthy();
  });

  it('14. image + Radial gradient hides the angle control', () => {
    const { container } = renderMatte(
      imgTarget({ sourcePartId: 'img', mode: 'alpha', enabled: true, gradient: { type: 'radial', stops: STOPS2 } }),
      [IMAGE, imgTarget()],
    );
    expect(container.querySelector('input[aria-label="Gradient Angle"]')).toBeNull();
    const type = screen.getByLabelText(/Gradient Type/i) as HTMLSelectElement;
    expect(type.value).toBe('radial');
  });

  it('15. image + radial supports the stops editor (2–4)', () => {
    const { container } = renderMatte(
      imgTarget({ sourcePartId: 'img', mode: 'alpha', enabled: true, gradient: { type: 'radial', stops: STOPS2 } }),
      [IMAGE, imgTarget()],
    );
    const stops = container.querySelectorAll('input[aria-label^="Gradient stop"]');
    expect(stops.length).toBeGreaterThanOrEqual(2);
  });

  it('16. switching shape → image preserves matte fields (only sourcePartId changes)', () => {
    const { onPartPropChange } = renderMatte(
      imgTarget({ sourcePartId: 'src', mode: 'luminance', enabled: true, inverted: true, feather: 12, strength: 0.5, gradient: { type: 'radial', stops: STOPS2 } }),
      [STAR, IMAGE, imgTarget()],
    );
    const src = screen.getAllByRole('combobox')[0] as HTMLSelectElement;
    fireEvent.change(src, { target: { value: 'img' } });
    expect(onPartPropChange).toHaveBeenLastCalledWith('matte', expect.objectContaining({
      sourcePartId: 'img', mode: 'luminance', enabled: true, inverted: true, feather: 12, strength: 0.5,
      gradient: { type: 'radial', stops: STOPS2 },
    }));
  });

  it('17. switching image → text preserves matte fields', () => {
    const { onPartPropChange } = renderMatte(
      imgTarget({ sourcePartId: 'img', mode: 'alpha', enabled: true, feather: 6, strength: 0.75, gradient: { angle: 90 } }),
      [IMAGE, TEXT, imgTarget()],
    );
    const src = screen.getAllByRole('combobox')[0] as HTMLSelectElement;
    fireEvent.change(src, { target: { value: 'txt' } });
    expect(onPartPropChange).toHaveBeenLastCalledWith('matte', expect.objectContaining({
      sourcePartId: 'txt', mode: 'alpha', enabled: true, feather: 6, strength: 0.75, gradient: { angle: 90 },
    }));
  });

  it('18. switching image → shape preserves matte fields', () => {
    const { onPartPropChange } = renderMatte(
      imgTarget({ sourcePartId: 'img', mode: 'luminance', enabled: true, inverted: true }),
      [IMAGE, STAR, imgTarget()],
    );
    const src = screen.getAllByRole('combobox')[0] as HTMLSelectElement;
    fireEvent.change(src, { target: { value: 'src' } });
    expect(onPartPropChange).toHaveBeenLastCalledWith('matte', expect.objectContaining({ sourcePartId: 'src', mode: 'luminance', enabled: true, inverted: true }));
  });

  it('19. missing source remains safe (no crash, no image-specific controls leak)', () => {
    const { container } = renderMatte(
      imgTarget({ sourcePartId: 'ghost', mode: 'clip', enabled: true }),
      [IMAGE, imgTarget()],
    );
    expect(container.textContent).toContain('Missing source');
    // no mode/inverted/gradient controls are rendered for a missing source
    expect(screen.queryAllByRole('combobox').length).toBe(1); // source select only
    expect(screen.queryByLabelText('Inverted')).toBeNull();
  });

  it('20. no local state mirror: gradient type/angle/stops all derive from matte', () => {
    const { container, rerender } = renderMatte(
      imgTarget({ sourcePartId: 'img', mode: 'alpha', enabled: true, gradient: { type: 'radial', stops: STOPS2 } }),
      [IMAGE, imgTarget()],
    );
    expect(container.querySelector('input[aria-label="Gradient Angle"]')).toBeNull();
    // re-render with a Linear gradient — the SAME component instance derives
    // the new display (no stale local state survives)
    rerender(<StyleMatteSection
      selectedPart={imgTarget({ sourcePartId: 'img', mode: 'alpha', enabled: true, gradient: { angle: 45 } })}
      characterParts={[IMAGE, imgTarget()]}
      onPartPropChange={vi.fn()}
    />);
    expect(container.querySelector('input[aria-label="Gradient Angle"]')).toBeTruthy();
  });

  it('21. legacy linear {angle:45} displays Linear without rewrite (no callback)', () => {
    const { onPartPropChange, container } = renderMatte(
      imgTarget({ sourcePartId: 'img', mode: 'alpha', enabled: true, gradient: { angle: 45 } }),
      [IMAGE, imgTarget()],
    );
    expect(container.textContent).toContain('45'); // angle readout derived
    const type = screen.getByLabelText(/Gradient Type/i) as HTMLSelectElement;
    expect(type.value).toBe('linear'); // missing type ≡ linear
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'luminance' } });
    expect(onPartPropChange).toHaveBeenLastCalledWith('matte', expect.objectContaining({ gradient: { angle: 45 } })); // gradient untouched
  });

  it('22. image radial → linear switch preserves stops (type omitted, legacy canonical)', () => {
    const { onPartPropChange } = renderMatte(
      imgTarget({ sourcePartId: 'img', mode: 'alpha', enabled: true, gradient: { type: 'radial', stops: STOPS2 } }),
      [IMAGE, imgTarget()],
    );
    const type = screen.getByLabelText(/Gradient type/i) as HTMLSelectElement;
    fireEvent.change(type, { target: { value: 'linear' } });
    expect(onPartPropChange).toHaveBeenLastCalledWith('matte', expect.objectContaining({
      gradient: { stops: STOPS2 }, // no type key → legacy linear
    }));
    const last = onPartPropChange.mock.calls.at(-1)![1] as { gradient: { type?: string; stops: typeof STOPS2 } };
    expect(last.gradient.type).toBeUndefined();
    expect(last.gradient.stops).toEqual(STOPS2);
  });

  it('23-24. image linear → radial switch preserves stops + angle (type discriminator added)', () => {
    const { onPartPropChange } = renderMatte(
      imgTarget({ sourcePartId: 'img', mode: 'alpha', enabled: true, gradient: { angle: 30, stops: STOPS2 } }),
      [IMAGE, imgTarget()],
    );
    const type = screen.getByLabelText(/Gradient type/i) as HTMLSelectElement;
    fireEvent.change(type, { target: { value: 'radial' } });
    expect(onPartPropChange).toHaveBeenLastCalledWith('matte', expect.objectContaining({
      gradient: { angle: 30, type: 'radial', stops: STOPS2 },
    }));
  });

  it('25. image clip mode cannot reach a valid render path (Clip option disabled)', () => {
    const { container } = renderMatte(
      imgTarget({ sourcePartId: 'img', mode: 'alpha', enabled: true }),
      [IMAGE, imgTarget()],
    );
    const clipOpt = [...container.querySelectorAll('option')].find((o) => o.textContent === 'Clip') as HTMLOptionElement;
    expect(clipOpt.disabled).toBe(true);
    // legacy clip data is visible but cannot be re-selected once the user
    // switches away (renderer never emits a clipPath for image — 7C test 12)
    const legacy = renderMatte(
      imgTarget({ sourcePartId: 'img', mode: 'clip', enabled: true }),
      [IMAGE, imgTarget()],
    );
    expect(legacy.container.textContent).toContain('Image sources require Alpha or Luminance mode');
  });
});
