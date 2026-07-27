import React, { useEffect } from 'react';
import { AnimatorProvider, useAnimator } from './context/AnimatorContext';
import { HeaderBar } from './components/Header/HeaderBar';
import { LeftToolbar } from './components/Toolbar/LeftToolbar';
import { StageCanvas } from './components/Canvas/StageCanvas';
import { PropertyInspector } from './components/Inspector/PropertyInspector';
import { SequencerTimeline } from './components/Timeline/SequencerTimeline';
import { LiveDirectorPanel } from './components/Broadcast/LiveDirectorPanel';

const MainAppContent: React.FC = () => {
  const { setIsPlaying, appMode } = useAnimator();

  // Keyboard shortcut: Spacebar toggles play/pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (appMode === 'broadcast') return; // Disable play/pause in broadcast mode
      // Don't trigger if typing inside input or select
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
      <div className="main-layout">
        {appMode === 'edit' && <LeftToolbar />}
        <StageCanvas />
        {appMode === 'edit' && <PropertyInspector />}
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
