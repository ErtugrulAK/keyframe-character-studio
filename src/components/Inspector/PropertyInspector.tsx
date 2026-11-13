import React, { useCallback, useEffect, useState } from 'react';
import { outlinerHeightBounds, resolveOutlinerHeight } from '../../utils/editor/workspaceLayout';
import { OutlinerPanel } from './OutlinerPanel';
import { useRetainedUiState } from '../../hooks/useRetainedUiState';
import { DetailsPanel } from './DetailsPanel';
import './PropertyInspector.css';

// C2 perf — the panel re-renders for every frame of its own edge animation;
// its two context-driven panes do not depend on that width.
const MemoOutlinerPanel = React.memo(OutlinerPanel);
const MemoDetailsPanel = React.memo(DetailsPanel);

interface PropertyInspectorProps {
  isHidden: boolean;
  /**
   * The panel's inline style while it slides (lifted out of the row, see
   * `useDockedPanelEdge`), or undefined at rest. The stylesheet owns both
   * resting geometries.
   */
  edgeStyle?: React.CSSProperties;
  /** The docked panel element itself, so the shell can animate its edge. */
  panelRef?: React.Ref<HTMLElement>;
}

export const PropertyInspector: React.FC<PropertyInspectorProps> = ({ isHidden, edgeStyle, panelRef }) => {
  const [outlinerHeight, setOutlinerHeight] = useRetainedUiState<number>('inspector.outlinerHeight', 240);
  // Set once the user sizes the split; from then on their height wins
  // over the short-window caps (see `resolveOutlinerHeight`).
  const [userSized, setUserSized] = useRetainedUiState<boolean>('inspector.outlinerUserSized', false);
  const [restoreHeight, setRestoreHeight] = useRetainedUiState<number | null>('inspector.outlinerRestoreHeight', null);
  // The sidebar's real height (the Outliner pane's parent), observed so
  // the Details pane keeps a usable height in short windows.
  const [sidebarElement, setSidebarElement] = useState<HTMLElement | null>(null);
  const [sidebarHeight, setSidebarHeight] = useState<number | null>(null);
  const outlinerPaneRef = useCallback((element: HTMLElement | null) => {
    setSidebarElement(element?.parentElement ?? null);
  }, []);
  useEffect(() => {
    if (!sidebarElement || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => setSidebarHeight(sidebarElement.clientHeight));
    observer.observe(sidebarElement);
    return () => observer.disconnect();
  }, [sidebarElement]);
  // The window height only matters when the sidebar cannot hold both panes
  // (see `resolveOutlinerHeight`); it is read on resize, never written back.
  const [windowHeight, setWindowHeight] = useState<number>(() => window.innerHeight);
  useEffect(() => {
    const onResize = () => setWindowHeight(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const shownHeight = resolveOutlinerHeight(outlinerHeight, sidebarHeight, windowHeight, userSized);
  const bounds = outlinerHeightBounds(sidebarHeight);
  const sizeTo = (height: number) => {
    setUserSized(true);
    setOutlinerHeight(Math.round(Math.max(bounds.min, Math.min(bounds.max, height))));
  };

  // Vertical Height Resizer (Outliner vs Details). It starts from the height on
  // screen (never a stored value a cap was hiding), so the edge never jumps.
  const handleHeightMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';

    const startY = e.clientY;
    const startHeight = shownHeight;
    const handleMouseMove = (ev: MouseEvent) => {
      sizeTo(startHeight + (ev.clientY - startY));
    };
    const handleMouseUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };
  /*
   * The split is a real window splitter (WAI-ARIA "separator"): it is a
   * Tab stop with a name and its value, ↑/↓ move it (Shift: faster),
   * Home/End go to the smallest/largest layer list, and Enter (or a
   * double-click) gives the list all the room it can have and back again.
   */
  const isListMaximized = shownHeight >= bounds.max - 1;
  /** Gives the list all the room, remembering the split it came from. */
  const maximizeList = () => {
    if (!isListMaximized) setRestoreHeight(shownHeight);
    sizeTo(bounds.max);
  };
  const toggleListMaximized = () => {
    if (isListMaximized) {
      sizeTo(restoreHeight ?? 240);
      setRestoreHeight(null);
      return;
    }
    maximizeList();
  };
  const handleDividerKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 64 : 16;
    let next: number | null = null;
    if (event.key === 'ArrowDown') next = shownHeight + step;
    else if (event.key === 'ArrowUp') next = shownHeight - step;
    else if (event.key === 'Home') next = bounds.min;
    else if (event.key === 'End') {
      event.preventDefault();
      event.stopPropagation();
      maximizeList();
      return;
    }
    else if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      toggleListMaximized();
      return;
    }
    if (next === null) return;
    event.preventDefault();
    event.stopPropagation();
    sizeTo(next);
  };

  return (
    <aside
      id="right-inspector-panel"
      ref={panelRef}
      className={`motion-design-right-sidebar ${isHidden ? 'is-hidden' : ''}`}
      aria-hidden={isHidden}
      inert={isHidden ? true : undefined}
      style={edgeStyle}
    >
      <div
        ref={outlinerPaneRef}
        className="sidebar-dock-pane outliner-dock"
        style={{ height: `${shownHeight}px`, flex: 'none' }}
      >
        <MemoOutlinerPanel />
      </div>

      <div
        className="sidebar-pane-divider"
        role="separator"
        tabIndex={0}
        aria-orientation="horizontal"
        aria-label="Resize layer list and Details"
        aria-controls="right-inspector-panel"
        aria-valuemin={bounds.min}
        aria-valuemax={bounds.max}
        aria-valuenow={shownHeight}
        aria-valuetext={`Layer list ${shownHeight} pixels tall`}
        data-testid="inspector-split-divider"
        onMouseDown={handleHeightMouseDown}
        onDoubleClick={toggleListMaximized}
        onKeyDown={handleDividerKeyDown}
        style={{ cursor: 'ns-resize' }}
        title="Drag (or ↑/↓) to share the height between the layer list and Details · double-click or Enter: give the layer list all the room, and back"
      />

      <div className="sidebar-dock-pane details-dock" style={{ flex: 1, overflow: 'hidden' }}>
        <MemoDetailsPanel />
      </div>
    </aside>
  );
};
