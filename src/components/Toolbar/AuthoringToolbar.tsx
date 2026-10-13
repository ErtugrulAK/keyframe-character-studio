import React, { useRef } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Circle,
  Compass,
  Grid,
  Group,
  Hand,
  MousePointer2,
  PenTool,
  Square,
  Type,
  Ungroup,
  Unlink,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useAnimator } from '../../context/useAnimator';
import { useBooleanAuthoring } from '../../hooks/useBooleanAuthoring';
import { useLayerGrouping } from '../../hooks/useLayerGrouping';
import { usePartPropertyAuthoring } from '../../hooks/usePartPropertyAuthoring';
import { BooleanOperationIcon } from '../Inspector/BooleanOperationIcon';
import type { BooleanOperation } from '../../utils/booleanGeometry';
import {
  ariaKeyshortcuts,
  detectShortcutPlatform,
  formatShortcutHint,
  type ShortcutCommandId,
} from '../../utils/shortcuts';
import './AuthoringToolbar.css';

/** The four Boolean operations, in the order the Inspector presents them. */
const BOOLEAN_OPERATIONS: BooleanOperation[] = ['union', 'subtract', 'intersect', 'exclude'];

const BOOLEAN_LABEL: Record<BooleanOperation, string> = {
  union: 'Union',
  subtract: 'Subtract',
  intersect: 'Intersect',
  exclude: 'Exclude',
};

/** The canvas tools the top strip owns, in the order the toolbar presents them. */
const CANVAS_TOOLS: Array<'select' | 'pan'> = ['select', 'pan'];

/**
 * Dispatches a camera command on the established `canvas-viewport-command`
 * channel — the same window event the +/- keyboard shortcuts already use, so
 * the toolbar never owns a second camera authority. `StageCanvas` consumes it.
 */
const dispatchViewportCommand = (type: 'zoom-in' | 'zoom-out' | 'reset-view') => {
  window.dispatchEvent(new CustomEvent('canvas-viewport-command', { detail: { type } }));
};

/**
 * The top authoring toolbar: the strip that carries the tools, creation entry,
 * Boolean, grouping, arrange and view actions the editor already has.
 *
 * The strip is organised as the command bands a motion editor reads left to
 * right — selection/navigation, creation, Boolean, grouping, arrange, view — and
 * each band is one `role="group"`, so the structure is announced, not just
 * painted. Every control reads and writes the authority the rest of the app
 * uses: `activeTool`/`showGrid` from the animator context, shape creation
 * through `armShapeCreation`, camera commands through the shared command
 * channel, the shared z-index write path, and the shared Boolean and layer-group
 * authorities. It owns no document state of its own, so a view-only tool cannot
 * touch the project, and it holds no second copy of any command.
 *
 * Paint is deliberately NOT here: fill and stroke are authored in the
 * Inspector's Appearance section, which is their one home.
 *
 * Layer bonding (Bind/Unbind) is deliberately NOT here either: the strip no
 * longer offers it. The bond model itself is untouched — a document that
 * carries `boundPartIds` still loads, still moves the bonded layers together,
 * and still round-trips on export (`utils/partBinding` remains the one bond
 * authority and `usePartBindingAuthoring` remains its authoring surface).
 *
 * State-dependent actions (Boolean, grouping, arrange) stay on screen and are
 * disabled when the current selection cannot use them, so the strip never
 * reflows around the selection and the action that is unavailable is still
 * discoverable.
 */
export const AuthoringToolbar: React.FC = () => {
  const {
    activeTool,
    setActiveTool,
    showGrid,
    setShowGrid,
    selectedPartId,
    characterParts,
    armShapeCreation,
    addCustomPart,
  } = useAnimator();
  const {
    booleanEligibleParts,
    selectedBooleanGroup,
    createBooleanGroup,
    updateBooleanOperation,
    dissolveBooleanGroup,
  } = useBooleanAuthoring();
  const { handleZIndexChange } = usePartPropertyAuthoring();
  const { selectedGroup, canGroup, groupSelection, ungroupSelection } = useLayerGrouping();

  // Tooltips and the accessible shortcut of each band read the ONE shortcut
  // table, so a hint cannot advertise a key the editor does not bind, and the
  // labels follow the platform (Ctrl on Windows/Linux, ⌘ on macOS).
  const platform = detectShortcutPlatform();
  const hint = (id: ShortcutCommandId) => formatShortcutHint(id, platform);

  const toolButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedPart = characterParts.find((part) => part.id === selectedPartId);
  // Creation needs two Boolean-eligible operands; an existing group switches
  // its operation instead. The group stays visible either way and only its
  // actions carry the availability.
  const booleanReady = Boolean(selectedBooleanGroup) || booleanEligibleParts.length >= 2;
  const penActive = activeTool === 'freeform_draw';
  const activeCanvasToolIndex = CANVAS_TOOLS.indexOf(activeTool as 'select' | 'pan');

  /** One Tab stop for the tool pair; Arrow/Home/End move it like the stage did. */
  const handleToolKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const currentIndex = activeCanvasToolIndex < 0 ? 0 : activeCanvasToolIndex;
    const nextIndex = event.key === 'ArrowRight' || event.key === 'ArrowDown'
      ? (currentIndex + 1) % CANVAS_TOOLS.length
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
        ? (currentIndex - 1 + CANVAS_TOOLS.length) % CANVAS_TOOLS.length
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? CANVAS_TOOLS.length - 1
            : -1;
    if (nextIndex < 0) return;
    event.preventDefault();
    setActiveTool(CANVAS_TOOLS[nextIndex]);
    toolButtonRefs.current[nextIndex]?.focus();
  };

  return (
    <div className="authoring-toolbar" role="toolbar" aria-label="Authoring tools">
      <div className="authoring-toolbar-group" role="group" aria-label="Canvas tools">
        <button
          ref={(element) => { toolButtonRefs.current[0] = element; }}
          type="button"
          className={`authoring-toolbar-button${activeTool === 'select' ? ' active' : ''}`}
          aria-label="Select"
          aria-pressed={activeTool === 'select'}
          title={`Select tool (${hint('tool-select')})`}
          aria-keyshortcuts={ariaKeyshortcuts('tool-select', platform)}
          tabIndex={activeCanvasToolIndex <= 0 ? 0 : -1}
          onClick={() => setActiveTool('select')}
          onKeyDown={handleToolKeyDown}
        >
          <MousePointer2 />
        </button>
        <button
          ref={(element) => { toolButtonRefs.current[1] = element; }}
          type="button"
          className={`authoring-toolbar-button${activeTool === 'pan' ? ' active' : ''}`}
          aria-label="Pan"
          aria-pressed={activeTool === 'pan'}
          title={`Pan tool (${hint('tool-pan')})`}
          aria-keyshortcuts={ariaKeyshortcuts('tool-pan', platform)}
          tabIndex={activeCanvasToolIndex === 1 ? 0 : -1}
          onClick={() => setActiveTool('pan')}
          onKeyDown={handleToolKeyDown}
        >
          <Hand />
        </button>
      </div>

      <span className="authoring-toolbar-divider" aria-hidden="true" />

      <div className="authoring-toolbar-group" role="group" aria-label="Create">
        <button
          type="button"
          className="authoring-toolbar-button"
          aria-label="Add rectangle"
          title={`Add a rectangle (${hint('create-rectangle')}), then drag on the stage to place it`}
          onClick={() => armShapeCreation('custom_rect', 'Rectangle')}
        >
          <Square />
        </button>
        <button
          type="button"
          className="authoring-toolbar-button"
          aria-label="Add circle"
          title={`Add a circle (${hint('create-circle')}), then drag on the stage to place it`}
          onClick={() => armShapeCreation('custom_circle', 'Circle')}
        >
          <Circle />
        </button>
        <button
          type="button"
          className="authoring-toolbar-button"
          aria-label="Add text"
          title={`Add a text layer (${hint('create-text')})`}
          onClick={() => addCustomPart('custom_text', 'Text')}
        >
          <Type />
        </button>
        <button
          type="button"
          className={`authoring-toolbar-button${penActive ? ' active' : ''}`}
          aria-label="Pen"
          aria-pressed={penActive}
          title={penActive ? 'Stop drawing a path (Esc)' : `Draw a freeform path (${hint('tool-pen')})`}
          onClick={() => setActiveTool(penActive ? 'select' : 'freeform_draw')}
        >
          <PenTool />
        </button>
      </div>

      <span className="authoring-toolbar-divider" aria-hidden="true" />

      <div className="authoring-toolbar-group" role="group" aria-label="Boolean operations">
        {BOOLEAN_OPERATIONS.map((operation) => {
          const active = selectedBooleanGroup?.booleanOperation === operation;
          const label = BOOLEAN_LABEL[operation];
          return (
            <button
              key={operation}
              type="button"
              className={`authoring-toolbar-button${active ? ' active' : ''}`}
              aria-label={`Boolean ${label}`}
              aria-pressed={active}
              disabled={!booleanReady}
              title={selectedBooleanGroup
                ? `Switch Boolean to ${label}`
                : booleanReady
                  ? `Create ${label} Boolean from the selection`
                  : `${label} needs two compatible layers`}
              onClick={() => (selectedBooleanGroup ? updateBooleanOperation(operation) : createBooleanGroup(operation))}
            >
              <BooleanOperationIcon operation={operation} />
            </button>
          );
        })}
        <button
          type="button"
          className="authoring-toolbar-button"
          aria-label="Dissolve Boolean"
          disabled={!selectedBooleanGroup}
          title={selectedBooleanGroup
            ? 'Dissolve Boolean and preserve operands'
            : 'Dissolve needs a Boolean group'}
          onClick={dissolveBooleanGroup}
        >
          <Unlink />
        </button>
      </div>

      <span className="authoring-toolbar-divider" aria-hidden="true" />

      <div className="authoring-toolbar-group" role="group" aria-label="Layer group">
        <button
          type="button"
          className="authoring-toolbar-button"
          aria-label="Group layers"
          title={canGroup ? `Group the selected layers (${hint('group-layers')})` : 'Group needs two or more selected layers'}
          aria-keyshortcuts={ariaKeyshortcuts('group-layers', platform)}
          disabled={!canGroup}
          onClick={groupSelection}
        >
          <Group />
        </button>
        <button
          type="button"
          className="authoring-toolbar-button"
          aria-label="Ungroup layers"
          title={selectedGroup
            ? `Ungroup and keep every layer in place (${hint('ungroup-layers')})`
            : 'Ungroup needs a selected group'}
          aria-keyshortcuts={ariaKeyshortcuts('ungroup-layers', platform)}
          disabled={!selectedGroup}
          onClick={ungroupSelection}
        >
          <Ungroup />
        </button>
      </div>

      <span className="authoring-toolbar-divider" aria-hidden="true" />

      {/*
        Arrange writes the layer's z-order through the shared z-index authoring
        path — the same write the Inspector's layer order uses. Paint order is
        the truth here: a higher z-index paints later and ends up on top.
      */}
      <div className="authoring-toolbar-group" role="group" aria-label="Arrange">
        <button
          type="button"
          className="authoring-toolbar-button"
          aria-label="Bring forward"
          title={selectedPart ? 'Bring layer forward by one' : 'Arrange needs a selected layer'}
          disabled={!selectedPart}
          onClick={() => { if (selectedPart) handleZIndexChange(selectedPart.zIndex + 1); }}
        >
          <ArrowUp />
        </button>
        <button
          type="button"
          className="authoring-toolbar-button"
          aria-label="Send backward"
          title={selectedPart ? 'Send layer backward by one' : 'Arrange needs a selected layer'}
          disabled={!selectedPart}
          onClick={() => { if (selectedPart) handleZIndexChange(Math.max(1, selectedPart.zIndex - 1)); }}
        >
          <ArrowDown />
        </button>
      </div>

      <span className="authoring-toolbar-divider" aria-hidden="true" />

      <div className="authoring-toolbar-group" role="group" aria-label="View controls">
        <button
          type="button"
          className={`authoring-toolbar-button${showGrid ? ' active' : ''}`}
          aria-label="Toggle grid"
          aria-pressed={showGrid}
          title={showGrid ? 'Hide grid' : 'Show grid'}
          onClick={() => setShowGrid(!showGrid)}
        >
          <Grid />
        </button>
        <button
          type="button"
          className="authoring-toolbar-button"
          aria-label="Zoom out"
          title={`Zoom out (${hint('zoom-out')})`}
          onClick={() => dispatchViewportCommand('zoom-out')}
        >
          <ZoomOut />
        </button>
        <button
          type="button"
          className="authoring-toolbar-button"
          aria-label="Reset view"
          title="Reset view position"
          onClick={() => dispatchViewportCommand('reset-view')}
        >
          <Compass />
        </button>
        <button
          type="button"
          className="authoring-toolbar-button"
          aria-label="Zoom in"
          title={`Zoom in (${hint('zoom-in')})`}
          onClick={() => dispatchViewportCommand('zoom-in')}
        >
          <ZoomIn />
        </button>
      </div>
    </div>
  );
};
