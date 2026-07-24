import React, { useState } from 'react';
import { ProjectDrawer } from './drawers/ProjectDrawer';
import { MediaDrawer } from './drawers/MediaDrawer';
import { ElementsDrawer } from './drawers/ElementsDrawer';
import { TextsDrawer } from './drawers/TextsDrawer';
import { TransitionsDrawer } from './drawers/TransitionsDrawer';
import { KeyframesDrawer } from './drawers/KeyframesDrawer';
import { PresetsTab } from '../Inspector/sections/PresetsTab';
import {
  Type,
  Gem,
  Square,
  Layout,
  Sparkles,
  Zap,
  Monitor,
} from 'lucide-react';
import './LeftToolbar.css';

type ActiveNavCategory = 'project' | 'media' | 'keyframes' | 'texts' | 'shapes' | 'presets' | 'transitions';

export const LeftToolbar: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<ActiveNavCategory>('media');

  return (
    <aside className="left-toolbar-container">
      <div className="left-sidebar-nav">
        <button
          className={`sidebar-nav-item ${activeCategory === 'project' ? 'active' : ''}`}
          onClick={() => setActiveCategory('project')}
          title="Project & Composition Settings"
        >
          <Monitor size={20} className="nav-icon text-cyan" />
          <span className="nav-label">Project</span>
        </button>

        <button
          className={`sidebar-nav-item ${activeCategory === 'media' ? 'active' : ''}`}
          onClick={() => setActiveCategory('media')}
          title="Media Library"
        >
          <Layout size={20} className="nav-icon" />
          <span className="nav-label">Media</span>
        </button>

        <button
          className={`sidebar-nav-item ${activeCategory === 'shapes' ? 'active' : ''}`}
          onClick={() => setActiveCategory('shapes')}
          title="Shapes & Elements"
        >
          <Square size={20} className="nav-icon text-purple" />
          <span className="nav-label">Elements</span>
        </button>

        <button
          className={`sidebar-nav-item ${activeCategory === 'texts' ? 'active' : ''}`}
          onClick={() => setActiveCategory('texts')}
          title="Text Labels"
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

        <button
          className={`sidebar-nav-item ${activeCategory === 'presets' ? 'active' : ''}`}
          onClick={() => setActiveCategory('presets')}
          title="My Custom Saved Presets Library"
        >
          <Sparkles size={20} className="nav-icon text-gold" />
          <span className="nav-label">Presets</span>
        </button>

        <button
          className={`sidebar-nav-item ${activeCategory === 'keyframes' ? 'active' : ''}`}
          onClick={() => setActiveCategory('keyframes')}
          title="Keyframe Tools"
        >
          <Gem size={20} className="nav-icon text-gold" />
          <span className="nav-label">Keyframes</span>
        </button>
      </div>

      <div className="left-drawer-panel">
        {activeCategory === 'project' && <ProjectDrawer />}
        {activeCategory === 'media' && <MediaDrawer />}
        {activeCategory === 'shapes' && <ElementsDrawer />}
        {activeCategory === 'texts' && <TextsDrawer />}
        {activeCategory === 'transitions' && <TransitionsDrawer />}
        {activeCategory === 'presets' && (
          <div className="drawer-content" style={{ padding: '12px 14px' }}>
            <PresetsTab />
          </div>
        )}
        {activeCategory === 'keyframes' && <KeyframesDrawer />}
      </div>
    </aside>
  );
};
