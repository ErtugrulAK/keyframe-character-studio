// D1 — GIF panel gate: localized boundary, loading state, retry, cancellation.
// The lazy chunk is replaced through the gate's `loadPanel` seam (production
// never passes it); the contract pinned here is the gate's own: visible
// loading state, actionable failure card in the panel footprint, retry that
// re-attempts the load, close that hands dismissal back to the host, and a
// host that never blanks when the chunk is gone.
import React from 'react';
import '@testing-library/jest-dom';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SceneData } from '../types/composition';
import { GifPanelGate, type GifPanelGateProps } from '../components/Header/GifPanelGate';

const scene = { name: 'd1-scene' } as unknown as SceneData;

type Loader = NonNullable<GifPanelGateProps['loadPanel']>;

const StubPanel = (props: { scene: SceneData; onClose: () => void }) => (
  <div role="dialog" aria-label="Export animated GIF">
    {`panel:${props.scene.name}`}
    <button onClick={props.onClose}>close panel</button>
  </div>
);

let calls: number;
let outcomes: Array<() => Promise<{ GifExportPanel: React.ComponentType<GifPanelGateProps> }>>;

const loader: Loader = () => {
  calls += 1;
  const outcome = outcomes[Math.min(calls - 1, outcomes.length - 1)] as () => Promise<{ GifExportPanel: React.ComponentType<GifPanelGateProps> }>;
  return outcome();
};

const failOnce = () => Promise.reject(new Error('Failed to fetch chunk'));
const okOnce = () => Promise.resolve({ GifExportPanel: StubPanel as React.ComponentType<GifPanelGateProps> });

const Host = ({ onClose }: { onClose: () => void }) => (
  <div>
    <div data-testid="editor-still-here">editor alive</div>
    <GifPanelGate
      scene={scene}
      sceneTitle="d1"
      onClose={onClose}
      onBlocked={() => undefined}
      showToast={() => undefined}
      loadPanel={loader}
    />
  </div>
);

afterEach(cleanup);

describe('D1 — GifPanelGate', () => {
  it('shows a loading state on first open, then the panel', async () => {
    calls = 0;
    outcomes = [okOnce];
    render(<Host onClose={() => undefined} />);
    expect(screen.getByRole('status', { name: 'Loading GIF export' })).toBeInTheDocument();
    expect(await screen.findByText('panel:d1-scene')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(calls).toBe(1);
  });

  it('keeps the host mounted and offers an actionable card when the chunk rejects', async () => {
    calls = 0;
    outcomes = [failOnce];
    render(<Host onClose={() => undefined} />);
    const card = await screen.findByRole('alertdialog', { name: 'GIF export unavailable' });
    expect(card).toHaveTextContent('could not be loaded');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    // Localized: the rest of the editor is untouched and the loading state is gone.
    expect(screen.getByTestId('editor-still-here')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('retry re-attempts the load and renders the panel once it resolves', async () => {
    calls = 0;
    outcomes = [failOnce, okOnce];
    render(<Host onClose={() => undefined} />);
    await screen.findByRole('alertdialog', { name: 'GIF export unavailable' });
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('panel:d1-scene')).toBeInTheDocument();
    expect(calls).toBe(2);
    expect(screen.getByTestId('editor-still-here')).toBeInTheDocument();
  });

  it('close on the failure card asks the host to dismiss the panel', async () => {
    calls = 0;
    outcomes = [failOnce];
    const onClose = vi.fn();
    render(<Host onClose={onClose} />);
    await screen.findByRole('alertdialog', { name: 'GIF export unavailable' });
    fireEvent.click(screen.getByRole('button', { name: 'Close GIF export panel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('survives repeated open/close cycles without errors', async () => {
    calls = 0;
    outcomes = [okOnce];
    const view = render(<Host onClose={() => undefined} />);
    expect(await screen.findByText('panel:d1-scene')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'close panel' }));
    view.unmount();
    render(<Host onClose={() => undefined} />);
    await waitFor(() => expect(screen.getByText('panel:d1-scene')).toBeInTheDocument());
    expect(calls).toBe(2);
    expect(screen.getAllByTestId('editor-still-here')).toHaveLength(1);
  });

  it('recovers through the card after two consecutive failures', async () => {
    calls = 0;
    outcomes = [failOnce];
    render(<Host onClose={() => undefined} />);
    await screen.findByRole('alertdialog', { name: 'GIF export unavailable' });
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByRole('alertdialog', { name: 'GIF export unavailable' });
    expect(calls).toBe(2);
    expect(screen.getByTestId('editor-still-here')).toBeInTheDocument();
  });

  it('offers hard reload only after an in-page retry has failed once', async () => {
    calls = 0;
    outcomes = [failOnce];
    const reload = vi.fn();
    render(
      <div>
        <div data-testid="editor-still-here">editor alive</div>
        <GifPanelGate
          scene={scene}
          sceneTitle="d1"
          onClose={() => undefined}
          onBlocked={() => undefined}
          showToast={() => undefined}
          loadPanel={loader}
          reloadApp={reload}
          persistenceStatus={() => ({ safe: true, reason: 'clean' })}
        />
      </div>,
    );
    await screen.findByRole('alertdialog', { name: 'GIF export unavailable' });
    // First failure: the in-page retry is the only offered action.
    expect(screen.queryByRole('button', { name: 'Reload editor' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByRole('alertdialog', { name: 'GIF export unavailable' });
    // A chunk whose first fetch failed stays failed in the module map for this
    // document, so the second failure must surface the documented recovery.
    const reloadButton = await screen.findByRole('button', { name: 'Reload editor' });
    fireEvent.click(reloadButton);
    // With a clean persistence verdict the guard lets the informed reload pass.
    expect(reload).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('editor-still-here')).toBeInTheDocument();
  });
});

describe('A1 — reload guard against unsaved work', () => {
  const host = (over: Partial<GifPanelGateProps>) => (
    <div>
      <div data-testid="editor-still-here">editor alive</div>
      <GifPanelGate
        scene={scene}
        sceneTitle="d1"
        onClose={() => undefined}
        onBlocked={() => undefined}
        showToast={() => undefined}
        loadPanel={loader}
        {...over}
      />
    </div>
  );

  const openFailingCard = async (over: Partial<GifPanelGateProps>) => {
    calls = 0;
    outcomes = [failOnce];
    render(host(over));
    await screen.findByRole('alertdialog', { name: 'GIF export unavailable' });
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByRole('alertdialog', { name: 'GIF export unavailable' });
    return screen.getByRole('button', { name: 'Reload editor' });
  };

  it('A: clean persistence reloads immediately, without any confirmation', async () => {
    const reload = vi.fn();
    const reloadButton = await openFailingCard({ reloadApp: reload, persistenceStatus: () => ({ safe: true, reason: 'clean' }) });
    fireEvent.click(reloadButton);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('group', { name: 'Reload confirmation' })).not.toBeInTheDocument();
  });

  it('B: unsaved changes block a silent reload and surface the informed choice', async () => {
    const reload = vi.fn();
    const reloadButton = await openFailingCard({ reloadApp: reload, persistenceStatus: () => ({ safe: false, reason: 'unsaved-changes' }) });
    fireEvent.click(reloadButton);
    expect(reload).not.toHaveBeenCalled();
    const group = await screen.findByRole('group', { name: 'Reload confirmation' });
    expect(group).toHaveTextContent(/unsaved/i);
    expect(within(group).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(within(group).getByRole('button', { name: 'Save and reload' })).toBeInTheDocument();
    expect(within(group).getByRole('button', { name: 'Reload without saving' })).toBeInTheDocument();
  });

  it('C: an in-flight write is treated as unsaved work too', async () => {
    const reloadButton = await openFailingCard({ reloadApp: vi.fn(), persistenceStatus: () => ({ safe: false, reason: 'save-in-flight' }) });
    fireEvent.click(reloadButton);
    await screen.findByRole('group', { name: 'Reload confirmation' });
  });

  it('D: a failed write offers save-retry and keeps the destructive path explicit', async () => {
    const reload = vi.fn();
    const save = vi.fn().mockResolvedValue(false);
    const reloadButton = await openFailingCard({ reloadApp: reload, saveBeforeReload: save, persistenceStatus: () => ({ safe: false, reason: 'write-failed' }) });
    fireEvent.click(reloadButton);
    const group = await screen.findByRole('group', { name: 'Reload confirmation' });
    fireEvent.click(within(group).getByRole('button', { name: 'Save and reload' }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    // The failed save must not reload and must say so; the card stays usable.
    await waitFor(() => expect(within(group).getByText(/could not be saved/i)).toBeInTheDocument());
    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByTestId('editor-still-here')).toBeInTheDocument();
  });

  it('F: cancel closes the confirmation with the editor untouched and nothing reloaded', async () => {
    const reload = vi.fn();
    const reloadButton = await openFailingCard({ reloadApp: reload, persistenceStatus: () => ({ safe: false, reason: 'unsaved-changes' }) });
    fireEvent.click(reloadButton);
    const group = await screen.findByRole('group', { name: 'Reload confirmation' });
    fireEvent.click(within(group).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Reload confirmation' })).not.toBeInTheDocument());
    expect(reload).not.toHaveBeenCalled();
    // The card keeps both recovery actions available after cancel.
    expect(screen.getByRole('button', { name: 'Reload editor' })).toBeInTheDocument();
  });

  it('G: the destructive choice reloads only after the explicit informed click', async () => {
    const reload = vi.fn();
    const reloadButton = await openFailingCard({ reloadApp: reload, persistenceStatus: () => ({ safe: false, reason: 'conflict-paused' }) });
    fireEvent.click(reloadButton);
    const group = await screen.findByRole('group', { name: 'Reload confirmation' });
    // A conflict-paused document must not offer a save (writes are latched off).
    expect(within(group).queryByRole('button', { name: 'Save and reload' })).not.toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();
    fireEvent.click(within(group).getByRole('button', { name: 'Reload without saving' }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('H: a save that lands proceeds to reload in one user action', async () => {
    const reload = vi.fn();
    const save = vi.fn().mockResolvedValue(true);
    const reloadButton = await openFailingCard({ reloadApp: reload, saveBeforeReload: save, persistenceStatus: () => ({ safe: false, reason: 'unsaved-changes' }) });
    fireEvent.click(reloadButton);
    const group = await screen.findByRole('group', { name: 'Reload confirmation' });
    fireEvent.click(within(group).getByRole('button', { name: 'Save and reload' }));
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  });

  it('J: no probe means no assumed-safe reload — the guard fails closed', async () => {
    const reload = vi.fn();
    const reloadButton = await openFailingCard({ reloadApp: reload });
    fireEvent.click(reloadButton);
    expect(reload).not.toHaveBeenCalled();
    await screen.findByRole('group', { name: 'Reload confirmation' });
  });
});
