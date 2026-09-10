import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AnimatorProvider, useAnimator } from './context/AnimatorContext';
import { HeaderBar } from './components/Header/HeaderBar';
import { LeftToolbar } from './components/Toolbar/LeftToolbar';
import { StageCanvas } from './components/Canvas/StageCanvas';
import { PropertyInspector } from './components/Inspector/PropertyInspector';
import { SequencerTimeline } from './components/Timeline/SequencerTimeline';
import { LiveDirectorPanel } from './components/Broadcast/LiveDirectorPanel';

import './kcsEditorTheme.css';
const MainAppContent: React.FC = () => {
  const { setIsPlaying, appMode } = useAnimator();
  const [isLeftToolbarVisible, setIsLeftToolbarVisible] = useState(true);
  const [isInspectorVisible, setIsInspectorVisible] = useState(true);

  // Keyboard shortcut: Spacebar toggles play/pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (appMode === 'broadcast') return;
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setIsPlaying, appMode]);

  return (
    <div className="app-container">
      <HeaderBar />
      <div className={`main-layout ${isLeftToolbarVisible ? '' : 'left-toolbar-hidden'} ${isInspectorVisible ? '' : 'inspector-hidden'}`}>
        {appMode === 'edit' && (
          <button
            type="button"
            className="sidebar-handle left-toolbar-toggle"
            aria-label={isLeftToolbarVisible ? 'Hide Left Toolbar' : 'Show Left Toolbar'}
            aria-expanded={isLeftToolbarVisible}
            aria-controls="left-toolbar-panel"
            onClick={() => setIsLeftToolbarVisible((visible) => !visible)}
          >
            {isLeftToolbarVisible ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
          </button>
        )}
        {appMode === 'edit' && <LeftToolbar isHidden={!isLeftToolbarVisible} />}
        <StageCanvas />
        {appMode === 'edit' && (
          <button
            type="button"
            className="sidebar-handle inspector-dock-toggle"
            aria-label={isInspectorVisible ? 'Hide Inspector' : 'Show Inspector'}
            aria-expanded={isInspectorVisible}
            aria-controls="right-inspector-panel"
            onClick={() => setIsInspectorVisible((visible) => !visible)}
          >
            {isInspectorVisible ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        )}
        {appMode === 'edit' && (
          <PropertyInspector
            isHidden={!isInspectorVisible}
          />
        )}
      </div>
      {appMode === 'edit' ? <SequencerTimeline /> : <LiveDirectorPanel />}
    </div>
  );
};

export function App() {
  return (
    <AnimatorProvider>
      <MainAppContent />
    </AnimatorProvider>
  );
}

export default App;
