import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GraphicLibraryDialog } from '../components/Header/GraphicLibraryDialog';
import type { LibraryEntrySummary, ProjectLibrary } from '../utils/persistence/projectLibrary';

/**
 * The graphic library dialog: every library call that can fail (the store is
 * IndexedDB, which a private window or blocked site data refuses) ends in a
 * visible status, never in a silent no-op; opening adds a tab and closes.
 */
const entry: LibraryEntrySummary = { id: 'g1', name: 'Lower Third', layerCount: 3, updatedAt: Date.UTC(2026, 10, 12) } as LibraryEntrySummary;

const makeLibrary = (overrides: Partial<ProjectLibrary> = {}): ProjectLibrary => ({
  list: vi.fn(async () => [entry]),
  open: vi.fn(async () => ({ name: 'Lower Third', scene: '{"layers":[]}' })),
  save: vi.fn(async () => undefined),
  remove: vi.fn(async () => undefined),
  duplicate: vi.fn(async () => undefined),
  ...overrides,
} as unknown as ProjectLibrary);

const renderDialog = (library: ProjectLibrary, openGraphic = vi.fn(() => true), onClose = vi.fn()) => {
  render(
    <GraphicLibraryDialog
      isOpen
      library={library}
      currentName="Current"
      exportCurrent={() => '{}'}
      openGraphic={openGraphic}
      onClose={onClose}
    />,
  );
  return { openGraphic, onClose };
};

const status = () => screen.getByTestId('graphic-library-status').textContent;

afterEach(cleanup);

describe('GraphicLibraryDialog', () => {
  it('lists the saved graphics with their layer count', async () => {
    renderDialog(makeLibrary());
    expect(await screen.findByText('Lower Third')).toBeTruthy();
    expect(screen.getByText(/3 layers/)).toBeTruthy();
  });

  it('opening a graphic adds it as a tab and closes the dialog', async () => {
    const { openGraphic, onClose } = renderDialog(makeLibrary());
    fireEvent.click(await screen.findByRole('button', { name: 'Open Lower Third' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(openGraphic).toHaveBeenCalledWith('Lower Third', '{"layers":[]}');
  });

  it('a read that fails says so instead of doing nothing', async () => {
    const { openGraphic, onClose } = renderDialog(makeLibrary({ open: vi.fn(async () => { throw new Error('blocked'); }) }));
    fireEvent.click(await screen.findByRole('button', { name: 'Open Lower Third' }));
    await waitFor(() => expect(status()).toContain('could not be read from the library'));
    expect(openGraphic).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('a graphic that is gone says so and refreshes the list', async () => {
    const library = makeLibrary({ open: vi.fn(async () => undefined) });
    renderDialog(library);
    fireEvent.click(await screen.findByRole('button', { name: 'Open Lower Third' }));
    await waitFor(() => expect(status()).toBe('“Lower Third” is no longer in the library.'));
    expect(library.list).toHaveBeenCalledTimes(2);
  });

  it('a scene the import check refuses keeps the dialog open with the reason', async () => {
    const { onClose } = renderDialog(makeLibrary(), vi.fn(() => false));
    fireEvent.click(await screen.findByRole('button', { name: 'Open Lower Third' }));
    await waitFor(() => expect(status()).toContain('was refused by the import check'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('an unreadable library shows an empty list and the reason', async () => {
    renderDialog(makeLibrary({ list: vi.fn(async () => { throw new Error('blocked'); }) }));
    await waitFor(() => expect(status()).toContain('could not be read in this browser'));
    expect(screen.getByText(/Nothing saved yet/)).toBeTruthy();
  });

  it('a failed save says nothing was changed', async () => {
    renderDialog(makeLibrary({ save: vi.fn(async () => { throw new Error('quota'); }) }));
    await screen.findByText('Lower Third');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save current graphic' }));
    });
    await waitFor(() => expect(status()).toContain('Nothing was changed'));
  });

  it('delete asks once more in the row, and Keep cancels it', async () => {
    const library = makeLibrary();
    renderDialog(library);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Lower Third' }));
    expect(screen.getByText('Delete for good?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }));
    expect(library.remove).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Open Lower Third' })).toBeTruthy();
  });
});
