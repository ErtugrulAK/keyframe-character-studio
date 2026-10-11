import React from 'react';
import { Compass, Grid, Hand, MousePointer2, Unlink, ZoomIn, ZoomOut } from 'lucide-react';
import { useAnimator } from '../../context/useAnimator';
import { useBooleanAuthoring } from '../../hooks/useBooleanAuthoring';
import { usePartPropertyAuthoring } from '../../hooks/usePartPropertyAuthoring';
import { BooleanOperationIcon } from '../Inspector/BooleanOperationIcon';
import { ColorPickerPopover } from '../Inspector/inputs/ColorPickerPopover';
import type { BooleanOperation } from '../../utils/booleanGeometry';
import './AuthoringToolbar.css';

/** The four Boolean operations, in the order the Inspector presents them. */
const BOOLEAN_OPERATIONS: BooleanOperation[] = ['union', 'subtract', 'intersect', 'exclude'];

const BOOLEAN_LABEL: Record<BooleanOperation, string> = {
  union: 'Union',
  subtract: 'Subtract',
  intersect: 'Intersect',
  exclude: 'Exclude',
};

/**
 * Dispatches a camera command on the established `canvas-viewport-command`
 * channel — the same window event the +/- keyboard shortcuts already use, so
 * the toolbar never owns a second camera authority. `StageCanvas` consumes it.
 */
const dispatchViewportCommand = (type: 'zoom-in' | 'zoom-out' | 'reset-view') => {
  window.dispatchEvent(new CustomEvent('canvas-viewport-command', { detail: { type } }));
};

/**
 * The top authoring toolbar: a compact strip of the tools, view controls, paint
 * and Boolean actions the editor already has.
 *
 * Every control reads and writes the authority the rest of the app uses —
 * `activeTool`/`showGrid` from the animator context, the camera command channel
 * for zoom/reset, the shared paint write path for Fill/Stroke and the shared
 * Boolean authoring authority. It owns no document state of its own, so
 * switching a view-only tool cannot touch the project.
 */
export const AuthoringToolbar: React.FC = () => {
  const {
    activeTool,
    setActiveTool,
    showGrid,
    setShowGrid,
    selectedPartId,
    characterParts,
    startBatchInteraction,
    endBatchInteraction,
  } = useAnimator();
  const {
    booleanEligibleParts,
    selectedBooleanGroup,
    createBooleanGroup,
    updateBooleanOperation,
    dissolveBooleanGroup,
  } = useBooleanAuthoring();
  const { handlePartColorChange, handlePartPropChange } = usePartPropertyAuthoring();

  const selectedPart = characterParts.find((part) => part.id === selectedPartId);
  // Creation needs two Boolean-eligible operands; an existing group switches
  // its operation instead. Neither is on screen when it would do nothing.
  const booleanReady = Boolean(selectedBooleanGroup) || booleanEligibleParts.length >= 2;

  return (
    <div className="authoring-toolbar" role="toolbar" aria-label="Authoring tools">
      <div className="authoring-toolbar-group" role="group" aria-label="Canvas tools">
        <button
          type="button"
          className={`authoring-toolbar-button${activeTool === 'select' ? ' active' : ''}`}
          aria-label="Select"
          aria-pressed={activeTool === 'select'}
          title="Select tool (V)"
          onClick={() => setActiveTool('select')}
        >
          <MousePointer2 size={14} />
        </button>
        <button
          type="button"
          className={`authoring-toolbar-button${activeTool === 'pan' ? ' active' : ''}`}
          aria-label="Pan"
          aria-pressed={activeTool === 'pan'}
          title="Pan tool (H)"
          onClick={() => setActiveTool('pan')}
        >
          <Hand size={14} />
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
          <Grid size={14} />
        </button>
        <button
          type="button"
          className="authoring-toolbar-button"
          aria-label="Zoom out"
          title="Zoom out"
          onClick={() => dispatchViewportCommand('zoom-out')}
        >
          <ZoomOut size={14} />
        </button>
        <button
          type="button"
          className="authoring-toolbar-button"
          aria-label="Zoom in"
          title="Zoom in"
          onClick={() => dispatchViewportCommand('zoom-in')}
        >
          <ZoomIn size={14} />
        </button>
        <button
          type="button"
          className="authoring-toolbar-button"
          aria-label="Reset view"
          title="Reset view position"
          onClick={() => dispatchViewportCommand('reset-view')}
        >
          <Compass size={14} />
        </button>
      </div>

      {selectedPart && (
        <>
          <span className="authoring-toolbar-divider" aria-hidden="true" />
          <div className="authoring-toolbar-group" role="group" aria-label="Fill and stroke">
            <span className="authoring-toolbar-label">Fill</span>
            <ColorPickerPopover
              label="Fill"
              color={selectedPart.fillColor || '#00d2ff'}
              alpha={selectedPart.fillOpacity ?? 1}
              fallback="#00d2ff"
              panelSide="below"
              panelAlign="start"
              onColorChange={(color) => handlePartColorChange('fillColor', color)}
              onAlphaChange={(alpha) => handlePartPropChange('fillOpacity', alpha)}
              onInteractionStart={startBatchInteraction}
              onInteractionEnd={endBatchInteraction}
            />
            <span className="authoring-toolbar-label">Stroke</span>
            <ColorPickerPopover
              label="Stroke"
              color={selectedPart.strokeColor || '#101218'}
              alpha={selectedPart.strokeOpacity ?? 1}
              fallback="#101218"
              panelSide="below"
              panelAlign="start"
              onColorChange={(color) => handlePartColorChange('strokeColor', color)}
              onAlphaChange={(alpha) => handlePartPropChange('strokeOpacity', alpha)}
              onInteractionStart={startBatchInteraction}
              onInteractionEnd={endBatchInteraction}
            />
          </div>
        </>
      )}

      {booleanReady && (
        <>
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
                  title={selectedBooleanGroup
                    ? `Switch Boolean to ${label}`
                    : `Create ${label} Boolean from the selection`}
                  onClick={() => (selectedBooleanGroup ? updateBooleanOperation(operation) : createBooleanGroup(operation))}
                >
                  <BooleanOperationIcon operation={operation} />
                </button>
              );
            })}
            {selectedBooleanGroup && (
              <button
                type="button"
                className="authoring-toolbar-button"
                aria-label="Dissolve Boolean"
                title="Dissolve Boolean and preserve operands"
                onClick={dissolveBooleanGroup}
              >
                <Unlink size={13} />
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};
