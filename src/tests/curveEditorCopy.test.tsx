import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InteractiveCubicBezierEditor } from '../components/Inspector/InteractiveCubicBezierEditor';

/**
 * The curve editor's "Copy CSS code" button tells the truth: it confirms only
 * a copy that happened. The async Clipboard API exists only in a secure
 * context, so the editor opened over plain http on the LAN (the QA server's
 * LAN address) has none; a permission refusal rejects.
 */
const renderEditor = () => render(
  <InteractiveCubicBezierEditor controlPoints={[0.42, 0, 0.58, 1]} onChange={vi.fn()} initialModalOpen />,
);

const setClipboard = (value: unknown) => Object.defineProperty(navigator, 'clipboard', { value, configurable: true });

afterEach(() => {
  cleanup();
  setClipboard(undefined);
});

const copyStatus = () => screen.getAllByRole('status').find((node) => /CSS code copied|Copy failed/.test(node.textContent ?? ''))?.textContent;

const click = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Copy CSS code' }));
  });
};

describe('curve editor CSS copy', () => {
  it('copies the CSS easing and confirms it', async () => {
    const writeText = vi.fn(async () => undefined);
    setClipboard({ writeText });
    renderEditor();
    await click();
    expect(writeText).toHaveBeenCalledWith('cubic-bezier(0.42, 0, 0.58, 1)');
    expect(copyStatus()).toBe('CSS code copied.');
    // The focused button keeps its name; the result is announced separately.
    expect(screen.getByRole('button', { name: 'Copy CSS code' })).toBeTruthy();
  });

  it('says the copy failed when the page has no clipboard (plain http)', async () => {
    setClipboard(undefined);
    renderEditor();
    await click();
    expect(copyStatus()).toBe('Copy failed: this page cannot reach the clipboard. Select the code and copy it by hand.');
  });

  it('says the copy failed when the browser refuses it', async () => {
    setClipboard({ writeText: vi.fn(async () => { throw new DOMException('denied', 'NotAllowedError'); }) });
    renderEditor();
    await click();
    expect(copyStatus()).toContain('Copy failed');
  });
});
