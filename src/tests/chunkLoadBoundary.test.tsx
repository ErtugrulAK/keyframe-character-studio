import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { Suspense, lazy } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChunkLoadBoundary } from '../components/Shared/ChunkLoadBoundary';

/**
 * A lazily loaded panel that cannot load (or throws while rendering) is
 * contained: the panel renders nothing, its owner is told once, and whatever
 * sits next to the boundary keeps rendering.
 */
afterEach(cleanup);

const Sibling = () => <p>editor still here</p>;

describe('ChunkLoadBoundary', () => {
  it('renders the panel when it loads', async () => {
    const Panel = lazy(async () => ({ default: () => <p>panel</p> }));
    const onError = vi.fn();
    render(<><Sibling /><ChunkLoadBoundary onError={onError}><Suspense fallback={null}><Panel /></Suspense></ChunkLoadBoundary></>);
    expect(await screen.findByText('panel')).toBeTruthy();
    expect(onError).not.toHaveBeenCalled();
  });

  it('contains a chunk that fails to load and tells the owner once', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const Panel = lazy(() => Promise.reject(new TypeError('Failed to fetch dynamically imported module')));
    const onError = vi.fn();
    render(<><Sibling /><ChunkLoadBoundary onError={onError}><Suspense fallback={null}><Panel /></Suspense></ChunkLoadBoundary></>);
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onError.mock.calls[0][0]).toBeInstanceOf(TypeError);
    expect(screen.getByText('editor still here')).toBeTruthy();
  });

  it('contains a panel that throws while rendering', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const Broken = () => { throw new Error('render failed'); };
    const onError = vi.fn();
    render(<><Sibling /><ChunkLoadBoundary onError={onError}><Broken /></ChunkLoadBoundary></>);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(screen.getByText('editor still here')).toBeTruthy();
  });
});
