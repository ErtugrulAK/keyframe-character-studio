import React, { useMemo, useState } from 'react';
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
  const startFrame = sorted[0]?.frame ?? 0;
  const endFrame = sorted[sorted.length - 1]?.frame ?? 1;
  const frameRange = Math.max(1, endFrame - startFrame);
  const toSvg = (frame: number, value: number): { x: number; y: number } => ({
    x: PAD + ((frame - startFrame) / frameRange) * (WIDTH - PAD * 2),
    y: HEIGHT - PAD - ((value - minValue) / valueRange) * (HEIGHT - PAD * 2),
  });
  const toValue = (clientY: number, rect: DOMRect): number => {
    const normalized = clamp((clientY - rect.top - PAD) / (HEIGHT - PAD * 2), 0, 1);
    return maxValue - normalized * valueRange;
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

  return (
    <div className="temporal-graph-panel" data-testid={`${mode}-graph-panel`}>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#cbd5e1', marginBottom: 4 }}>
        {mode === 'value' ? 'Value Graph' : 'Speed Graph'}
        {mode === 'value' && <span style={{ marginLeft: 8, color: '#94a3b8', fontWeight: 500 }}>Drag keyframe points to edit values</span>}
        {mode === 'speed' && <span style={{ marginLeft: 8, color: '#94a3b8', fontWeight: 500 }}>Derived from the shared interpolation evaluator</span>}
      </div>
      {sorted.length < 2 ? (
        <div style={{ color: '#94a3b8', fontSize: 11 }}>Add at least two keyframes to display this graph.</div>
      ) : (
        <svg
          width={WIDTH}
          height={HEIGHT}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={`${mode === 'value' ? 'Value' : 'Speed'} graph`}
          onMouseMove={handleMouseMove}
          onMouseUp={() => setDraggingId(null)}
          onMouseLeave={() => setDraggingId(null)}
          style={{ width: '100%', maxWidth: WIDTH, background: '#111827', border: '1px solid #293548', borderRadius: 4 }}
        >
          <line x1={PAD} y1={HEIGHT - PAD} x2={WIDTH - PAD} y2={HEIGHT - PAD} stroke="#334155" />
          <line x1={PAD} y1={PAD} x2={PAD} y2={HEIGHT - PAD} stroke="#334155" />
          <path d={pathD} fill="none" stroke={mode === 'value' ? '#22d3ee' : '#f59e0b'} strokeWidth={2} />
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
                aria-label={`Keyframe ${keyframe.frame}`}
                onMouseDown={(event) => { event.stopPropagation(); setDraggingId(keyframe.id); }}
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
