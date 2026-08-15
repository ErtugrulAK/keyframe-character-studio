import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TransformInOutPresetCard } from '../components/Inspector/sections/transform/TransformInOutPresetCard';
import type { CharacterPart, CustomMotionPreset } from '../types/animator';

/**
 * M26 26B — Copy / Paste / Clear Animation UI on the IN/OUT preset card.
 * The card exposes the 26A data layer through compact action buttons; the
 * real transfer/history orchestration lives in DetailsPanel (26C E2E proves
 * the full flow + single-undo behavior).
 */

function makePart(id: string, overrides: Partial<CharacterPart> = {}): CharacterPart {
  return {
    id, name: `Part ${id}`, type: 'custom_box',
    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1,
    visible: true, zIndex: 1, fillColor: '#fff', strokeColor: '#000',
    strokeWidth: 2, width: 60, height: 60, borderRadius: 0,
    inAnimPreset: 'none', outAnimPreset: 'none',
    inAnimDuration: 30, outAnimDuration: 30,
    ...overrides,
  } as CharacterPart;
}

interface RenderOpts {
  part?: CharacterPart;
  clipboardSourceId?: string | null;
  onCopy?: ReturnType<typeof vi.fn>;
  onPaste?: ReturnType<typeof vi.fn>;
  onClear?: ReturnType<typeof vi.fn>;
}

function renderCard(opts: RenderOpts = {}) {
  const onCopy = opts.onCopy ?? vi.fn();
  const onPaste = opts.onPaste ?? vi.fn();
  const onClear = opts.onClear ?? vi.fn();
  const utils = render(
    <TransformInOutPresetCard
      selectedPart={opts.part ?? makePart('p1')}
      onPartPropChange={vi.fn()}
      customPresets={[] as CustomMotionPreset[]}
      onSavePreset={vi.fn()}
      onDeletePreset={vi.fn()}
      onCopyAnimation={onCopy}
      onPasteAnimation={onPaste}
      onClearAnimation={onClear}
      clipboardSourceId={opts.clipboardSourceId ?? null}
    />,
  );
  return { ...utils, onCopy, onPaste, onClear };
}

describe('M26 26B — animation action buttons', () => {
  it('1-3. Copy / Paste / Clear Animation buttons render', () => {
    renderCard();
    expect(screen.getByLabelText('Copy Animation')).toBeTruthy();
    expect(screen.getByLabelText('Paste Animation')).toBeTruthy();
    expect(screen.getByLabelText('Clear Animation')).toBeTruthy();
  });

  it('4. Paste is disabled without a clipboard payload', () => {
    renderCard({ clipboardSourceId: null });
    expect((screen.getByLabelText('Paste Animation') as HTMLButtonElement).disabled).toBe(true);
  });

  it('5. Paste is disabled when the target IS the clipboard source (no self-paste)', () => {
    renderCard({ part: makePart('A'), clipboardSourceId: 'A' });
    expect((screen.getByLabelText('Paste Animation') as HTMLButtonElement).disabled).toBe(true);
  });

  it('6. Paste is enabled for a different target part', () => {
    renderCard({ part: makePart('B'), clipboardSourceId: 'A' });
    expect((screen.getByLabelText('Paste Animation') as HTMLButtonElement).disabled).toBe(false);
  });

  it('7. Copy click invokes onCopyAnimation', () => {
    const { onCopy } = renderCard();
    fireEvent.click(screen.getByLabelText('Copy Animation'));
    expect(onCopy).toHaveBeenCalledTimes(1);
  });

  it('8. Paste click invokes onPasteAnimation (enabled state)', () => {
    const { onPaste } = renderCard({ part: makePart('B'), clipboardSourceId: 'A' });
    fireEvent.click(screen.getByLabelText('Paste Animation'));
    expect(onPaste).toHaveBeenCalledTimes(1);
  });

  it('9. Paste click on disabled state does nothing (no crash)', () => {
    const { onPaste } = renderCard({ clipboardSourceId: null });
    fireEvent.click(screen.getByLabelText('Paste Animation'));
    expect(onPaste).not.toHaveBeenCalled();
  });

  it('10. Clear click invokes onClearAnimation', () => {
    const { onClear } = renderCard();
    fireEvent.click(screen.getByLabelText('Clear Animation'));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('11. accessibility: meaningful titles on all three actions', () => {
    renderCard();
    expect(screen.getByTitle('Copy animation from this element')).toBeTruthy();
    expect(screen.getByTitle('Paste animation onto selected element')).toBeTruthy();
    expect(screen.getByTitle('Clear animation (IN/OUT presets, durations and keyframes)')).toBeTruthy();
  });

  it('12. buttons absent when clipboard handlers are not provided (25C-25A cards keep old surface)', () => {
    render(
      <TransformInOutPresetCard
        selectedPart={makePart('p1')}
        onPartPropChange={vi.fn()}
        customPresets={[] as CustomMotionPreset[]}
        onSavePreset={vi.fn()}
        onDeletePreset={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText('Copy Animation')).toBeNull();
    expect(screen.queryByLabelText('Paste Animation')).toBeNull();
    expect(screen.queryByLabelText('Clear Animation')).toBeNull();
  });

  it('13. card still renders save/delete (M25 surface intact)', () => {
    renderCard();
    expect(screen.getAllByTitle('Save current animation as a custom preset')).toHaveLength(2);
  });
});
