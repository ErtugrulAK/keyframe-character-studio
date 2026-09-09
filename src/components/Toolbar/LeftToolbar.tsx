import React, { useState } from 'react';
import { useAnimator } from '../../context/AnimatorContext';
import { ProjectDrawer } from './drawers/ProjectDrawer';
import { MediaDrawer } from './drawers/MediaDrawer';
import { ElementsDrawer } from './drawers/ElementsDrawer';
import { TextsDrawer } from './drawers/TextsDrawer';
import {
  Type,
  Square,
  Layout,
  Monitor,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import './LeftToolbar.css';

type ActiveNavCategory = 'project' | 'media' | 'texts' | 'shapes';

export const LeftToolbar: React.FC = () => {
  const { activeTool } = useAnimator();
  const [activeCategory, setActiveCategory] = useState<ActiveNavCategory>('media');
  // UI-only layout state: collapsing hides the drawer so the canvas gets the
  // space. It never touches tool/selection/keyframe/playback/scene state.
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside className={`left-toolbar-container${isCollapsed ? ' collapsed' : ''}${activeTool === 'shape_create' || activeTool === 'freeform_draw' ? ' tool-capturing' : ''}`}>
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

        {/* Collapse / Expand toggle — always visible (collapsed state keeps a
            reachable control). Pure layout state; the active nav category is
            preserved so re-expanding restores the exact previous drawer. */}
        <button
          type="button"
          className="sidebar-handle left-toolbar-toggle"
          onClick={() => setIsCollapsed((c) => !c)}
          aria-label={isCollapsed ? 'Show Left Toolbar' : 'Hide Left Toolbar'}
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      <div className="left-drawer-panel" aria-hidden={isCollapsed}>
        {activeCategory === 'project' && <ProjectDrawer />}
        {activeCategory === 'media' && <MediaDrawer />}
        {activeCategory === 'shapes' && <ElementsDrawer />}
        {activeCategory === 'texts' && <TextsDrawer />}
      </div>
      </aside>
  );
};
