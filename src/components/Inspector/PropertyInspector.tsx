import React, { useState, useRef } from 'react';
import { OutlinerPanel } from './OutlinerPanel';
import { DetailsPanel } from './DetailsPanel';
import './PropertyInspector.css';

export const PropertyInspector: React.FC = () => {
  const [sidebarWidth, setSidebarWidth] = useState<number>(360);
  const isResizingRef = useRef<boolean>(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isResizingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isResizingRef.current) return;
      const newWidth = window.innerWidth - ev.clientX;
      setSidebarWidth(Math.max(250, Math.min(750, newWidth)));
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
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
        onMouseDown={handleMouseDown}
        title="Drag left/right to resize right panel width"
      />

      {/* Top Dock Pane: Unreal Motion Design Outliner */}
      <div className="sidebar-dock-pane outliner-dock">
        <OutlinerPanel />
      </div>

      {/* Resizer Divider Bar */}
      <div className="sidebar-pane-divider" />

      {/* Bottom Dock Pane: Unreal Motion Design Details */}
      <div className="sidebar-dock-pane details-dock">
        <DetailsPanel />
      </div>
    </aside>
  );
};
