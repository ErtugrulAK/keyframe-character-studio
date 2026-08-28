import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmationDialog } from '../components/Modal/ConfirmationDialog';

describe('ConfirmationDialog', () => {
  it('cancels on Escape and traps Tab between actions', () => {
    const onCancel = vi.fn();
    render(<ConfirmationDialog isOpen title="Delete sequence?" description="Channels will be removed." onConfirm={vi.fn()} onCancel={onCancel} />);
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    const confirm = screen.getByRole('button', { name: 'Delete' });
    expect(document.activeElement).toBe(cancel);
    fireEvent.keyDown(document, { key: 'Tab' });
    cancel.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(confirm);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalled();
  });
});
