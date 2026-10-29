import React, { useMemo, useRef, useState } from 'react';
import { NumberField } from './inputs/NumberField';
import type { PropertyKeyframe, TemporalHandle } from '../../types/animator';
import { effectiveSegmentAuthority, interpolateChannel } from '../../utils/defaults';
import { PRESET_BEZIERS } from './easingPresets';

interface TemporalHandlePatch {
  bezierIn?: TemporalHandle;
  bezierOut?: TemporalHandle;
}

interface TemporalGraphPanelProps {
  keyframes: PropertyKeyframe[];
  mode: 'value' | 'speed';
  onChangeKeyframeValue?: (keyframeId: string, value: number) => void;
  onChangeKeyframeHandles?: (keyframeId: string, patch: TemporalHandlePatch) => void;
  /**
   * #57 (V6): segment-scope preset application. The evaluator needs the
   * COMPLETE pair prev.bezierOut && next.bezierIn, so a preset writes the
   * outgoing segment's BOTH endpoints in one atomic write. Provided by the
   * Motion Curves host; the select renders only when present.
   */
  onApplySegmentPreset?: (keyframeId: string, outgoing: TemporalHandle, incoming: TemporalHandle) => void;
  /** Opens/closes ONE undo entry around a continuous value drag. */
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
}

interface GraphPoint {
  frame: number;
  value: number;
}

// C8: the Motion Curve Editor gives the graph its full width (~760 px).
const WIDTH = 760;
const HEIGHT = 190;
const PAD = 24;
/**
 * C8 — the left gutter holds the value labels right-aligned beside the axis,
 * so a label like "-300" no longer runs into the axis and the first point.
 * Only x uses it; the drag maps y alone, so the drag mapping is unchanged.
 */
const PAD_LEFT = 44;
const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

/** Compact number formatting for axis labels. */
const fmt = (value: number): string => (
  Math.abs(value) >= 100 ? value.toFixed(0) : Math.abs(value) >= 1 ? value.toFixed(1) : value.toFixed(2)
);

/** Segment-easing display labels for the on-curve badges (D1 Increment 1). */
const EASING_BADGE: Record<string, string> = {
  linear: 'LIN',
  hold: 'HOLD',
  easeIn: 'IN',
  easeOut: 'OUT',
  easeInOut: 'IN/OUT',
  cubic_bezier: 'BEZ',
  bezier: 'BEZ',
  autoBezier: 'AUTO',
  bounce: 'BOUNCE',
  elastic: 'ELASTIC',
  anticipate: 'ANTICIPATE',
  overshoot: 'OVERSHOOT',
};

export const TemporalGraphPanel: React.FC<TemporalGraphPanelProps> = ({
  keyframes,
  mode,
  onChangeKeyframeValue,
  onChangeKeyframeHandles,
  onApplySegmentPreset,
  onInteractionStart,
  onInteractionEnd,
}) => {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragDomainRef = useRef<{ min: number; max: number } | null>(null);
  const sorted = useMemo(() => [...keyframes].sort((a, b) => a.frame - b.frame), [keyframes]);
  const sampled = useMemo<GraphPoint[]>(() => {
    if (sorted.length === 0) return [];
    const start = sorted[0].frame;
    const end = sorted[sorted.length - 1].frame;
    const count = Math.max(2, Math.min(96, end - start + 1));
    const values = Array.from({ length: count }, (_, index) => {
      const frame = start + ((end - start) * index) / (count - 1);
      return { frame, value: interpolateChannel(sorted, frame, sorted[0].value) };
    });
    if (mode === 'speed') {
      return values.map((point, index) => {
        const previous = values[Math.max(0, index - 1)];
        const next = values[Math.min(values.length - 1, index + 1)];
        return { ...point, value: (next.value - previous.value) / Math.max(1, next.frame - previous.frame) };
      });
    }
    return values;
  }, [mode, sorted]);

  const graphValues = mode === 'value'
    ? [...sampled.map((point) => point.value), ...sorted.map((keyframe) => keyframe.value)]
    : sampled.map((point) => point.value);
  // Presentation contract (D1 Increment 1): each curve owns its vertical
  // extent. The editable value graph keeps its historical domain (0..1 always
  // in frame, so the drag mapping is bit-for-bit unchanged); the derived speed
  // graph shows its true extent — negative slopes included — padded 10% for
  // label headroom.
  const rawMin = Math.min(...graphValues);
  const rawMax = Math.max(...graphValues);
  const speedPad = Math.max(1e-6, (rawMax - rawMin) * 0.1);
  const minValue = mode === 'value' ? Math.min(rawMin, 0) : rawMin - speedPad;
  const maxValue = mode === 'value' ? Math.max(rawMax, 1) : rawMax + speedPad;
  const valueRange = Math.max(1e-6, maxValue - minValue);
  // The ref freezes the graph domain for the active drag; state updates accompany drag changes.
  // oxlint-disable-next-line react/refs
  const activeMinValue = dragDomainRef.current?.min ?? minValue;
  // oxlint-disable-next-line react/refs
  const activeMaxValue = dragDomainRef.current?.max ?? maxValue;
  // oxlint-disable-next-line react/refs
  const activeValueRange = Math.max(1e-6, activeMaxValue - activeMinValue);
  const startFrame = sorted[0]?.frame ?? 0;
  const endFrame = sorted[sorted.length - 1]?.frame ?? 1;
  const frameRange = Math.max(1, endFrame - startFrame);
  const toSvg = (frame: number, value: number): { x: number; y: number } => ({
    x: PAD_LEFT + ((frame - startFrame) / frameRange) * (WIDTH - PAD_LEFT - PAD),
    y: HEIGHT - PAD - ((value - minValue) / valueRange) * (HEIGHT - PAD * 2),
  });
  const toValue = (clientY: number, rect: DOMRect): number => {
    const svgY = ((clientY - rect.top) / Math.max(rect.height, 1)) * HEIGHT;
    const normalized = clamp((svgY - PAD) / (HEIGHT - PAD * 2), 0, 1);
    return activeMinValue + (1 - normalized) * activeValueRange;
  };
  const pathD = sampled.map((point, index) => {
    const svg = toSvg(point.frame, point.value);
    return `${index === 0 ? 'M' : 'L'} ${svg.x} ${svg.y}`;
  }).join(' ');

  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!draggingId || mode !== 'value' || !onChangeKeyframeValue) return;
    const keyframe = sorted.find((candidate) => candidate.id === draggingId);
    if (!keyframe) return;
    const rect = event.currentTarget.getBoundingClientRect();
    onChangeKeyframeValue(draggingId, toValue(event.clientY, rect));
  };
  const handleKeyframeKeyDown = (event: React.KeyboardEvent<SVGCircleElement>, keyframe: PropertyKeyframe) => {
    if (mode !== 'value' || !onChangeKeyframeValue) return;
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    const step = Math.max(activeValueRange / 100, 0.01);
    onChangeKeyframeValue(keyframe.id, keyframe.value + (event.key === 'ArrowUp' ? step : -step));
  };

  /**
   * A dragged point is one continuous gesture: the transaction opens on the press
   * and closes when the point is released, leaves the graph, or the pointer is
   * cancelled — a drag across hundreds of values stays one undo entry.
   */
  const endPointDrag = () => {
    setDraggingId(null);
    dragDomainRef.current = null;
    onInteractionEnd?.();
  };

  const headingId = `temporal-graph-title-${mode}`;
  const helperId = `temporal-graph-helper-${mode}`;

  return (
    <div className={`temporal-graph-panel temporal-graph-panel-${mode}`} data-testid={`${mode}-graph-panel`} data-graph-mode={mode}>
      <div className="temporal-graph-heading">
        <span className="temporal-graph-title" id={headingId}>{mode === 'value' ? 'Value Graph' : 'Speed Graph'}</span>
        <span className={`temporal-graph-badge ${mode === 'value' ? 'is-editable' : 'is-derived'}`}>
          {mode === 'value' ? 'EDITABLE' : 'DERIVED · READ ONLY'}
        </span>
        <span className="temporal-graph-helper" id={helperId}>
          {mode === 'value'
            ? 'Drag keyframe points or use the Up and Down arrow keys to edit values'
            : 'Derived from the shared interpolation evaluator'}
        </span>
      </div>
      {sorted.length < 2 ? (
        <div style={{ color: '#a6a6a6', fontSize: 11 }}>Add at least two keyframes to display this graph.</div>
      ) : (
        <svg
          className={`temporal-graph-svg temporal-graph-svg-${mode}`}
          width={WIDTH}
          height={HEIGHT}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          data-axis-min={minValue}
          data-axis-max={maxValue}
          data-axis-unit={mode === 'value' ? 'value-units' : 'value-units/frame'}
          role="group"
          aria-labelledby={headingId}
          aria-describedby={helperId}
          onMouseMove={handleMouseMove}
          onMouseUp={endPointDrag}
          onMouseLeave={endPointDrag}
          onPointerCancel={endPointDrag}
          onLostPointerCapture={endPointDrag}
          style={{ width: '100%', maxWidth: WIDTH, background: '#272727', border: '1px solid #383838', borderRadius: 4 }}
        >
          <line x1={PAD_LEFT} y1={HEIGHT - PAD} x2={WIDTH - PAD} y2={HEIGHT - PAD} stroke="#414141" aria-hidden="true" />
          <line x1={PAD_LEFT} y1={PAD} x2={PAD_LEFT} y2={HEIGHT - PAD} stroke="#414141" aria-hidden="true" />
          {/* D1 Increment 1: readable axes. Decorative for AT (the helper text
           * states the interaction contract); the numbers mirror the domain
           * the curve was drawn with. C8: the value labels sit in the left
           * gutter level with their gridline, the unit above the plot, and
           * the segment badges on the frame row under the axis, so no label
           * lies on a point or on the curve. */}
          <text className="temporal-graph-axis-label" x={PAD_LEFT - 10} y={PAD + 3} fontSize={9} fill="#a6a6a6" textAnchor="end" aria-hidden="true">{fmt(maxValue)}</text>
          <text className="temporal-graph-axis-label" x={PAD_LEFT - 10} y={HEIGHT - PAD + 3} fontSize={9} fill="#a6a6a6" textAnchor="end" aria-hidden="true">{fmt(minValue)}</text>
          <text className="temporal-graph-axis-label" x={PAD_LEFT} y={12} fontSize={9} fill="#787878" aria-hidden="true">
            {mode === 'value' ? 'value units' : 'value units / frame'}
          </text>
          <text className="temporal-graph-axis-label" x={PAD_LEFT} y={HEIGHT - 8} fontSize={8} fill="#787878" aria-hidden="true">F{startFrame}</text>
          <text className="temporal-graph-axis-label" x={WIDTH - PAD} y={HEIGHT - 8} fontSize={8} fill="#787878" textAnchor="end" aria-hidden="true">F{endFrame}</text>
          {/* One badge per segment, named by the branch the authority ACTUALLY
           * takes (V6 full precedence): HOLD > complete handle pair > stored
           * controlPoints > autoBezier > named. The classification comes from
           * effectiveSegmentAuthority in defaults.ts — the authority's own
           * module, not a second evaluator. Screen-reader semantics ride on
           * the badge itself (role=img + aria-label), so the truth is not
           * carried by an aria-hidden decoration alone. */}
          {sorted.slice(0, -1).map((keyframe, index) => {
            const next = sorted[index + 1];
            const authority = effectiveSegmentAuthority(keyframe, next);
            const badgeEasing = authority === 'handles'
              ? 'bezier'
              : authority === 'controlPoints'
                ? 'cubic_bezier'
                : keyframe.easing;
            const badgeText = EASING_BADGE[badgeEasing] ?? badgeEasing;
            return (
              <text
                key={`badge-${keyframe.id}`}
                className="temporal-graph-segment-badge"
                data-segment-easing={badgeEasing}
                x={toSvg((keyframe.frame + next.frame) / 2, minValue).x}
                y={HEIGHT - 8}
                fontSize={8}
                fill="#787878"
                textAnchor="middle"
                role="img"
                aria-label={`Segment frame ${keyframe.frame} to ${next.frame}: ${badgeText === 'IN/OUT' ? 'ease in out' : badgeText}`}
              >
                {badgeText}
              </text>
            );
          })}
          <path d={pathD} fill={mode === 'speed' ? 'rgba(166, 166, 166, .12)' : 'none'} stroke={mode === 'value' ? '#5a98e9' : '#a6a6a6'} strokeWidth={2} strokeDasharray={mode === 'speed' ? '6 5' : undefined} aria-hidden="true" />
          {mode === 'value' && sorted.map((keyframe) => {
            const point = toSvg(keyframe.frame, keyframe.value);
            return (
              <circle
                key={keyframe.id}
                cx={point.x}
                cy={point.y}
                r={5}
                fill="#fafafa"
                stroke="#5a98e9"
                strokeWidth={2}
                tabIndex={0}
                role="button"
                onMouseDown={(event) => {
                  event.stopPropagation();
                  dragDomainRef.current = { min: minValue, max: maxValue };
                  setDraggingId(keyframe.id);
                  onInteractionStart?.();
                }}
                aria-label={`Keyframe at frame ${keyframe.frame}, value ${keyframe.value.toFixed(2)}, use the Up and Down arrow keys to change it`}
                onKeyDown={(event) => handleKeyframeKeyDown(event, keyframe)}
              />
            );
          })}
        </svg>
      )}
      {mode === 'value' && onChangeKeyframeHandles && sorted.map((keyframe) => (
        <div key={`${keyframe.id}-handles`} style={{ display: 'grid', gridTemplateColumns: 'auto repeat(4, 1fr) minmax(96px, 1.3fr)', gap: 4, alignItems: 'center', marginTop: 4 }}>
          <span style={{ fontSize: 10, color: '#a6a6a6' }}>F{keyframe.frame}</span>
          {(['bezierIn', 'bezierOut'] as const).flatMap((handleName) => (['x', 'y'] as const).map((axis) => (
            <NumberField
              key={`${keyframe.id}-${handleName}-${axis}`}
              className="input-control"
              step={0.05}
              aria-label={`Keyframe ${keyframe.frame} ${handleName} ${axis}`}
              value={keyframe[handleName]?.[axis] ?? (axis === 'x' ? 0.33 : 0)}
              onValue={(next) => onChangeKeyframeHandles(keyframe.id, {
                [handleName]: {
                  ...(keyframe[handleName] ?? { x: 0.33, y: 0 }),
                  [axis]: next,
                },
              })}
            />
          )))}
          {/* E1/V6: built-in curve presets applied to the OUTGOING SEGMENT of
           * this keyframe — both endpoints, one atomic write, one undo entry
           * (the evaluator needs the complete pair). Explicitly DISABLED, not
           * silently inert, where the evaluator would ignore the pair: HOLD
           * start keys and the last key (no outgoing segment). Transient
           * control: a preset is an action, not state. */}
          {onApplySegmentPreset && (() => {
            const isLastOfScope = sorted.findIndex((candidate) => candidate.id === keyframe.id) === sorted.length - 1;
            const blocked = keyframe.easing === 'hold'
              ? 'Hold outranks curve presets in the evaluator'
              : isLastOfScope
                ? 'No outgoing segment starts at this keyframe'
                : undefined;
            return (
              <select
                className="select-control"
                aria-label={`Apply easing preset to segment starting at frame ${keyframe.frame}`}
                disabled={blocked !== undefined}
                title={blocked}
                value=""
                onChange={(event) => {
                  const preset = PRESET_BEZIERS.find((candidate) => candidate.label === event.target.value);
                  if (!preset) return;
                  const [x1, y1, x2, y2] = preset.points;
                  onApplySegmentPreset(keyframe.id, { x: x1, y: y1 }, { x: x2, y: y2 });
                  event.currentTarget.value = '';
                }}
              >
                <option value="">Preset…</option>
                {PRESET_BEZIERS.map((preset) => (
                  <option key={preset.label} value={preset.label}>{preset.label}</option>
                ))}
              </select>
            );
          })()}
        </div>
      ))}
    </div>
  );
};
