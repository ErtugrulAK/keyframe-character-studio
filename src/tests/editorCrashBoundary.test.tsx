import { useEffect } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnimatorProvider, type AnimatorContextType } from '../context/AnimatorContext';
import { useAnimator } from '../context/useAnimator';
import { EditorCrashBoundary } from '../components/Shared/EditorCrashBoundary';

/**
 * A render error in the editor shell shows a recovery card instead of a blank
 * page, with the document still in memory: Export downloads exactly what was
 * on screen, and Reload asks the page to reload.
 */
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

let live: AnimatorContextType | null = null;
const Capture = () => { const ctx = useAnimator(); useEffect(() => { live = ctx; }); return null; };

const Bomb = ({ armed }: { armed: boolean }) => {
  if (armed) throw new Error('kaboom in the shell');
  return <p>editor shell</p>;
};

const renderShell = (armed: boolean, reloadApp = vi.fn()) => {
  const view = render(
    <AnimatorProvider>
      <Capture />
      <EditorCrashBoundary reloadApp={reloadApp}>
        <Bomb armed={armed} />
      </EditorCrashBoundary>
    </AnimatorProvider>,
  );
  return { ...view, reloadApp };
};

describe('EditorCrashBoundary', () => {
  it('renders the shell when nothing fails', () => {
    renderShell(false);
    expect(screen.getByText('editor shell')).toBeTruthy();
  });

  it('shows the recovery card with the error instead of a blank page', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    renderShell(true);
    expect(screen.getByRole('alertdialog', { name: 'The editor stopped with an error' })).toBeTruthy();
    expect(screen.getByText('kaboom in the shell')).toBeTruthy();
  });

  it('exports the work made before the crash, kept in the provider', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const created: Blob[] = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => { created.push(blob as Blob); return 'blob:test'; });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const Crashing = () => {
      const ctx = useAnimator();
      if (ctx.characterParts.some((part) => part.name === 'Trigger')) throw new Error('kaboom after an edit');
      return <p>editor shell</p>;
    };
    render(
      <AnimatorProvider>
        <Capture />
        <EditorCrashBoundary reloadApp={vi.fn()}>
          <Crashing />
        </EditorCrashBoundary>
      </AnimatorProvider>,
    );
    act(() => { live!.addCustomPart('custom_rect', 'Unsaved work'); });
    act(() => { live!.addCustomPart('custom_rect', 'Trigger'); });
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Export project' }));
    expect(created).toHaveLength(1);
    const text = await created[0].text();
    expect(text).toContain('Unsaved work');
    expect(screen.getByRole('status').textContent).toBe('Exported.');
  });

  it('reloads on request', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { reloadApp } = renderShell(true);
    fireEvent.click(screen.getByRole('button', { name: 'Reload editor' }));
    expect(reloadApp).toHaveBeenCalledTimes(1);
  });
});
