import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ChunkLoadBoundaryProps {
  children: ReactNode;
  /** Called once when the panel inside could not load or failed to render. */
  onError: (error: unknown) => void;
}

/**
 * A localized error boundary for a lazily loaded panel (the curve editor, the
 * graphic library). A chunk that fails to load — offline, or a page left open
 * across a new release whose chunk names changed — or a panel that throws
 * while rendering would otherwise unmount the whole editor. Here the panel
 * renders nothing and its owner is told, so it can close it and say why;
 * the document and the rest of the editor stay as they are.
 *
 * The GIF panel keeps its own boundary (`GifPanelGate`), which also offers a
 * retry and a guarded reload inside the panel's footprint.
 */
export class ChunkLoadBoundary extends Component<ChunkLoadBoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('[ChunkLoadBoundary] A lazily loaded panel failed.', error, info.componentStack);
    this.props.onError(error);
  }

  render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}
