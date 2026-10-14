import React, { useRef } from 'react';
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalSpaceAround,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalSpaceAround,
  ArrowDown,
  ArrowUp,
  Circle,
  Compass,
  FlipHorizontal2,
  FlipVertical2,
  Grid,
  Group,
  Hand,
  MousePointer2,
  PenTool,
  RotateCcw,
  RotateCw,
  Square,
  Type,
  Ungroup,
  Unlink,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from 'lucide-react';
import { useAnimator } from '../../context/useAnimator';
import { useBooleanAuthoring } from '../../hooks/useBooleanAuthoring';
import { useLayerGrouping } from '../../hooks/useLayerGrouping';
import { usePartPropertyAuthoring } from '../../hooks/usePartPropertyAuthoring';
import { useVectorArrangeAuthoring } from '../../hooks/useVectorArrangeAuthoring';
import { BooleanOperationIcon } from '../Inspector/BooleanOperationIcon';
import { ToolbarMenu } from './ToolbarMenu';
import type { BooleanOperation } from '../../utils/booleanGeometry';
import type { AlignEdge } from '../../utils/vectorArrange';
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
 * The six align edges, in the order the Align band's menu presents them: the
 * left/centre/right column first, then the top/centre/bottom row — the same
 * arrangement the glyphs themselves read in.
 */
const ALIGN_ITEMS: Array<{ id: AlignEdge; label: string; icon: LucideIcon }> = [
  { id: 'left', label: 'Align left', icon: AlignStartVertical },
  { id: 'horizontal-centers', label: 'Align horizontal centers', icon: AlignCenterVertical },
  { id: 'right', label: 'Align right', icon: AlignEndVertical },
  { id: 'top', label: 'Align top', icon: AlignStartHorizontal },
  { id: 'vertical-centers', label: 'Align vertical centers', icon: AlignCenterHorizontal },
  { id: 'bottom', label: 'Align bottom', icon: AlignEndHorizontal },
];

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
 * Boolean, grouping, alignment, distribute, rotate/flip, arrange and view
 * actions the editor already has.
 *
 * The strip is organised as the command bands a motion editor reads left to
 * right — selection/navigation, creation, Boolean, grouping, align, distribute,
 * rotate/flip, arrange, view — and each band is one `role="group"`, so the
 * structure is announced, not just painted. Every control reads and writes the
 * authority the rest of the app uses: `activeTool`/`showGrid` from the animator
 * context, shape creation through `armShapeCreation`, camera commands through the
 * shared command channel, the shared z-index write path, the shared Boolean and
 * layer-group authorities, and the ONE vector arrange authority
 * (`useVectorArrangeAuthoring`) for align, distribute, rotate and flip. It owns
 * no document state of its own, so a view-only tool cannot touch the project, and
 * it holds no second copy of any command.
 *
 * A band whose commands are variants along one axis (six align edges, two
 * distribute axes) is ONE trigger that opens a menu, so the strip stays compact
 * and no band is a long row of near-identical glyphs; a band of distinct
 * one-shot commands (rotate counter-clockwise/clockwise, flip
 * horizontal/vertical) keeps one button per command. Both kinds keep their
 * commands in one place — the band's own accessible name is its label.
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
 * State-dependent actions (Boolean, grouping, arrange, align, distribute,
 * rotate/flip) stay on screen and are disabled when the current selection cannot
 * use them, so the strip never reflows around the selection and the action that
 * is unavailable is still discoverable.
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
  const arrange = useVectorArrangeAuthoring();

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
        Align and Distribute are command SETS: each is one trigger with the
        variants in a menu, so the strip keeps one hitbox per band. The trigger
        is disabled — but never hidden — while the selection cannot use it, and
        the two availability rules are the measure, not the count of rows in the
        outline: aligning needs two layers with a measurable box, distributing
        three.
      */}
      <div className="authoring-toolbar-group" role="group" aria-label="Align">
        <ToolbarMenu
          label="Align"
          icon={AlignStartVertical}
          disabled={!arrange.canAlign}
          title={arrange.canAlign
            ? 'Align the selection to its collective bounds'
            : 'Align needs two or more layers with measurable geometry'}
          items={ALIGN_ITEMS.map(({ id, label, icon }) => ({ id, label, icon, run: () => arrange.align(id) }))}
        />
      </div>

      <span className="authoring-toolbar-divider" aria-hidden="true" />

      <div className="authoring-toolbar-group" role="group" aria-label="Distribute">
        <ToolbarMenu
          label="Distribute"
          icon={AlignHorizontalSpaceAround}
          disabled={!arrange.canDistribute}
          title={arrange.canDistribute
            ? 'Even out the spacing of the selection (the outer two layers hold the span)'
            : 'Distribute needs three or more layers with measurable geometry'}
          items={[
            { id: 'horizontal', label: 'Distribute horizontally', icon: AlignHorizontalSpaceAround, run: () => arrange.distribute('horizontal') },
            { id: 'vertical', label: 'Distribute vertically', icon: AlignVerticalSpaceAround, run: () => arrange.distribute('vertical') },
          ]}
        />
      </div>

      <span className="authoring-toolbar-divider" aria-hidden="true" />

      {/*
        Rotate and flip are four distinct one-shot commands, so they keep one
        button each: the selection turns about its own centre and mirrors in
        place, and the keys the reference lists are the same commands.
      */}
      <div className="authoring-toolbar-group" role="group" aria-label="Rotate and flip">
        <button
          type="button"
          className="authoring-toolbar-button"
          aria-label="Rotate counter-clockwise"
          aria-keyshortcuts={ariaKeyshortcuts('rotate-ccw', platform)}
          disabled={!arrange.canTransform}
          title={arrange.canTransform
            ? `Rotate the selection 90° counter-clockwise (${hint('rotate-ccw')})`
            : 'Rotate needs a selected layer'}
          onClick={() => arrange.rotate('ccw')}
        >
          <RotateCcw />
        </button>
        <button
          type="button"
          className="authoring-toolbar-button"
          aria-label="Rotate clockwise"
          aria-keyshortcuts={ariaKeyshortcuts('rotate-cw', platform)}
          disabled={!arrange.canTransform}
          title={arrange.canTransform
            ? `Rotate the selection 90° clockwise (${hint('rotate-cw')})`
            : 'Rotate needs a selected layer'}
          onClick={() => arrange.rotate('cw')}
        >
          <RotateCw />
        </button>
        <button
          type="button"
          className="authoring-toolbar-button"
          aria-label="Flip horizontal"
          aria-keyshortcuts={ariaKeyshortcuts('flip-horizontal', platform)}
          disabled={!arrange.canTransform}
          title={arrange.canTransform
            ? `Mirror the selection horizontally about its centre (${hint('flip-horizontal')})`
            : 'Flip needs a selected layer'}
          onClick={() => arrange.flip('horizontal')}
        >
          <FlipHorizontal2 />
        </button>
        <button
          type="button"
          className="authoring-toolbar-button"
          aria-label="Flip vertical"
          aria-keyshortcuts={ariaKeyshortcuts('flip-vertical', platform)}
          disabled={!arrange.canTransform}
          title={arrange.canTransform
            ? `Mirror the selection vertically about its centre (${hint('flip-vertical')})`
            : 'Flip needs a selected layer'}
          onClick={() => arrange.flip('vertical')}
        >
          <FlipVertical2 />
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
