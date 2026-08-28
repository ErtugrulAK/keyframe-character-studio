import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InlineRename } from '../components/Shared/InlineRename';

describe('InlineRename', () => {
  it('commits trimmed names on Enter and cancels on Escape', () => {
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    render(<InlineRename value="Rectangle" ariaLabel="Rename layer" onCommit={onCommit} onCancel={onCancel} />);
    const input = screen.getByRole('textbox', { name: 'Rename layer' });
    fireEvent.change(input, { target: { value: '  Circle  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCommit).toHaveBeenCalledWith('Circle');

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalled();
  });

  it('rejects empty values through the cancel path', () => {
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    render(<InlineRename value="Rectangle" ariaLabel="Rename layer" onCommit={onCommit} onCancel={onCancel} />);
    const input = screen.getByRole('textbox', { name: 'Rename layer' });
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.blur(input);
    expect(onCommit).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
  });
});
