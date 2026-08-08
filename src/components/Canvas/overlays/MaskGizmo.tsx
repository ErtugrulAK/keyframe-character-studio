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
  const invScale = zoomLevel; // zScale = 1/zoom — screen-constant sizing

  const sX = transform.scaleX;
  const sY = transform.scaleY;

  // --- Identify corner points for resize cursors ---
  // Corner cursors only make sense for masks with ≥4 points.
  // Find the 4 extreme points that form the bounding box and assign
  // nwse-resize (TL + BR) and nesw-resize (TR + BL).
  const cornerIndices = new Set<number>();
  if (points.length >= 4) {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    for (const pt of points) {
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
    }
    const candidates: Array<{ idx: number; d: number; label: string }> = [];
    points.forEach((pt, i) => {
      candidates.push(
        { idx: i, d: Math.hypot(pt.x - minX, pt.y - minY), label: 'TL' },
        { idx: i, d: Math.hypot(pt.x - maxX, pt.y - minY), label: 'TR' },
        { idx: i, d: Math.hypot(pt.x - maxX, pt.y - maxY), label: 'BR' },
        { idx: i, d: Math.hypot(pt.x - minX, pt.y - maxY), label: 'BL' },
      );
    });
    // Dedupe: only keep the best (closest) per label
    const best: Record<string, { idx: number; d: number }> = {};
    for (const c of candidates) {
      if (!best[c.label] || c.d < best[c.label].d) {
        best[c.label] = { idx: c.idx, d: c.d };
      }
    }
    for (const { idx } of Object.values(best)) cornerIndices.add(idx);
  }

  const getCornerCursor = (i: number): string => {
    if (!cornerIndices.has(i)) return 'pointer';
    // Determine whether TL/BR (nwse) or TR/BL (nesw)
    const pt = points[i];
    // Simple heuristic: points with roughly equal x+y offsets from centroid
    // are on the TL→BR diagonal; the other two are TR→BL.
    const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
    const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
    const relX = pt.x - cx;
    const relY = pt.y - cy;
    // TL/BR have same-sign offset products (both negative or both positive)
    // TR/BL have opposite-sign offset products
    if (Math.sign(relX) === Math.sign(relY) || (relX === 0 && relY === 0)) {
      return 'nwse-resize'; // TL · BR diagonal
    }
    return 'nesw-resize';   // TR · BL diagonal
  };

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
                r={6 * invScale}
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
                r={6 * invScale}
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
            x={(pt.x * sX) - 7 * invScale}
            y={(pt.y * sY) - 7 * invScale}
            width={14 * invScale}
            height={14 * invScale}
            fill="#ffffff"
            stroke="#00d2ff"
            strokeWidth={1.5 * invScale}
            style={{ cursor: getCornerCursor(i), pointerEvents: 'all' }}
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
