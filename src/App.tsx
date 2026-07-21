import React, { useEffect } from 'react';
import { AnimatorProvider, useAnimator } from './context/AnimatorContext';
import { HeaderBar } from './components/Header/HeaderBar';
import { LeftToolbar } from './components/Toolbar/LeftToolbar';
import { StageCanvas } from './components/Canvas/StageCanvas';
import { PropertyInspector } from './components/Inspector/PropertyInspector';
import { SequencerTimeline } from './components/Timeline/SequencerTimeline';
import './App.css';

const MainAppContent: React.FC = () => {
  const { setIsPlaying } = useAnimator();

  // Keyboard shortcut: Spacebar toggles play/pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
  }, [setIsPlaying]);

  return (
    <div className="app-container">
      <HeaderBar />
      <div className="main-layout">
        <LeftToolbar />
        <StageCanvas />
        <PropertyInspector />
      </div>
      <SequencerTimeline />
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
