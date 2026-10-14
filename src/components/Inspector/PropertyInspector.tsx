import React, { useEffect, useState } from 'react';
import { panelEdgeStyle } from '../../utils/workspaceLayout';
import { OutlinerPanel } from './OutlinerPanel';
import { DetailsPanel } from './DetailsPanel';
import './PropertyInspector.css';

interface PropertyInspectorProps {
  isHidden: boolean;
  /**
   * The panel's border-box width while its edge is travelling, or null at rest.
   * The stylesheet owns both resting widths; this only overrides them for the
   * frames of a dock toggle, and it is committed together with the camera by
   * `useDockedPanelEdge`.
   */
  edgeWidth?: number | null;
  /** The docked panel element itself, so the shell can animate its edge. */
  panelRef?: React.Ref<HTMLElement>;
}

export const PropertyInspector: React.FC<PropertyInspectorProps> = ({ isHidden, edgeWidth = null, panelRef }) => {
  const [outlinerHeight, setOutlinerHeight] = useState<number>(240);
  useEffect(() => {
    const constrainForViewport = () => {
      setOutlinerHeight((height) => Math.min(height, Math.max(160, window.innerHeight - 320)));
    };
    constrainForViewport();
    window.addEventListener('resize', constrainForViewport);
    return () => window.removeEventListener('resize', constrainForViewport);
  }, []);

  // Vertical Height Resizer (Outliner vs Details)
  const handleHeightMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';

    const startY = e.clientY;
    const startHeight = outlinerHeight;
    const handleMouseMove = (ev: MouseEvent) => {
      const nextHeight = Math.max(100, Math.min(650, startHeight + (ev.clientY - startY)));
      setOutlinerHeight(nextHeight);
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
  return (
    <aside
      id="right-inspector-panel"
      ref={panelRef}
      className={`motion-design-right-sidebar ${isHidden ? 'is-hidden' : ''}`}
      aria-hidden={isHidden}
      inert={isHidden ? true : undefined}
      style={panelEdgeStyle(edgeWidth)}
    >
      <div
        className="sidebar-dock-pane outliner-dock"
        style={{ height: `${outlinerHeight}px`, flex: 'none' }}
      >
        <OutlinerPanel />
      </div>

      <div
        className="sidebar-pane-divider"
        onMouseDown={handleHeightMouseDown}
        style={{ cursor: 'ns-resize' }}
        title="Drag up/down to resize Outliner and Details panel heights"
      />

      <div className="sidebar-dock-pane details-dock" style={{ flex: 1, overflow: 'hidden' }}>
        <DetailsPanel />
      </div>
    </aside>
  );
};
