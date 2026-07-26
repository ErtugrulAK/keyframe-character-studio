import React from 'react';
import { OutlinerPanel } from './OutlinerPanel';
import { DetailsPanel } from './DetailsPanel';
import './PropertyInspector.css';

export const PropertyInspector: React.FC = () => {
  return (
    <aside className="motion-design-right-sidebar">
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
