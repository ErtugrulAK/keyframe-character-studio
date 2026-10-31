import React, { useState } from 'react';
import { useAnimatorSlice } from '../../context/useAnimator';
import { ProjectDrawer } from './drawers/ProjectDrawer';
import { MediaDrawer } from './drawers/MediaDrawer';
import { ElementsDrawer } from './drawers/ElementsDrawer';
import { TextsDrawer } from './drawers/TextsDrawer';
import {
  Type,
  Square,
  Layout,
  Monitor,
} from 'lucide-react';
import './LeftToolbar.css';

type ActiveNavCategory = 'project' | 'media' | 'texts' | 'shapes';

interface LeftToolbarProps {
  isHidden?: boolean;
  /**
   * The dock's inline style while it slides (lifted out of the row, see
   * `useDockedPanelEdge`), or undefined at rest. The stylesheet owns both
   * resting geometries.
   */
  edgeStyle?: React.CSSProperties;
  /** The docked panel element itself, so the shell can animate its edge. */
  panelRef?: React.Ref<HTMLElement>;
}

export const LeftToolbar: React.FC<LeftToolbarProps> = ({ isHidden = false, edgeStyle, panelRef }) => {
  const { activeTool } = useAnimatorSlice('activeTool');
  const [activeCategory, setActiveCategory] = useState<ActiveNavCategory>('media');
  // UI-only category state remains local so collapse never changes the active tool.
  const isCapturing = activeTool === 'shape_create' || activeTool === 'freeform_draw';

  return (
    <aside
      id="left-toolbar-panel"
      ref={panelRef}
      className={`left-toolbar-container${isHidden ? ' hidden' : ''}${isCapturing ? ' tool-capturing' : ''}`}
      aria-hidden={isHidden}
      inert={isHidden ? true : undefined}
      style={edgeStyle}
    >

      <div className="left-sidebar-nav">
        <button
          className={`sidebar-nav-item ${activeCategory === 'project' ? 'active' : ''}`}
          onClick={() => setActiveCategory('project')}
          aria-label="Project Workspace"
          aria-pressed={activeCategory === 'project'}
        >
          <Layout size={20} className="nav-icon" />
          <span className="nav-label">Project</span>
        </button>

        <button
          className={`sidebar-nav-item ${activeCategory === 'media' ? 'active' : ''}`}
          onClick={() => setActiveCategory('media')}
          aria-label="Media Assets"
          aria-pressed={activeCategory === 'media'}
        >
          <Monitor size={20} className="nav-icon" />
          <span className="nav-label">Media</span>
        </button>

        <button
          className={`sidebar-nav-item ${activeCategory === 'shapes' ? 'active' : ''}`}
          onClick={() => setActiveCategory('shapes')}
          aria-label="Vector Shapes & Graphic Elements"
          aria-pressed={activeCategory === 'shapes'}
        >
          <Square size={20} className="nav-icon" />
          <span className="nav-label">Elements</span>
        </button>

        <button
          className={`sidebar-nav-item ${activeCategory === 'texts' ? 'active' : ''}`}
          onClick={() => setActiveCategory('texts')}
          aria-label="Typography & Headlines"
          aria-pressed={activeCategory === 'texts'}
        >
          <Type size={20} className="nav-icon" />
          <span className="nav-label">Texts</span>
        </button>

      </div>

      <div className="left-drawer-panel" aria-hidden={isHidden}>
        {activeCategory === 'project' && <ProjectDrawer />}
        {activeCategory === 'media' && <MediaDrawer />}
        {activeCategory === 'shapes' && <ElementsDrawer />}
        {activeCategory === 'texts' && <TextsDrawer />}
      </div>
      </aside>
  );
};
