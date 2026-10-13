import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AnimatorProvider } from './context/AnimatorContext';
import { EditorContextMenuProvider } from './context/EditorContextMenuContext';
import { useAnimator } from './context/useAnimator';
import { HeaderBar } from './components/Header/HeaderBar';
import { AuthoringToolbar } from './components/Toolbar/AuthoringToolbar';
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

  // R2-07 — the browser's native context menu is suppressed for the whole
  // editor: canvas, layer list, sequence tabs, toolbar, timeline, Details and
  // every text field. The listener runs in the CAPTURE phase on `document`, so
  // it always gets there first: no component can right-click its way around it,
  // and the editor's own handlers still call `preventDefault` themselves without
  // harm. It deliberately does NOT stop propagation, so KCS's custom right-click
  // menus (canvas, layer, keyframe, lane paste) still open exactly as before.
  // Outside the app — browser chrome — nothing changes.
  useEffect(() => {
    const suppressNativeContextMenu = (event: MouseEvent) => event.preventDefault();
    document.addEventListener('contextmenu', suppressNativeContextMenu, true);
    return () => document.removeEventListener('contextmenu', suppressNativeContextMenu, true);
  }, []);

  return (
    /*
     * R3-02 / R4-01 — the two dock handles are children of the editor WORKSPACE
     * ROW (`.main-layout`), the box the timeline resize shortens from below. The
     * row's TOP edge never moves — only its height does — so a handle pinned a
     * fixed distance below that edge keeps the same vertical centre at every
     * timeline height, and can never be dragged over the timeline the way a
     * viewport-50% anchor could be in a short window. The shell (`app-container`)
     * still owns the two panel visibility flags whose edge geometry the handles
     * read, and the panel geometry tokens they measure.
     */
    <div className={`app-container ${isLeftToolbarVisible ? '' : 'left-toolbar-hidden'} ${isInspectorVisible ? '' : 'inspector-hidden'}`}>
      <HeaderBar />
      {appMode === 'edit' && <AuthoringToolbar />}
      <div className="main-layout">
        {appMode === 'edit' && <LeftToolbar isHidden={!isLeftToolbarVisible} />}
        <StageCanvas />
        {appMode === 'edit' && (
          <PropertyInspector
            isHidden={!isInspectorVisible}
          />
        )}
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
      </div>
      {appMode === 'edit' ? <SequencerTimeline /> : <LiveDirectorPanel />}
    </div>
  );
};

export function App() {
  return (
    <AnimatorProvider>
      <EditorContextMenuProvider>
        <MainAppContent />
      </EditorContextMenuProvider>
    </AnimatorProvider>
  );
}

export default App;
