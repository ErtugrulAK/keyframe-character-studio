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

  it('lists eligible shape sources; excludes self and unsupported types', () => {
    const { container } = renderMatte(BOX, [STAR, BOX, FREEFORM, TEXT]);
    const options = Array.from(container.querySelectorAll('option')).map((o) => o.textContent);
    expect(options).toContain('Star Part');           // shape source eligible
    expect(options).not.toContain('Box Part');        // self excluded
    expect(options).not.toContain('Free Part');       // freeform excluded (MVP)
    expect(options).not.toContain('Text Part');       // text excluded (MVP)
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
    // checkboxes: [0] inverted, [1] enabled
    const checkbox = container.querySelectorAll('input[type="checkbox"]')[1] as HTMLInputElement;
    expect(checkbox.checked).toBe(true);

    fireEvent.click(checkbox);
    expect(onPartPropChange).toHaveBeenCalledWith('matte', { sourcePartId: 'src', mode: 'clip', enabled: false });

    // re-render with disabled matte → checkbox unchecked, relationship intact
    const disabled = makePart('tgt', 'custom_box', 'Box Part', { sourcePartId: 'src', mode: 'clip', enabled: false });
    const { onPartPropChange: cb2, container: c2 } = renderMatte(disabled, [STAR, disabled]);
    expect((c2.querySelectorAll('input[type="checkbox"]')[1] as HTMLInputElement).checked).toBe(false);
    fireEvent.click(c2.querySelectorAll('input[type="checkbox"]')[1] as HTMLInputElement);
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
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    // checkboxes[0] = inverted, checkboxes[1] = enabled
    expect((checkboxes[0] as HTMLInputElement).checked).toBe(false);
    fireEvent.click(checkboxes[0]);
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
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    expect((checkboxes[0] as HTMLInputElement).checked).toBe(false); // inverted OFF
    expect((checkboxes[1] as HTMLInputElement).checked).toBe(true);  // enabled (undefined → active)
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
