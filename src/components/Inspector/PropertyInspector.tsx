import React, { useEffect, useState, useRef } from 'react';
import { OutlinerPanel } from './OutlinerPanel';
import { DetailsPanel } from './DetailsPanel';
import './PropertyInspector.css';

export const PropertyInspector: React.FC = () => {
  const [sidebarWidth, setSidebarWidth] = useState<number>(400);
  const [outlinerHeight, setOutlinerHeight] = useState<number>(240);
  const isResizingWidthRef = useRef<boolean>(false);
  const isResizingHeightRef = useRef<boolean>(false);
  useEffect(() => {
    const constrainForViewport = () => {
      const maxPanelWidth = Math.max(300, Math.floor(window.innerWidth * 0.34));
      setSidebarWidth((current) => Math.min(current, maxPanelWidth));
    };
    constrainForViewport();
    window.addEventListener('resize', constrainForViewport);
    return () => window.removeEventListener('resize', constrainForViewport);
  }, []);

  // Horizontal Width Resizer
  const handleWidthMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isResizingWidthRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isResizingWidthRef.current) return;
      const newWidth = window.innerWidth - ev.clientX;
      setSidebarWidth(Math.max(250, Math.min(750, newWidth)));
    };

    const handleMouseUp = () => {
      isResizingWidthRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Vertical Height Resizer (Outliner vs Details)
  const handleHeightMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isResizingHeightRef.current = true;
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';

    const startY = e.clientY;
    const startHeight = outlinerHeight;

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isResizingHeightRef.current) return;
      const deltaY = ev.clientY - startY;
      const newHeight = Math.max(100, Math.min(650, startHeight + deltaY));
      setOutlinerHeight(newHeight);
    };

    const handleMouseUp = () => {
      isResizingHeightRef.current = false;
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
      className="motion-design-right-sidebar"
      style={{
        width: `${sidebarWidth}px`,
        minWidth: `${sidebarWidth}px`,
        maxWidth: `${sidebarWidth}px`,
        flex: `0 0 ${sidebarWidth}px`,
      }}
    >
      {/* Left Vertical Resizer Drag Handle */}
      <div
        className="sidebar-left-resizer"
        onMouseDown={handleWidthMouseDown}
        title="Drag left/right to resize right panel width"
      />

      {/* Top Dock Pane: Outliner */}
      <div
        className="sidebar-dock-pane outliner-dock"
        style={{ height: `${outlinerHeight}px`, flex: 'none' }}
      >
        <OutlinerPanel />
      </div>

      {/* Horizontal Resizer Divider Bar */}
      <div
        className="sidebar-pane-divider"
        onMouseDown={handleHeightMouseDown}
        style={{ cursor: 'ns-resize' }}
        title="Drag up/down to resize Outliner and Details panel heights"
      />

      {/* Bottom Dock Pane: Details */}
      <div className="sidebar-dock-pane details-dock" style={{ flex: 1, overflow: 'hidden' }}>
        <DetailsPanel />
      </div>
    </aside>
  );
};
