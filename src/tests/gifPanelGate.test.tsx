// D1 — GIF panel gate: localized boundary, loading state, retry, cancellation.
// The lazy chunk is replaced through the gate's `loadPanel` seam (production
// never passes it); the contract pinned here is the gate's own: visible
// loading state, actionable failure card in the panel footprint, retry that
// re-attempts the load, close that hands dismissal back to the host, and a
// host that never blanks when the chunk is gone.
import React from 'react';
import '@testing-library/jest-dom';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
});
