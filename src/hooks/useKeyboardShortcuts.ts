import { useEffect, useRef } from 'react';
import type { AppMode, BodyPartType, ToolType } from '../types/animator';
import { isBlockingModalOpen } from '../utils/modalBoundary';
import { isEditableElement, ownsShortcutScope } from '../utils/keyboardFocus';
import {
  detectShortcutPlatform,
  resolveShortcutCommand,
  type ShortcutCommandId,
  type ShortcutPlatform,
} from '../utils/shortcuts';
import type { FlipAxis, RotateDirection } from '../utils/vectorArrange';

/**
 * The commands the editor's global keyboard handler can run. Callers provide
 * the ones they own; a command with no handler is simply inert.
 */
export interface EditorShortcutCommands {
  selectedPartId: string | null;
  undo: () => void;
  redo: () => void;
  copySelectedPart: () => void;
  pasteCopiedPart: () => void;
  duplicateSelectedPart: () => void;
  deleteSelectedKeyframes: () => boolean;
  deletePart: (partId: string) => void;
  setActiveTool?: (tool: ToolType) => void;
  cancelShapeCreation?: () => void;
  /**
   * Leaves the Boolean operand edit. Returns whether there was one to leave, so
   * the Escape chain can fall through to the next thing it may cancel.
   */
  exitBooleanOperandEditing?: () => boolean;
  /** The active tool, because the drawing tool owns Escape while it is armed. */
  activeTool?: ToolType;
  /** Arms creation exactly as the toolbar's creation band does. */
  armShapeCreation?: (type: BodyPartType, name: string) => void;
  addCustomPart?: (type: BodyPartType, name: string) => void;
  /** Selects every layer, through the same selection setters everything else uses. */
  selectAllLayers?: () => void;
  groupSelection?: () => void;
  ungroupSelection?: () => void;
  /**
   * The vector transform commands, run through the same arrange authority the
   * toolbar's Rotate/Flip buttons use.
   */
  rotateSelection?: (direction: RotateDirection) => void;
  flipSelection?: (axis: FlipAxis) => void;
  /** Moves the selection out of a grouped child onto its container; true when it did. */
  exitGroupDrillIn?: () => boolean;
  /** Clears the timeline's keyframe selection; true when there was one. */
  clearKeyframeSelection?: () => boolean;
  setIsPlaying?: React.Dispatch<React.SetStateAction<boolean>>;
  appMode?: AppMode;
  openShortcutReference?: () => void;
}

/**
 * The editor's keyboard commands, driven by the ONE shortcut table
 * (`utils/shortcuts`).
 *
 * The handler reads the keymap instead of listing gestures, so a binding and the
 * shortcut reference cannot disagree. Three rules decide whether a command runs:
 *
 *   - a blocking dialog owns the keyboard (`isBlockingModalOpen`), so nothing
 *     here reaches project state while one is open;
 *   - a text surface owns the keyboard (`isEditableElement`), so typing is never
 *     a command;
 *   - the TIMELINE owns its own keys while it has focus
 *     (`ownsShortcutScope('timeline')`): `Delete`/`Backspace` there can only
 *     remove keyframes, never a layer, so a layer cannot be deleted by accident
 *     from the timeline. Commands the timeline's own focused controls own
 *     (keyframe select, lane walking, the marquee cancel) are declared with the
 *     `timeline` scope and are deliberately NOT intercepted here — the reference
 *     UI documents them, the focused control runs them.
 *
 * `Escape` is one chain with a fixed priority: cancel the armed gesture (or hand
 * it to the drawing tool that owns it), leave the Boolean operand edit, step out
 * of a grouped child onto its container, then clear the timeline keyframe
 * selection. It never clears the layer selection — several non-modal surfaces own
 * Escape while they are open (see the note in `utils/shortcuts`).
 */
export const useKeyboardShortcuts = ({
  selectedPartId,
  undo,
  redo,
  copySelectedPart,
  pasteCopiedPart,
  duplicateSelectedPart,
  deleteSelectedKeyframes,
  deletePart,
  setActiveTool,
  cancelShapeCreation,
  exitBooleanOperandEditing,
  activeTool,
  armShapeCreation,
  addCustomPart,
  selectAllLayers,
  groupSelection,
  ungroupSelection,
  rotateSelection,
  flipSelection,
  exitGroupDrillIn,
  clearKeyframeSelection,
  setIsPlaying,
  appMode,
  openShortcutReference,
}: EditorShortcutCommands) => {
  // Detected once per session: the platform cannot change under a running app.
  const platformRef = useRef<ShortcutPlatform>(detectShortcutPlatform());
  // The drawing tool makes the chain's first decision, so it is read at event
  // time rather than captured in the listener's closure.
  const activeToolRef = useRef(activeTool);
  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  useEffect(() => {
    const dispatch = (id: ShortcutCommandId, event: KeyboardEvent): void => {
      switch (id) {
        case 'tool-select':
          setActiveTool?.('select');
          return;
        case 'tool-pan':
          setActiveTool?.('pan');
          return;
        case 'tool-pen': {
          const enabled = activeToolRef.current === 'freeform_draw';
          setActiveTool?.(enabled ? 'select' : 'freeform_draw');
          return;
        }
        case 'create-rectangle':
          armShapeCreation?.('custom_rect', 'Rectangle');
          return;
        case 'create-circle':
          armShapeCreation?.('custom_circle', 'Circle');
          return;
        case 'create-text':
          addCustomPart?.('custom_text', 'Text');
          return;
        case 'select-all':
          selectAllLayers?.();
          return;
        case 'group-layers':
          groupSelection?.();
          return;
        case 'ungroup-layers':
          ungroupSelection?.();
          return;
        case 'rotate-ccw':
        case 'rotate-cw':
          event.preventDefault();
          rotateSelection?.(id === 'rotate-cw' ? 'cw' : 'ccw');
          return;
        case 'flip-horizontal':
        case 'flip-vertical':
          event.preventDefault();
          flipSelection?.(id === 'flip-vertical' ? 'vertical' : 'horizontal');
          return;
        case 'undo':
          event.preventDefault();
          undo();
          return;
        case 'redo':
          event.preventDefault();
          redo();
          return;
        case 'copy':
          if (!selectedPartId) return;
          event.preventDefault();
          copySelectedPart();
          return;
        case 'paste':
          event.preventDefault();
          pasteCopiedPart();
          return;
        case 'duplicate':
          if (!selectedPartId) return;
          event.preventDefault();
          duplicateSelectedPart();
          return;
        case 'delete-selection': {
          // The timeline's Delete is keyframe-only: a layer is never removed
          // while the timeline is the surface the user is working in.
          if (ownsShortcutScope('timeline')) {
            if (deleteSelectedKeyframes()) event.preventDefault();
            return;
          }
          if (deleteSelectedKeyframes()) {
            event.preventDefault();
            return;
          }
          if (selectedPartId) {
            event.preventDefault();
            deletePart(selectedPartId);
          }
          return;
        }
        case 'cancel-gesture': {
          if (cancelShapeCreation) {
            event.preventDefault();
            cancelShapeCreation();
            return;
          }
          // The drawing tool owns Escape while it is armed: its own listener
          // cancels the stroke and exits the tool, so the chain stops here.
          if (activeToolRef.current === 'freeform_draw') return;
          if (exitBooleanOperandEditing?.()) {
            event.preventDefault();
            return;
          }
          if (exitGroupDrillIn?.()) {
            event.preventDefault();
            return;
          }
          if (clearKeyframeSelection?.()) {
            event.preventDefault();
          }
          return;
        }
        case 'play-pause':
          if (!setIsPlaying || appMode === 'broadcast') return;
          event.preventDefault();
          setIsPlaying((playing) => !playing);
          return;
        case 'zoom-in':
          event.preventDefault();
          window.dispatchEvent(new CustomEvent('canvas-viewport-command', { detail: { type: 'zoom-in' } }));
          return;
        case 'zoom-out':
          event.preventDefault();
          window.dispatchEvent(new CustomEvent('canvas-viewport-command', { detail: { type: 'zoom-out' } }));
          return;
        case 'shortcut-reference':
          if (openShortcutReference) {
            event.preventDefault();
            openShortcutReference();
          }
          return;
        // Declared for the reference UI, owned by a focused control or another
        // surface; the global handler never runs them.
        case 'context-menu':
        case 'keyframe-select':
        case 'keyframe-walk':
        case 'marquee-cancel':
          return;
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      // A blocking dialog owns the keyboard while it is on screen: none of these
      // commands may reach project state, and the dialog itself handles Escape.
      if (isBlockingModalOpen()) return;
      if (isEditableElement(document.activeElement)) return;

      const command = resolveShortcutCommand(event, platformRef.current);
      if (!command) return;
      dispatch(command.id, event);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedPartId,
    deletePart,
    deleteSelectedKeyframes,
    undo,
    redo,
    copySelectedPart,
    pasteCopiedPart,
    duplicateSelectedPart,
    setActiveTool,
    cancelShapeCreation,
    exitBooleanOperandEditing,
    armShapeCreation,
    addCustomPart,
    selectAllLayers,
    groupSelection,
    ungroupSelection,
    rotateSelection,
    flipSelection,
    exitGroupDrillIn,
    clearKeyframeSelection,
    setIsPlaying,
    appMode,
    openShortcutReference,
  ]);
};
