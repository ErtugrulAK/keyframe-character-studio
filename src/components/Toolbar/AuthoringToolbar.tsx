import React, { useRef } from 'react';
import {
  Combine,
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalSpaceBetween,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalSpaceBetween,
  ArrowDown,
  ArrowUp,
  Check,
  Circle,
  Compass,
  Crop,
  Crosshair,
  FlipHorizontal2,
  FlipVertical2,
  Grid,
  Group,
  Hand,
  Magnet,
  Maximize,
  MousePointer2,
  Move,
  PenTool,
  RotateCcw,
  RotateCw,
  Square,
  SquareDashed,
  Type,
  Ungroup,
  Unlink,
  X,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from 'lucide-react';
import { useAnimator } from '../../context/useAnimator';
import { useBooleanAuthoring } from '../../hooks/useBooleanAuthoring';
import { useLayerGrouping } from '../../hooks/useLayerGrouping';
import { useVectorArrangeAuthoring } from '../../hooks/useVectorArrangeAuthoring';
import { BooleanOperationIcon } from '../Inspector/BooleanOperationIcon';
import { ToolbarMenu, type ToolbarMenuItem } from './ToolbarMenu';
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
 * The arrange strip presents four command groups the user reads left to right:
 * the edge alignments, the centre family, the gap distribution and the
 * rotate/flip one-shots — each its own `role="group"` behind a compact divider.
 * Group A carries the four edge commands; Group B, the centre family. Every
 * label names exactly what the `planAlign` authority does to the selection —
 * `Center` aligns BOTH centre axes in one command (one undo step, glyphed as a
 * centred four-way target), `Center Horizontally/Vertically` align one axis
 * onto the collective centre line. They are distinct behaviours, not renamed
 * duplicates.
 */
const ALIGN_EDGE_ITEMS: Array<{ id: AlignEdge; label: string; note: string; icon: LucideIcon }> = [
  { id: 'left', label: 'Align Left', note: 'the left edges meet on the selection bounds', icon: AlignStartVertical },
  { id: 'right', label: 'Align Right', note: 'the right edges meet on the selection bounds', icon: AlignEndVertical },
  { id: 'top', label: 'Align Top', note: 'the top edges meet on the selection bounds', icon: AlignStartHorizontal },
  { id: 'bottom', label: 'Align Bottom', note: 'the bottom edges meet on the selection bounds', icon: AlignEndHorizontal },
];

const CENTER_ITEMS: Array<{ id: AlignEdge; label: string; note: string; icon: LucideIcon }> = [
  { id: 'center', label: 'Center', note: 'every centre lands on the collective centre — both axes, one step', icon: Move },
  { id: 'horizontal-centers', label: 'Center Horizontally', note: 'every centre lands on the collective vertical centre line', icon: AlignCenterVertical },
  { id: 'vertical-centers', label: 'Center Vertically', note: 'every centre lands on the collective horizontal centre line', icon: AlignCenterHorizontal },
];

/**
 * One command button shared by the Align, Center and Distribute bands: the
 * bands differ only in which authority they invoke, so the label/note, the
 * availability copy and the glyph slot are declared once, here.
 */
const ArrangeButton: React.FC<{
  label: string;
  note: string;
  icon: LucideIcon;
  enabled: boolean;
  disabledHint: string;
  onInvoke: () => void;
}> = ({ label, note, icon: Icon, enabled, disabledHint, onInvoke }) => (
  <button
    type="button"
    className="authoring-toolbar-button"
    aria-label={label}
    disabled={!enabled}
    title={enabled ? `${label} — ${note}` : disabledHint}
    onClick={onInvoke}
  >
    <Icon />
  </button>
);

/** The one distribute command per axis: equal visual EDGE gaps, extremes held. */
const DISTRIBUTE_ITEMS = [
  { axis: 'horizontal', label: 'Distribute Horizontally', note: 'equal visual gaps between edges; the outer two hold the span', icon: AlignHorizontalSpaceBetween },
  { axis: 'vertical', label: 'Distribute Vertically', note: 'equal visual gaps between edges; the outer two hold the span', icon: AlignVerticalSpaceBetween },
] as const;

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
 * rotate/flip, arrange, crop, view — and each band is one `role="group"`, so the
 * structure is announced, not just painted. Every control reads and writes the
 * authority the rest of the app uses: `activeTool`/`showGrid`/`snapEnabled`/
 * `cropMode` from
 * the animator context, shape creation through `armShapeCreation`, camera
 * commands through the shared command channel, the shared z-index write path, the shared Boolean and
 * layer-group authorities, the stage-crop commands (`createStageCropActions`,
 * the ONE vector arrange authority
 * (`useVectorArrangeAuthoring`) for align, distribute, rotate and flip. It owns
 * no document state of its own, so a view-only tool cannot touch the project, and
 * it holds no second copy of any command.
 *
 * Align and distribute expose direct buttons on the desktop; each invokes the
 * existing arrange policy, with no menu between the selection and the command.
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
    showCoordinateOverlay,
    setShowCoordinateOverlay,
    snapEnabled,
    setSnapEnabled,
    cropMode,
    setCropMode,
    cropRegion,
    applyStageCrop,
    clearStageCropRegion,
    cropStageToSelection,
    cropStageToVisibleContent,
    stageCropBlockReason,
    canCropStageToSelection,
    canCropStageToVisibleContent,
    selectedPartId,
    characterParts,
    armShapeCreation,
    clearShapeCreation,
    pendingShapeType,
    addCustomPart,
    reorderParts,
  } = useAnimator();
  const {
    booleanEligibleParts,
    selectedBooleanGroup,
    createBooleanGroup,
    updateBooleanOperation,
    dissolveBooleanGroup,
  } = useBooleanAuthoring();
  const { selectedGroup, canGroup, groupSelection, ungroupSelection } = useLayerGrouping();
  const arrange = useVectorArrangeAuthoring();

  // Tooltips and the accessible shortcut of each band read the ONE shortcut
  // table, so a hint cannot advertise a key the editor does not bind, and the
  // labels follow the platform (Ctrl on Windows/Linux, ⌘ on macOS).
  const platform = detectShortcutPlatform();
  const hint = (id: ShortcutCommandId) => formatShortcutHint(id, platform);

  const toolButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedPart = characterParts.find((part) => part.id === selectedPartId);
  // Arrange moves the layer one row in the authored stack, the same reorder the
  // layer list and the context menu run, so the list and the paint order change
  // together. Row 0 is the top of the stack.
  const selectedIndex = selectedPart ? characterParts.indexOf(selectedPart) : -1;
  const canBringForward = selectedIndex > 0;
  const canSendBackward = selectedIndex >= 0 && selectedIndex < characterParts.length - 1;
  const bringForward = () => { if (canBringForward) reorderParts(selectedIndex, selectedIndex - 1); };
  const sendBackward = () => { if (canSendBackward) reorderParts(selectedIndex, selectedIndex + 1); };
  const bringForwardTitle = !selectedPart ? 'Arrange needs a selected layer' : canBringForward ? 'Bring layer forward by one' : 'The layer is already at the top';
  const sendBackwardTitle = !selectedPart ? 'Arrange needs a selected layer' : canSendBackward ? 'Send layer backward by one' : 'The layer is already at the bottom';
  // Creation needs two Boolean-eligible operands; an existing group switches
  // its operation instead. The group stays visible either way and only its
  // actions carry the availability.
  const booleanReady = Boolean(selectedBooleanGroup) || booleanEligibleParts.length >= 2;
  const penActive = activeTool === 'freeform_draw';
  // C2: a creation button shows the mode the stage is really in, and a second
  // press disarms it (back to Select) — the toolbar never disagrees with the stage.
  const rectangleArmed = activeTool === 'shape_create' && pendingShapeType === 'custom_rect';
  const circleArmed = activeTool === 'shape_create' && pendingShapeType === 'custom_circle';
  const activeCanvasToolIndex = CANVAS_TOOLS.indexOf(activeTool as 'select' | 'pan');

  // C3 — the narrow strip's two menus: the same commands as the wide bands.
  const alignMenuItems: ToolbarMenuItem[] = [
    ...[...ALIGN_EDGE_ITEMS, ...CENTER_ITEMS].map(({ id, label, note, icon }) => ({
      id: `align-${id}`,
      label,
      icon,
      run: () => arrange.align(id),
      disabled: !arrange.canAlign,
      title: arrange.canAlign ? `${label} — ${note}` : `${label} needs two measurable layers`,
    })),
    ...DISTRIBUTE_ITEMS.map(({ axis, label, note, icon }) => ({
      id: `distribute-${axis}`,
      label,
      icon,
      run: () => arrange.distributeGap(axis),
      disabled: !arrange.canDistribute,
      title: arrange.canDistribute ? `${label} — ${note}` : `${label} needs three measurable layers`,
    })),
  ];
  const arrangeMenuItems: ToolbarMenuItem[] = [
    { id: 'rotate-ccw', label: 'Rotate counter-clockwise', icon: RotateCcw, run: () => arrange.rotate('ccw'), disabled: !arrange.canTransform, keyshortcuts: ariaKeyshortcuts('rotate-ccw', platform), title: arrange.canTransform ? `Rotate the selection 90° counter-clockwise (${hint('rotate-ccw')})` : 'Rotate needs a selected layer' },
    { id: 'rotate-cw', label: 'Rotate clockwise', icon: RotateCw, run: () => arrange.rotate('cw'), disabled: !arrange.canTransform, keyshortcuts: ariaKeyshortcuts('rotate-cw', platform), title: arrange.canTransform ? `Rotate the selection 90° clockwise (${hint('rotate-cw')})` : 'Rotate needs a selected layer' },
    { id: 'flip-h', label: 'Flip horizontal', icon: FlipHorizontal2, run: () => arrange.flip('horizontal'), disabled: !arrange.canTransform, keyshortcuts: ariaKeyshortcuts('flip-horizontal', platform), title: arrange.canTransform ? `Mirror the selection horizontally about its centre (${hint('flip-horizontal')})` : 'Flip needs a selected layer' },
    { id: 'flip-v', label: 'Flip vertical', icon: FlipVertical2, run: () => arrange.flip('vertical'), disabled: !arrange.canTransform, keyshortcuts: ariaKeyshortcuts('flip-vertical', platform), title: arrange.canTransform ? `Mirror the selection vertically about its centre (${hint('flip-vertical')})` : 'Flip needs a selected layer' },
    { id: 'bring-forward', label: 'Bring forward', icon: ArrowUp, run: bringForward, disabled: !canBringForward, title: bringForwardTitle },
    { id: 'send-backward', label: 'Send backward', icon: ArrowDown, run: sendBackward, disabled: !canSendBackward, title: sendBackwardTitle },
  ];

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
          className={`authoring-toolbar-button${rectangleArmed ? ' active' : ''}`}
          aria-label="Add rectangle"
          aria-keyshortcuts={ariaKeyshortcuts('create-rectangle', platform)}
          aria-pressed={rectangleArmed}
          title={rectangleArmed
            ? 'Rectangle armed: drag on the stage to place it (press again or Esc to stop)'
            : `Add a rectangle (${hint('create-rectangle')}), then drag on the stage to place it`}
          onClick={() => (rectangleArmed ? clearShapeCreation() : armShapeCreation('custom_rect', 'Rectangle'))}
        >
          <Square />
        </button>
        <button
          type="button"
          className={`authoring-toolbar-button${circleArmed ? ' active' : ''}`}
          aria-label="Add circle"
          aria-keyshortcuts={ariaKeyshortcuts('create-circle', platform)}
          aria-pressed={circleArmed}
          title={circleArmed
            ? 'Circle armed: drag on the stage to place it (press again or Esc to stop)'
            : `Add a circle (${hint('create-circle')}), then drag on the stage to place it`}
          onClick={() => (circleArmed ? clearShapeCreation() : armShapeCreation('custom_circle', 'Circle'))}
        >
          <Circle />
        </button>
        <button
          type="button"
          className="authoring-toolbar-button"
          aria-label="Add text"
          aria-keyshortcuts={ariaKeyshortcuts('create-text', platform)}
          title={`Add a text layer (${hint('create-text')})`}
          onClick={() => addCustomPart('custom_text', 'Text')}
        >
          <Type />
        </button>
        <button
          type="button"
          className={`authoring-toolbar-button${penActive ? ' active' : ''}`}
          aria-label="Pen"
          aria-keyshortcuts={ariaKeyshortcuts('tool-pen', platform)}
          aria-pressed={penActive}
          title={penActive
            ? 'Leave the Pen (press again). A drawing with 3+ points is kept as a shape; Esc discards it instead'
            : `Draw a freeform path (${hint('tool-pen')}). Click the first point, double-click or press Enter to finish`}
          onClick={() => setActiveTool(penActive ? 'select' : 'freeform_draw')}
        >
          <PenTool />
        </button>
      </div>

      <span className="authoring-toolbar-divider" aria-hidden="true" />

      {/*
        C4 — at ≤ 860 px (AuthoringToolbar.css) the Boolean band folds into one
        menu (below) with the same commands, availability and pressed state.
      */}
      <div className="authoring-toolbar-wide-860">
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
      </div>
      <div className="authoring-toolbar-compact-860">
        <div className="authoring-toolbar-group" role="group" aria-label="Boolean">
          <ToolbarMenu
            label="Boolean operations"
            icon={Combine}
            active={Boolean(selectedBooleanGroup)}
            disabled={!booleanReady && !selectedBooleanGroup}
            title={selectedBooleanGroup ? 'Switch or dissolve the Boolean' : booleanReady ? 'Create a Boolean from the selection' : 'Boolean needs two compatible layers'}
            items={[
              ...BOOLEAN_OPERATIONS.map((operation) => ({
                id: `boolean-${operation}`,
                label: `Boolean ${BOOLEAN_LABEL[operation]}`,
                icon: Combine,
                checked: selectedBooleanGroup?.booleanOperation === operation,
                disabled: !booleanReady,
                title: booleanReady ? undefined : `${BOOLEAN_LABEL[operation]} needs two compatible layers`,
                run: () => (selectedBooleanGroup ? updateBooleanOperation(operation) : createBooleanGroup(operation)),
              })),
              { id: 'boolean-dissolve', label: 'Dissolve Boolean', icon: Unlink, disabled: !selectedBooleanGroup, title: selectedBooleanGroup ? undefined : 'Dissolve needs a Boolean group', run: dissolveBooleanGroup },
            ]}
          />
        </div>
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

      {/*
        C3 — the five arrange bands below are shown as they are on a wide strip.
        On a narrow one (≤ 1200 px, AuthoringToolbar.css) they fold into the two
        menus after this block, which run the SAME commands with the same labels
        and the same availability — nothing is dropped, only regrouped. Each
        variant carries its own dividers, so every band still sits behind one.
      */}
      <div className="authoring-toolbar-wide-bands">
      <span className="authoring-toolbar-divider" aria-hidden="true" />

      <div className="authoring-toolbar-group" role="group" aria-label="Align">
        {ALIGN_EDGE_ITEMS.map(({ id, label, note, icon: Icon }) => (
          <ArrangeButton
            key={id}
            label={label}
            note={note}
            icon={Icon}
            enabled={arrange.canAlign}
            disabledHint={`${label} needs two measurable layers`}
            onInvoke={() => arrange.align(id)}
          />
        ))}
      </div>

      <span className="authoring-toolbar-divider" aria-hidden="true" />

      <div className="authoring-toolbar-group" role="group" aria-label="Center">
        {CENTER_ITEMS.map(({ id, label, note, icon: Icon }) => (
          <ArrangeButton
            key={id}
            label={label}
            note={note}
            icon={Icon}
            enabled={arrange.canAlign}
            disabledHint={`${label} needs two measurable layers`}
            onInvoke={() => arrange.align(id)}
          />
        ))}
      </div>

      <span className="authoring-toolbar-divider" aria-hidden="true" />

      <div className="authoring-toolbar-group" role="group" aria-label="Distribute">
        {DISTRIBUTE_ITEMS.map(({ axis, label, note, icon: Icon }) => (
          <ArrangeButton
            key={axis}
            label={label}
            note={note}
            icon={Icon}
            enabled={arrange.canDistribute}
            disabledHint={`${label} needs three measurable layers`}
            onInvoke={() => arrange.distributeGap(axis)}
          />
        ))}
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
        Arrange reorders the authored stack (see bringForward), so the layer
        list and the painted order always agree.
      */}
      <div className="authoring-toolbar-group" role="group" aria-label="Arrange">
        <button
          type="button"
          className="authoring-toolbar-button"
          aria-label="Bring forward"
          title={bringForwardTitle}
          disabled={!canBringForward}
          onClick={bringForward}
        >
          <ArrowUp />
        </button>
        <button
          type="button"
          className="authoring-toolbar-button"
          aria-label="Send backward"
          title={sendBackwardTitle}
          disabled={!canSendBackward}
          onClick={sendBackward}
        >
          <ArrowDown />
        </button>
      </div>

      <span className="authoring-toolbar-divider" aria-hidden="true" />
      </div>

      <div className="authoring-toolbar-narrow-bands">
      <span className="authoring-toolbar-divider" aria-hidden="true" />
      <div className="authoring-toolbar-group" role="group" aria-label="Align and arrange">
        <ToolbarMenu
          label="Align and distribute"
          icon={AlignStartVertical}
          disabled={!alignMenuItems.some((item) => !item.disabled)}
          title={arrange.canAlign ? 'Align, center or distribute the selection' : 'Align needs two measurable layers'}
          items={alignMenuItems}
        />
        <ToolbarMenu
          label="Arrange and rotate"
          icon={RotateCw}
          disabled={!arrangeMenuItems.some((item) => !item.disabled)}
          title={selectedPart ? 'Rotate, flip or change the layer order' : 'Arrange needs a selected layer'}
          items={arrangeMenuItems}
        />
      </div>
      <span className="authoring-toolbar-divider" aria-hidden="true" />
      </div>

      {/*
        Stage crop / region of interest. The mode and the region are TRANSIENT
        authoring state (the stage draws the region and its handles); the band
        arms the mode, applies the region as ONE undoable command, and drops it.
        Both convenience commands measure the EVALUATED visual bounds at the
        CURRENT AUTHORED FRAME — their labels say so, because a layer whose
        position animates away from the region will still leave the new frame at
        the frames that move it.
      */}
      <div className="authoring-toolbar-wide-860">
      <div className="authoring-toolbar-group" role="group" aria-label="Crop">
        <button
          type="button"
          className={`authoring-toolbar-button${cropMode ? ' active' : ''}`}
          aria-label="Crop / region of interest"
          aria-pressed={cropMode}
          title={cropMode
            ? 'Crop mode is on — drag a region on the stage, then apply it'
            : 'Turn on crop mode to author a region of interest on the stage'}
          onClick={() => setCropMode(!cropMode)}
        >
          <Crop />
        </button>
        <button
          type="button"
          className="authoring-toolbar-button"
          aria-label="Apply crop"
          disabled={!cropRegion || Boolean(stageCropBlockReason)}
          title={stageCropBlockReason
            ?? (cropRegion
              ? `Crop the stage to ${cropRegion.width}×${cropRegion.height} and keep the scene where it sits`
              : 'Draw a crop region on the stage first')}
          onClick={() => applyStageCrop()}
        >
          <Check />
        </button>
        <button
          type="button"
          className="authoring-toolbar-button"
          aria-label="Clear crop region"
          disabled={!cropRegion}
          title={cropRegion ? 'Drop the region without cropping the stage' : 'There is no crop region to clear'}
          onClick={() => clearStageCropRegion()}
        >
          <X />
        </button>
      </div>

      <span className="authoring-toolbar-divider" aria-hidden="true" />

      <div className="authoring-toolbar-group" role="group" aria-label="Crop to content">
        <ToolbarMenu
          label="Crop to content"
          icon={Maximize}
          disabled={!canCropStageToSelection && !canCropStageToVisibleContent}
          title={stageCropBlockReason
            ?? (canCropStageToSelection || canCropStageToVisibleContent
              ? 'Crop the stage to the evaluated bounds measured at this frame'
              : 'Cropping to content needs a selection or visible content with measurable bounds')}
          items={[
            {
              id: 'crop-to-selection',
              label: 'Crop to current selection at current frame',
              icon: SquareDashed,
              run: cropStageToSelection,
            },
            {
              id: 'crop-to-visible-content',
              label: 'Crop to visible content at current frame',
              icon: Maximize,
              run: cropStageToVisibleContent,
            },
          ]}
        />
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
          className={`authoring-toolbar-button${showCoordinateOverlay ? ' active' : ''}`}
          aria-label="Toggle coordinate overlay"
          aria-pressed={showCoordinateOverlay}
          title={showCoordinateOverlay ? 'Hide X/Y coordinate overlay' : 'Show X/Y coordinate overlay'}
          onClick={() => setShowCoordinateOverlay(!showCoordinateOverlay)}
        >
          <Crosshair />
        </button>
        <button
          type="button"
          className={`authoring-toolbar-button${snapEnabled ? ' active' : ''}`}
          aria-label="Toggle snapping"
          aria-pressed={snapEnabled}
          title={snapEnabled
            ? 'Snapping is on — turn it off to place layers freely'
            : 'Snapping is off — turn it on to align to the stage and other layers'}
          onClick={() => setSnapEnabled(!snapEnabled)}
        >
          <Magnet />
        </button>
        <button
          type="button"
          className="authoring-toolbar-button"
          aria-label="Zoom out"
          aria-keyshortcuts={ariaKeyshortcuts('zoom-out', platform)}
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
          aria-keyshortcuts={ariaKeyshortcuts('zoom-in', platform)}
          title={`Zoom in (${hint('zoom-in')})`}
          onClick={() => dispatchViewportCommand('zoom-in')}
        >
          <ZoomIn />
        </button>
      </div>
      </div>
      {/*
        C4 — at ≤ 860 px the Crop, Crop to content and View bands fold into two
        menus that run the same commands; on/off commands show their state.
      */}
      <div className="authoring-toolbar-compact-860">
        <div className="authoring-toolbar-group" role="group" aria-label="Crop and view">
          <ToolbarMenu
            label="Crop"
            icon={Crop}
            active={cropMode}
            disabled={false}
            title={cropMode ? 'Crop mode is on — apply or clear the region, or turn the mode off' : 'Crop the stage to a region or to content'}
            items={[
              { id: 'crop-mode', label: 'Crop / region of interest', icon: Crop, checked: cropMode, run: () => setCropMode(!cropMode) },
              { id: 'crop-apply', label: 'Apply crop', icon: Check, disabled: !cropRegion || Boolean(stageCropBlockReason), title: stageCropBlockReason ?? (cropRegion ? undefined : 'Draw a crop region on the stage first'), run: () => { applyStageCrop(); } },
              { id: 'crop-clear', label: 'Clear crop region', icon: X, disabled: !cropRegion, title: cropRegion ? undefined : 'There is no crop region to clear', run: () => clearStageCropRegion() },
              { id: 'crop-to-selection', label: 'Crop to current selection at current frame', icon: SquareDashed, disabled: !canCropStageToSelection, run: cropStageToSelection },
              { id: 'crop-to-visible-content', label: 'Crop to visible content at current frame', icon: Maximize, disabled: !canCropStageToVisibleContent, run: cropStageToVisibleContent },
            ]}
          />
          <ToolbarMenu
            label="View"
            icon={Grid}
            disabled={false}
            title="Grid, snapping and zoom"
            items={[
              { id: 'view-grid', label: 'Toggle grid', icon: Grid, checked: showGrid, run: () => setShowGrid(!showGrid) },
              { id: 'view-coordinates', label: 'Toggle coordinate overlay', icon: Crosshair, checked: showCoordinateOverlay, run: () => setShowCoordinateOverlay(!showCoordinateOverlay) },
              { id: 'view-snap', label: 'Toggle snapping', icon: Magnet, checked: snapEnabled, run: () => setSnapEnabled(!snapEnabled) },
              { id: 'view-zoom-out', label: 'Zoom out', icon: ZoomOut, keyshortcuts: ariaKeyshortcuts('zoom-out', platform), run: () => dispatchViewportCommand('zoom-out') },
              { id: 'view-reset', label: 'Reset view', icon: Compass, run: () => dispatchViewportCommand('reset-view') },
              { id: 'view-zoom-in', label: 'Zoom in', icon: ZoomIn, keyshortcuts: ariaKeyshortcuts('zoom-in', platform), run: () => dispatchViewportCommand('zoom-in') },
            ]}
          />
        </div>
      </div>
    </div>
  );
};
