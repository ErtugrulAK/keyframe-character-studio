import React, { useEffect, useState } from 'react';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import { AnimatorProvider, useAnimator } from './context/AnimatorContext';
import { HeaderBar } from './components/Header/HeaderBar';
import { LeftToolbar } from './components/Toolbar/LeftToolbar';
import { StageCanvas } from './components/Canvas/StageCanvas';
import { PropertyInspector } from './components/Inspector/PropertyInspector';
import { SequencerTimeline } from './components/Timeline/SequencerTimeline';
import { LiveDirectorPanel } from './components/Broadcast/LiveDirectorPanel';

const MainAppContent: React.FC = () => {
  const { setIsPlaying, appMode } = useAnimator();
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
      <div className={`main-layout ${isInspectorVisible ? '' : 'inspector-hidden'}`}>
        {appMode === 'edit' && <LeftToolbar />}
        <StageCanvas />
        {appMode === 'edit' && (
          <button
            type="button"
            className="inspector-dock-toggle"
            aria-label={isInspectorVisible ? 'Hide Inspector' : 'Show Inspector'}
            title={isInspectorVisible ? 'Hide Inspector' : 'Show Inspector'}
            onClick={() => setIsInspectorVisible((visible) => !visible)}
          >
            {isInspectorVisible ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
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
