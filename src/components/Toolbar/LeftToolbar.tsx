import React, { useState } from 'react';
import { ProjectDrawer } from './drawers/ProjectDrawer';
import { MediaDrawer } from './drawers/MediaDrawer';
import { ElementsDrawer } from './drawers/ElementsDrawer';
import { TextsDrawer } from './drawers/TextsDrawer';
import { TransitionsDrawer } from './drawers/TransitionsDrawer';
import {
  Type,
  Square,
  Layout,
  Zap,
  Monitor,
} from 'lucide-react';
import './LeftToolbar.css';

type ActiveNavCategory = 'project' | 'media' | 'texts' | 'shapes' | 'transitions';

export const LeftToolbar: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<ActiveNavCategory>('media');

  return (
    <aside className="left-toolbar-container">
      <div className="left-sidebar-nav">
        <button
          className={`sidebar-nav-item ${activeCategory === 'project' ? 'active' : ''}`}
          onClick={() => setActiveCategory('project')}
          title="Project Workspace"
        >
          <Layout size={20} className="nav-icon text-teal" />
          <span className="nav-label">Project</span>
        </button>

        <button
          className={`sidebar-nav-item ${activeCategory === 'media' ? 'active' : ''}`}
          onClick={() => setActiveCategory('media')}
          title="Media Assets"
        >
          <Monitor size={20} className="nav-icon text-teal" />
          <span className="nav-label">Media</span>
        </button>

        <button
          className={`sidebar-nav-item ${activeCategory === 'shapes' ? 'active' : ''}`}
          onClick={() => setActiveCategory('shapes')}
          title="Vector Shapes & Graphic Elements"
        >
          <Square size={20} className="nav-icon text-cyan" />
          <span className="nav-label">Elements</span>
        </button>

        <button
          className={`sidebar-nav-item ${activeCategory === 'texts' ? 'active' : ''}`}
          onClick={() => setActiveCategory('texts')}
          title="Typography & Headlines"
        >
          <Type size={20} className="nav-icon text-cyan" />
          <span className="nav-label">Texts</span>
        </button>

        <button
          className={`sidebar-nav-item ${activeCategory === 'transitions' ? 'active' : ''}`}
          onClick={() => setActiveCategory('transitions')}
          title="Motion Transitions"
        >
          <Zap size={20} className="nav-icon text-teal" />
          <span className="nav-label">Transitions</span>
        </button>
      </div>

      <div className="left-drawer-panel">
        {activeCategory === 'project' && <ProjectDrawer />}
        {activeCategory === 'media' && <MediaDrawer />}
        {activeCategory === 'shapes' && <ElementsDrawer />}
        {activeCategory === 'texts' && <TextsDrawer />}
        {activeCategory === 'transitions' && <TransitionsDrawer />}
      </div>
    </aside>
  );
};
