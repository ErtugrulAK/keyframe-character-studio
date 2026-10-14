import React, { useEffect } from 'react';
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
import { useDockedPanelEdge } from './hooks/useDockedPanelEdge';

import './kcsEditorTheme.css';
const MainAppContent: React.FC = () => {
  const { appMode } = useAnimator();
  const leftToolbar = useDockedPanelEdge(true);
  const inspector = useDockedPanelEdge(true);

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
    <div className={`app-container ${leftToolbar.visible ? '' : 'left-toolbar-hidden'} ${inspector.visible ? '' : 'inspector-hidden'}`}>
      <HeaderBar />
      {appMode === 'edit' && <AuthoringToolbar />}
      <div className="main-layout">
        {appMode === 'edit' && (
          <LeftToolbar
            isHidden={!leftToolbar.visible}
            edgeWidth={leftToolbar.edgeWidth}
            panelRef={leftToolbar.panelRef}
          />
        )}
        <StageCanvas />
        {appMode === 'edit' && (
          <PropertyInspector
            isHidden={!inspector.visible}
            edgeWidth={inspector.edgeWidth}
            panelRef={inspector.panelRef}
          />
        )}
        {appMode === 'edit' && (
          <button
            type="button"
            className="sidebar-handle left-toolbar-toggle"
            aria-label={leftToolbar.visible ? 'Hide Left Toolbar' : 'Show Left Toolbar'}
            aria-expanded={leftToolbar.visible}
            aria-controls="left-toolbar-panel"
            onClick={leftToolbar.toggle}
          >
            {leftToolbar.visible ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
          </button>
        )}
        {appMode === 'edit' && (
          <button
            type="button"
            className="sidebar-handle inspector-dock-toggle"
            aria-label={inspector.visible ? 'Hide Inspector' : 'Show Inspector'}
            aria-expanded={inspector.visible}
            aria-controls="right-inspector-panel"
            onClick={inspector.toggle}
          >
            {inspector.visible ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
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
