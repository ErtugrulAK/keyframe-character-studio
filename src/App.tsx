import React, { useCallback, useEffect, useLayoutEffect } from 'react';
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
import { REFIT_UNTOUCHED_CAMERA_COMMAND, WORKSPACE_LAYOUT_COMMAND_EVENT, shouldOpenWithLeftDockClosed } from './utils/workspaceLayout';

import './kcsEditorTheme.css';

/*
 * C2 perf — a docked panel's edge eases through ~15 synchronous commits
 * (`commitWorkspaceLayout`), each re-rendering this shell. These surfaces take
 * no props and read the editor state from context, so memoizing them keeps a
 * dock frame to the panel's own width write; any real state change still
 * re-renders them through the context.
 */
const MemoHeaderBar = React.memo(HeaderBar);
const MemoAuthoringToolbar = React.memo(AuthoringToolbar);
const MemoStageCanvas = React.memo(StageCanvas);
const MemoSequencerTimeline = React.memo(SequencerTimeline);
const MemoLiveDirectorPanel = React.memo(LiveDirectorPanel);

const MainAppContent: React.FC = () => {
  const { appMode, modeSwapActive, finishModeSwap } = useAnimator();

  // The `kcs-mode-enter` chrome fade belongs to a mode TRANSITION, not to the
  // app's first paint: the shell carries `kcs-mode-swap` (raised by the mode
  // authority on a real change) only while the incoming surface animates, and
  // drops it as soon as the enter animation itself reports done.
  const handleModeSwapAnimationEnd = useCallback((event: React.AnimationEvent<HTMLDivElement>) => {
    if (event.animationName === 'kcs-mode-enter') finishModeSwap();
  }, [finishModeSwap]);
  const leftToolbar = useDockedPanelEdge(true, 'left');
  const inspector = useDockedPanelEdge(true, 'right');

  // C3 — a narrow (or browser-zoomed) window opens with the left dock closed
  // when the stage would otherwise be narrower than MIN_OPENING_STAGE_WIDTH.
  // Measured once from the real first layout, before the first paint (the
  // microtask runs before the browser paints, outside React's commit), then the
  // untouched opening camera is re-fitted to the wider stage. Never re-applied:
  // after this the dock opens and closes only when the user says so.
  const snapLeftDock = leftToolbar.snap;
  useLayoutEffect(() => {
    if (appMode !== 'edit') return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const stage = document.querySelector('.stage-canvas-container');
      if (!stage || !shouldOpenWithLeftDockClosed(stage.getBoundingClientRect().width)) return;
      snapLeftDock(false);
      window.dispatchEvent(new CustomEvent(WORKSPACE_LAYOUT_COMMAND_EVENT, { detail: { type: REFIT_UNTOUCHED_CAMERA_COMMAND } }));
    });
    return () => {
      cancelled = true;
    };
    // Mount only, by design.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    <div
      className={`app-container ${leftToolbar.visible ? '' : 'left-toolbar-hidden'} ${inspector.visible ? '' : 'inspector-hidden'} ${modeSwapActive ? 'kcs-mode-swap' : ''}`}
      onAnimationEnd={handleModeSwapAnimationEnd}
    >
      <MemoHeaderBar />
      {appMode === 'edit' && <MemoAuthoringToolbar />}
      <div className="main-layout">
        {appMode === 'edit' && (
          <LeftToolbar
            isHidden={!leftToolbar.visible}
            edgeStyle={leftToolbar.edgeStyle}
            panelRef={leftToolbar.panelRef}
          />
        )}
        <MemoStageCanvas />
        {appMode === 'edit' && (
          <PropertyInspector
            isHidden={!inspector.visible}
            edgeStyle={inspector.edgeStyle}
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
      {appMode === 'edit' ? <MemoSequencerTimeline /> : <MemoLiveDirectorPanel />}
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
