import React, { useState } from 'react';
import type { CharacterPart, Transform } from '../../../../types/animator';
import type { SceneCoordinateSystem } from '../../../../types/composition';
import { getPartBounds } from '../../../../utils/bounds';
import { SmartNumberInput } from '../../inputs/SmartNumberInput';

interface TransformControlPointsProps {
  selectedPart: CharacterPart;
  transform: Transform;
  coordinateSystem: SceneCoordinateSystem;
  onUpdate: (partial: Partial<Transform>) => void;
}

interface ControlPointRow {
  key: string;
  label: string;
  x: number;
  y: number;
  onXChange: (value: number) => void;
  onYChange: (value: number) => void;
}

/**
 * Four control points (stage X/Y coordinates) in a compact matrix.
 * Supports edge midpoints and corner points, each retaining the strict
 * opposite-anchor isolation used by the original editor.
 */
export const TransformControlPoints: React.FC<TransformControlPointsProps> = ({ selectedPart, transform, coordinateSystem, onUpdate }) => {
  const [pointMode, setPointMode] = useState<'edge' | 'corner'>('corner');

  const { halfW: baseHalfW, halfH: baseHalfH } = getPartBounds(selectedPart);
  const currentHalfW = Math.round(baseHalfW * transform.scaleX);
  const currentHalfH = Math.round(baseHalfH * transform.scaleY);

  const cx = transform.x;
  const cy = -transform.y; // Cartesian Y
  const positionDisplayScale = coordinateSystem === 'legacy-unknown' || coordinateSystem === 'legacy-centi-unit' ? 0.01 : undefined;

  const pointRows: ControlPointRow[] = pointMode === 'edge'
    ? [
        {
          key: 'left',
          label: 'LEFT POINT',
          x: cx - currentHalfW,
          y: cy,
          onXChange: (targetLeftX) => {
            const fixedRightX = cx + currentHalfW;
            const validLeftX = Math.min(fixedRightX, targetLeftX);
            const newWidth = fixedRightX - validLeftX;
            const newScaleX = parseFloat((newWidth / (2 * baseHalfW)).toFixed(3));
            const newCx = Math.round((validLeftX + fixedRightX) / 2);
            onUpdate({ scaleX: newScaleX, x: newCx });
          },
          onYChange: (targetY) => onUpdate({ y: -targetY }),
        },
        {
          key: 'right',
          label: 'RIGHT POINT',
          x: cx + currentHalfW,
          y: cy,
          onXChange: (targetRightX) => {
            const fixedLeftX = cx - currentHalfW;
            const validRightX = Math.max(fixedLeftX, targetRightX);
            const newWidth = validRightX - fixedLeftX;
            const newScaleX = parseFloat((newWidth / (2 * baseHalfW)).toFixed(3));
            const newCx = Math.round((fixedLeftX + validRightX) / 2);
            onUpdate({ scaleX: newScaleX, x: newCx });
          },
          onYChange: (targetY) => onUpdate({ y: -targetY }),
        },
        {
          key: 'top',
          label: 'TOP POINT',
          x: cx,
          y: cy + currentHalfH,
          onXChange: (targetX) => onUpdate({ x: targetX }),
          onYChange: (targetTopY) => {
            const fixedBottomY = cy - currentHalfH;
            const validTopY = Math.max(fixedBottomY, targetTopY);
            const newHeight = validTopY - fixedBottomY;
            const newScaleY = parseFloat((newHeight / (2 * baseHalfH)).toFixed(3));
            const newCy = Math.round((validTopY + fixedBottomY) / 2);
            onUpdate({ scaleY: newScaleY, y: -newCy });
          },
        },
        {
          key: 'bottom',
          label: 'BOTTOM POINT',
          x: cx,
          y: cy - currentHalfH,
          onXChange: (targetX) => onUpdate({ x: targetX }),
          onYChange: (targetBottomY) => {
            const fixedTopY = cy + currentHalfH;
            const validBottomY = Math.min(fixedTopY, targetBottomY);
            const newHeight = fixedTopY - validBottomY;
            const newScaleY = parseFloat((newHeight / (2 * baseHalfH)).toFixed(3));
            const newCy = Math.round((fixedTopY + validBottomY) / 2);
            onUpdate({ scaleY: newScaleY, y: -newCy });
          },
        },
      ]
    : [
        {
          key: 'top-left',
          label: 'TOP LEFT',
          x: cx - currentHalfW,
          y: cy + currentHalfH,
          onXChange: (targetTLX) => {
            const fixedRightX = cx + currentHalfW;
            const validTLX = Math.min(fixedRightX, targetTLX);
            const newWidth = fixedRightX - validTLX;
            const newScaleX = parseFloat((newWidth / (2 * baseHalfW)).toFixed(3));
            const newCx = Math.round((validTLX + fixedRightX) / 2);
            onUpdate({ scaleX: newScaleX, x: newCx });
          },
          onYChange: (targetTLY) => {
            const fixedBottomY = cy - currentHalfH;
            const validTLY = Math.max(fixedBottomY, targetTLY);
            const newHeight = validTLY - fixedBottomY;
            const newScaleY = parseFloat((newHeight / (2 * baseHalfH)).toFixed(3));
            const newCy = Math.round((validTLY + fixedBottomY) / 2);
            onUpdate({ scaleY: newScaleY, y: -newCy });
          },
        },
        {
          key: 'top-right',
          label: 'TOP RIGHT',
          x: cx + currentHalfW,
          y: cy + currentHalfH,
          onXChange: (targetTRX) => {
            const fixedLeftX = cx - currentHalfW;
            const validTRX = Math.max(fixedLeftX, targetTRX);
            const newWidth = validTRX - fixedLeftX;
            const newScaleX = parseFloat((newWidth / (2 * baseHalfW)).toFixed(3));
            const newCx = Math.round((fixedLeftX + validTRX) / 2);
            onUpdate({ scaleX: newScaleX, x: newCx });
          },
          onYChange: (targetTRY) => {
            const fixedBottomY = cy - currentHalfH;
            const validTRY = Math.max(fixedBottomY, targetTRY);
            const newHeight = validTRY - fixedBottomY;
            const newScaleY = parseFloat((newHeight / (2 * baseHalfH)).toFixed(3));
            const newCy = Math.round((validTRY + fixedBottomY) / 2);
            onUpdate({ scaleY: newScaleY, y: -newCy });
          },
        },
        {
          key: 'bottom-left',
          label: 'BOTTOM LEFT',
          x: cx - currentHalfW,
          y: cy - currentHalfH,
          onXChange: (targetBLX) => {
            const fixedRightX = cx + currentHalfW;
            const validBLX = Math.min(fixedRightX, targetBLX);
            const newWidth = fixedRightX - validBLX;
            const newScaleX = parseFloat((newWidth / (2 * baseHalfW)).toFixed(3));
            const newCx = Math.round((validBLX + fixedRightX) / 2);
            onUpdate({ scaleX: newScaleX, x: newCx });
          },
          onYChange: (targetBLY) => {
            const fixedTopY = cy + currentHalfH;
            const validBLY = Math.min(fixedTopY, targetBLY);
            const newHeight = fixedTopY - validBLY;
            const newScaleY = parseFloat((newHeight / (2 * baseHalfH)).toFixed(3));
            const newCy = Math.round((fixedTopY + validBLY) / 2);
            onUpdate({ scaleY: newScaleY, y: -newCy });
          },
        },
        {
          key: 'bottom-right',
          label: 'BOTTOM RIGHT',
          x: cx + currentHalfW,
          y: cy - currentHalfH,
          onXChange: (targetBRX) => {
            const fixedLeftX = cx - currentHalfW;
            const validBRX = Math.max(fixedLeftX, targetBRX);
            const newWidth = validBRX - fixedLeftX;
            const newScaleX = parseFloat((newWidth / (2 * baseHalfW)).toFixed(3));
            const newCx = Math.round((fixedLeftX + validBRX) / 2);
            onUpdate({ scaleX: newScaleX, x: newCx });
          },
          onYChange: (targetBRY) => {
            const fixedTopY = cy + currentHalfH;
            const validBRY = Math.min(fixedTopY, targetBRY);
            const newHeight = fixedTopY - validBRY;
            const newScaleY = parseFloat((newHeight / (2 * baseHalfH)).toFixed(3));
            const newCy = Math.round((fixedTopY + validBRY) / 2);
            onUpdate({ scaleY: newScaleY, y: -newCy });
          },
        },
      ];

  return (
    <div className="control-point-editor">
      <div className="control-point-mode-switch" role="group" aria-label="Control point mode">
        <button
          type="button"
          className={`btn-secondary ${pointMode === 'edge' ? 'is-active' : ''}`}
          aria-pressed={pointMode === 'edge'}
          onClick={() => setPointMode('edge')}
        >
          Edge Points
        </button>
        <button
          type="button"
          className={`btn-secondary ${pointMode === 'corner' ? 'is-active' : ''}`}
          aria-pressed={pointMode === 'corner'}
          onClick={() => setPointMode('corner')}
        >
          Corners
        </button>
      </div>

      <div className="control-point-matrix" role="grid" aria-label={`${pointMode === 'edge' ? 'Edge' : 'Corner'} control points`}>
        <div className="control-point-matrix-row control-point-matrix-header" role="row">
          <span role="columnheader" />
          <span role="columnheader">X</span>
          <span role="columnheader">Y</span>
        </div>
        {pointRows.map((row) => (
          <div className="control-point-matrix-row" role="row" key={row.key}>
            <span className="control-point-label" role="rowheader">
              <span className="control-point-dot" aria-hidden="true" />
              {row.label}
            </span>
            <SmartNumberInput
              value={row.x}
              step={1}
              displayScale={positionDisplayScale}
              precision={2}
              ariaLabel={`${row.label} X`}
              onChange={row.onXChange}
            />
            <SmartNumberInput
              value={row.y}
              step={1}
              displayScale={positionDisplayScale}
              precision={2}
              ariaLabel={`${row.label} Y`}
              onChange={row.onYChange}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
