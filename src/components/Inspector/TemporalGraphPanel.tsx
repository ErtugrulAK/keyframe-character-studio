import React, { useMemo, useRef, useState } from 'react';
import type { PropertyKeyframe, TemporalHandle } from '../../types/animator';
import { interpolateChannel } from '../../utils/defaults';

interface TemporalHandlePatch {
  bezierIn?: TemporalHandle;
  bezierOut?: TemporalHandle;
}

interface TemporalGraphPanelProps {
  keyframes: PropertyKeyframe[];
  mode: 'value' | 'speed';
  onChangeKeyframeValue?: (keyframeId: string, value: number) => void;
  onChangeKeyframeHandles?: (keyframeId: string, patch: TemporalHandlePatch) => void;
}

interface GraphPoint {
  frame: number;
  value: number;
}

const WIDTH = 520;
const HEIGHT = 190;
const PAD = 24;
const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export const TemporalGraphPanel: React.FC<TemporalGraphPanelProps> = ({
  keyframes,
  mode,
  onChangeKeyframeValue,
  onChangeKeyframeHandles,
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
  const minValue = Math.min(...graphValues, 0);
  const maxValue = Math.max(...graphValues, 1);
  const valueRange = Math.max(1e-6, maxValue - minValue);
  const activeMinValue = dragDomainRef.current?.min ?? minValue;
  const activeMaxValue = dragDomainRef.current?.max ?? maxValue;
  const activeValueRange = Math.max(1e-6, activeMaxValue - activeMinValue);
  const startFrame = sorted[0]?.frame ?? 0;
  const endFrame = sorted[sorted.length - 1]?.frame ?? 1;
  const frameRange = Math.max(1, endFrame - startFrame);
  const toSvg = (frame: number, value: number): { x: number; y: number } => ({
    x: PAD + ((frame - startFrame) / frameRange) * (WIDTH - PAD * 2),
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

  return (
    <div className={`temporal-graph-panel temporal-graph-panel-${mode}`} data-testid={`${mode}-graph-panel`} data-graph-mode={mode}>
      <div className="temporal-graph-heading">
        <span className="temporal-graph-title">{mode === 'value' ? 'Value Graph' : 'Speed Graph'}</span>
        <span className={`temporal-graph-badge ${mode === 'value' ? 'is-editable' : 'is-derived'}`}>
          {mode === 'value' ? 'EDITABLE' : 'DERIVED · READ ONLY'}
        </span>
        <span className="temporal-graph-helper">
          {mode === 'value' ? 'Drag keyframe points to edit values' : 'Derived from the shared interpolation evaluator'}
        </span>
      </div>
      {sorted.length < 2 ? (
        <div style={{ color: '#94a3b8', fontSize: 11 }}>Add at least two keyframes to display this graph.</div>
      ) : (
        <svg
          className={`temporal-graph-svg temporal-graph-svg-${mode}`}
          width={WIDTH}
          height={HEIGHT}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={`${mode === 'value' ? 'Value' : 'Speed'} graph`}
          onMouseMove={handleMouseMove}
          onMouseUp={() => {
            setDraggingId(null);
            dragDomainRef.current = null;
          }}
          onMouseLeave={() => {
            setDraggingId(null);
            dragDomainRef.current = null;
          }}
          style={{ width: '100%', maxWidth: WIDTH, background: '#111827', border: '1px solid #293548', borderRadius: 4 }}
        >
          <line x1={PAD} y1={HEIGHT - PAD} x2={WIDTH - PAD} y2={HEIGHT - PAD} stroke="#334155" />
          <line x1={PAD} y1={PAD} x2={PAD} y2={HEIGHT - PAD} stroke="#334155" />
          <path d={pathD} fill={mode === 'speed' ? 'rgba(148,163,184,.12)' : 'none'} stroke={mode === 'value' ? '#22d3ee' : '#94a3b8'} strokeWidth={2} strokeDasharray={mode === 'speed' ? '6 5' : undefined} />
          {mode === 'value' && sorted.map((keyframe) => {
            const point = toSvg(keyframe.frame, keyframe.value);
            return (
              <circle
                key={keyframe.id}
                cx={point.x}
                cy={point.y}
                r={5}
                fill="#f8fafc"
                stroke="#22d3ee"
                strokeWidth={2}
                tabIndex={0}
                role="button"
                onMouseDown={(event) => {
                  event.stopPropagation();
                  dragDomainRef.current = { min: minValue, max: maxValue };
                  setDraggingId(keyframe.id);
                }}
                aria-label={`Keyframe ${keyframe.frame}`}
                onKeyDown={(event) => handleKeyframeKeyDown(event, keyframe)}
              />
            );
          })}
        </svg>
      )}
      {mode === 'value' && onChangeKeyframeHandles && sorted.map((keyframe) => (
        <div key={`${keyframe.id}-handles`} style={{ display: 'grid', gridTemplateColumns: 'auto repeat(4, 1fr)', gap: 4, alignItems: 'center', marginTop: 4 }}>
          <span style={{ fontSize: 10, color: '#94a3b8' }}>F{keyframe.frame}</span>
          {(['bezierIn', 'bezierOut'] as const).flatMap((handleName) => (['x', 'y'] as const).map((axis) => (
            <input
              key={`${keyframe.id}-${handleName}-${axis}`}
              className="input-control"
              type="number"
              step={0.05}
              aria-label={`Keyframe ${keyframe.frame} ${handleName} ${axis}`}
              value={keyframe[handleName]?.[axis] ?? (axis === 'x' ? 0.33 : 0)}
              onChange={(event) => onChangeKeyframeHandles(keyframe.id, {
                [handleName]: {
                  ...(keyframe[handleName] ?? { x: 0.33, y: 0 }),
                  [axis]: Number(event.target.value),
                },
              })}
            />
          )))}
        </div>
      ))}
    </div>
  );
};
