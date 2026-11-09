import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CharacterPart } from '../types/animator';

/**
 * The options bar under the toolbar: shown for one selected text layer, and
 * writing through the Inspector's property authority.
 */
const ctx = {
  selectedPartId: null as string | null,
  selectedPartIds: [] as string[],
  characterParts: [] as CharacterPart[],
  startBatchInteraction: vi.fn(),
  endBatchInteraction: vi.fn(),
};
const authoring = { handlePartPropChange: vi.fn(), handlePartColorChange: vi.fn() };

vi.mock('../context/useAnimator', () => ({ useAnimatorSlice: () => ctx }));
vi.mock('../hooks/usePartPropertyAuthoring', () => ({ usePartPropertyAuthoring: () => authoring }));

const { ToolOptionsBar } = await import('../components/Toolbar/ToolOptionsBar');

const text = (overrides: Partial<CharacterPart> = {}): CharacterPart => ({
  id: 't', name: 'Title', type: 'custom_text', zIndex: 1, textValue: 'HELLO', fontFamily: 'Inter', fontSize: 24,
  fillColor: '#ffffff', strokeColor: '#101218',
  baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
  ...overrides,
} as CharacterPart);

const select = (...parts: CharacterPart[]) => {
  ctx.characterParts = parts;
  ctx.selectedPartIds = parts.map((part) => part.id);
  ctx.selectedPartId = parts[0]?.id ?? null;
};
const bar = () => screen.queryByRole('toolbar', { name: 'Text options' });

beforeEach(() => {
  vi.clearAllMocks();
  select();
});

describe('ToolOptionsBar', () => {
  it('is hidden with nothing, a shape, or several layers selected', () => {
    const view = render(<ToolOptionsBar />);
    expect(bar()).toBeNull();
    select(text({ id: 'r', type: 'custom_rect' }));
    view.rerender(<ToolOptionsBar />);
    expect(bar()).toBeNull();
    select(text({ id: 'a' }), text({ id: 'b' }));
    view.rerender(<ToolOptionsBar />);
    expect(bar()).toBeNull();
  });

  it('shows the selected text\'s values', () => {
    select(text({ textValue: 'WORLD', fontFamily: 'Montserrat', fontSize: 30 }));
    render(<ToolOptionsBar />);
    expect(screen.getByLabelText('Text content')).toHaveValue('WORLD');
    expect(screen.getByLabelText('Font family')).toHaveValue('Montserrat');
    expect(screen.getByRole('button', { name: 'Align text centre' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('edits the text, the font and the alignment through the property authority', () => {
    select(text({ textFit: { align: 'center', maxLength: 40 } } as Partial<CharacterPart>));
    render(<ToolOptionsBar />);
    fireEvent.change(screen.getByLabelText('Text content'), { target: { value: 'NEW' } });
    expect(authoring.handlePartPropChange).toHaveBeenCalledWith('textValue', 'NEW');
    fireEvent.change(screen.getByLabelText('Font family'), { target: { value: 'Roboto' } });
    expect(authoring.handlePartPropChange).toHaveBeenCalledWith('fontFamily', 'Roboto');
    fireEvent.click(screen.getByRole('button', { name: 'Align text right' }));
    // The other text-fit settings are kept.
    expect(authoring.handlePartPropChange).toHaveBeenCalledWith('textFit', { align: 'right', maxLength: 40 });
  });

  it('a text style writes its font and size as one undo step', () => {
    select(text());
    render(<ToolOptionsBar />);
    fireEvent.change(screen.getByLabelText('Text style'), { target: { value: 'Heading' } });
    expect(authoring.handlePartPropChange.mock.calls).toEqual([['fontFamily', 'Outfit'], ['fontSize', 48]]);
    expect(ctx.startBatchInteraction).toHaveBeenCalledOnce();
    expect(ctx.endBatchInteraction).toHaveBeenCalledOnce();
  });

  it('names the style a text matches, and none when it matches no style', () => {
    select(text({ fontFamily: 'Outfit', fontSize: 48 }));
    const view = render(<ToolOptionsBar />);
    expect(screen.getByLabelText('Text style')).toHaveValue('Heading');
    select(text({ fontFamily: 'Outfit', fontSize: 47 }));
    view.rerender(<ToolOptionsBar />);
    expect(screen.getByLabelText('Text style')).toHaveValue('');
  });

  it('a style with a multi-word font stores the family the font list offers (with its quotes)', () => {
    select(text());
    render(<ToolOptionsBar />);
    fireEvent.change(screen.getByLabelText('Text style'), { target: { value: 'Display Title' } });
    expect(authoring.handlePartPropChange).toHaveBeenCalledWith('fontFamily', "'Bebas Neue'");
    const fonts = Array.from((screen.getByLabelText('Font family') as HTMLSelectElement).options).map((option) => option.value);
    for (const preset of ['Display Title', 'Cinematic Title']) {
      vi.clearAllMocks();
      fireEvent.change(screen.getByLabelText('Text style'), { target: { value: preset } });
      expect(fonts).toContain(authoring.handlePartPropChange.mock.calls[0][1]);
    }
  });

  it('names the style of a multi-word font, quoted or not (older layers stored it bare)', () => {
    select(text({ fontFamily: "'Bebas Neue'", fontSize: 64 }));
    const view = render(<ToolOptionsBar />);
    expect(screen.getByLabelText('Text style')).toHaveValue('Display Title');
    expect(screen.getByLabelText('Font family')).toHaveValue("'Bebas Neue'");
    select(text({ fontFamily: 'Playfair Display', fontSize: 42 }));
    view.rerender(<ToolOptionsBar />);
    expect(screen.getByLabelText('Text style')).toHaveValue('Cinematic Title');
  });

  it('turns the outline on and off', () => {
    select(text({ strokeEnabled: true }));
    render(<ToolOptionsBar />);
    fireEvent.click(screen.getByLabelText('Text Stroke Enabled'));
    expect(authoring.handlePartPropChange).toHaveBeenCalledWith('strokeEnabled', false);
  });
});
