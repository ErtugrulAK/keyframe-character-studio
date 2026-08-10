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
    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);

    fireEvent.click(checkbox);
    expect(onPartPropChange).toHaveBeenCalledWith('matte', { sourcePartId: 'src', mode: 'clip', enabled: false });

    // re-render with disabled matte → checkbox unchecked, relationship intact
    const disabled = makePart('tgt', 'custom_box', 'Box Part', { sourcePartId: 'src', mode: 'clip', enabled: false });
    const { onPartPropChange: cb2, container: c2 } = renderMatte(disabled, [STAR, disabled]);
    expect((c2.querySelector('input[type="checkbox"]') as HTMLInputElement).checked).toBe(false);
    fireEvent.click(c2.querySelector('input[type="checkbox"]') as HTMLInputElement);
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
});
