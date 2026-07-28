import React from 'react';
import type { CharacterPart, Transform } from '../../../types/animator';

interface MaskGizmoProps {
  part: CharacterPart;
  transform: Transform;
  zoomLevel: number;
  onPointDragStart: (e: React.MouseEvent, pointIndex: number, handleType: 'point' | 'in' | 'out') => void;
}

export const MaskGizmo: React.FC<MaskGizmoProps> = ({ part, transform, zoomLevel, onPointDragStart }) => {
  if (!part.mask || !part.mask.enabled || !part.mask.points) return null;

  const points = part.mask.points;
  const invScale = zoomLevel; // Assuming zoomLevel is zScale passed from StageCanvas

  const sX = transform.scaleX;
  const sY = transform.scaleY;

  return (
    <g>
      {/* Draw lines connecting the points */}
      <path
        d={`M ${points.map(p => `${p.x * sX} ${p.y * sY}`).join(' L ')} ${part.mask.closed ? 'Z' : ''}`}
        fill="none"
        stroke="#00d2ff"
        strokeWidth={1.5 * invScale}
        strokeDasharray={`${4 * invScale},${4 * invScale}`}
        style={{ pointerEvents: 'none' }}
      />

      {/* Draw points and handles */}
      {points.map((pt, i) => (
        <g key={`point-${i}`}>
          {/* Handle In */}
          {pt.handleIn && (
            <>
              <line
                x1={pt.x * sX}
                y1={pt.y * sY}
                x2={(pt.x + pt.handleIn.x) * sX}
                y2={(pt.y + pt.handleIn.y) * sY}
                stroke="#a855f7"
                strokeWidth={1 * invScale}
                style={{ pointerEvents: 'none' }}
              />
              <circle
                cx={(pt.x + pt.handleIn.x) * sX}
                cy={(pt.y + pt.handleIn.y) * sY}
                r={4 * invScale}
                fill="#ffffff"
                stroke="#a855f7"
                strokeWidth={1.5 * invScale}
                style={{ cursor: 'pointer', pointerEvents: 'all' }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onPointDragStart(e, i, 'in');
                }}
              />
            </>
          )}

          {/* Handle Out */}
          {pt.handleOut && (
            <>
              <line
                x1={pt.x * sX}
                y1={pt.y * sY}
                x2={(pt.x + pt.handleOut.x) * sX}
                y2={(pt.y + pt.handleOut.y) * sY}
                stroke="#a855f7"
                strokeWidth={1 * invScale}
                style={{ pointerEvents: 'none' }}
              />
              <circle
                cx={(pt.x + pt.handleOut.x) * sX}
                cy={(pt.y + pt.handleOut.y) * sY}
                r={4 * invScale}
                fill="#ffffff"
                stroke="#a855f7"
                strokeWidth={1.5 * invScale}
                style={{ cursor: 'pointer', pointerEvents: 'all' }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onPointDragStart(e, i, 'out');
                }}
              />
            </>
          )}

          {/* Main Vertex Point */}
          <rect
            x={(pt.x * sX) - 4 * invScale}
            y={(pt.y * sY) - 4 * invScale}
            width={8 * invScale}
            height={8 * invScale}
            fill="#ffffff"
            stroke="#00d2ff"
            strokeWidth={1.5 * invScale}
            style={{ cursor: 'pointer', pointerEvents: 'all' }}
            onMouseDown={(e) => {
              e.stopPropagation();
              onPointDragStart(e, i, 'point');
            }}
          />
        </g>
      ))}
    </g>
  );
};
