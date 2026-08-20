import React, { useState } from 'react';
import { Move } from 'lucide-react';
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

/**
 * 4 control points (stage X & Y coordinates) editor.
 * Supports two modes: edge midpoints and corner points, each anchored to the
 * strict opposite anchor so dragging one point only stretches one side.
 */
export const TransformControlPoints: React.FC<TransformControlPointsProps> = ({ selectedPart, transform, coordinateSystem, onUpdate }) => {
  const [pointMode, setPointMode] = useState<'edge' | 'corner'>('corner');

  const { halfW: baseHalfW, halfH: baseHalfH } = getPartBounds(selectedPart);
  const currentHalfW = Math.round(baseHalfW * transform.scaleX);
  const currentHalfH = Math.round(baseHalfH * transform.scaleY);

  const cx = transform.x;
  const cy = -transform.y; // Cartesian Y
  const positionDisplayScale = coordinateSystem === 'legacy-unknown' || coordinateSystem === 'legacy-centi-unit' ? 0.01 : undefined;

  return (
    <div className="panel-card" style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 6, letterSpacing: '0.4px' }}>
          <Move size={13} /> 4 CONTROL POINTS (X/Y)
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            type="button"
            className="btn-secondary"
            style={{
              height: 20,
              fontSize: 9,
              fontWeight: 700,
              padding: '0 6px',
              color: pointMode === 'edge' ? '#38bdf8' : '#64748b',
              background: pointMode === 'edge' ? 'rgba(56, 189, 248, 0.15)' : '#0e1118',
              border: `1px solid ${pointMode === 'edge' ? '#38bdf8' : '#232836'}`,
              borderRadius: 3,
            }}
            onClick={() => setPointMode('edge')}
          >
            Edge Points
          </button>
          <button
            type="button"
            className="btn-secondary"
            style={{
              height: 20,
              fontSize: 9,
              fontWeight: 700,
              padding: '0 6px',
              color: pointMode === 'corner' ? '#c084fc' : '#64748b',
              background: pointMode === 'corner' ? 'rgba(192, 132, 252, 0.15)' : '#0e1118',
              border: `1px solid ${pointMode === 'corner' ? '#c084fc' : '#232836'}`,
              borderRadius: 3,
            }}
            onClick={() => setPointMode('corner')}
          >
            Corners
          </button>
        </div>
      </div>

      {pointMode === 'edge' ? (
        /* ── 4 EDGE MIDPOINTS (STRICT OPPOSITE ANCHOR ISOLATION) ── */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {/* LEFT EDGE POINT */}
          <div style={{ background: '#0e1118', padding: '6px 8px', borderRadius: 5, border: '1px solid #232836' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#38bdf8' }} /> LEFT POINT
              </span>
            </div>
            <div className="form-field-group" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-color)", padding: "4px 8px", borderRadius: "var(--radius-sm)", justifyContent: "space-between", margin: 0,  marginBottom: 4 }}>
              <span className="form-label text-red" style={{ fontSize: 9 }}>X</span>
              <SmartNumberInput
                value={cx - currentHalfW}
                step={1}
                displayScale={positionDisplayScale}
                precision={2}
                onChange={(targetLeftX) => {
                  const fixedRightX = cx + currentHalfW;
                  const validLeftX = Math.min(fixedRightX, targetLeftX);
                  const newWidth = fixedRightX - validLeftX;
                  const newScaleX = parseFloat((newWidth / (2 * baseHalfW)).toFixed(3));
                  const newCx = Math.round((validLeftX + fixedRightX) / 2);
                  onUpdate({ scaleX: newScaleX, x: newCx });
                }}
              />
            </div>
            <div className="form-field-group" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-color)", padding: "4px 8px", borderRadius: "var(--radius-sm)", justifyContent: "space-between", margin: 0 }}>
              <span className="form-label text-green" style={{ fontSize: 9 }}>Y</span>
              <SmartNumberInput
                value={cy}
                step={1}
                displayScale={positionDisplayScale}
                precision={2}
                onChange={(targetY) => onUpdate({ y: -targetY })}
              />
            </div>
          </div>

          {/* RIGHT EDGE POINT */}
          <div style={{ background: '#0e1118', padding: '6px 8px', borderRadius: 5, border: '1px solid #232836' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#38bdf8' }} /> RIGHT POINT
              </span>
            </div>
            <div className="form-field-group" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-color)", padding: "4px 8px", borderRadius: "var(--radius-sm)", justifyContent: "space-between", margin: 0,  marginBottom: 4 }}>
              <span className="form-label text-red" style={{ fontSize: 9 }}>X</span>
              <SmartNumberInput
                value={cx + currentHalfW}
                step={1}
                displayScale={positionDisplayScale}
                precision={2}
                onChange={(targetRightX) => {
                  const fixedLeftX = cx - currentHalfW;
                  const validRightX = Math.max(fixedLeftX, targetRightX);
                  const newWidth = validRightX - fixedLeftX;
                  const newScaleX = parseFloat((newWidth / (2 * baseHalfW)).toFixed(3));
                  const newCx = Math.round((fixedLeftX + validRightX) / 2);
                  onUpdate({ scaleX: newScaleX, x: newCx });
                }}
              />
            </div>
            <div className="form-field-group" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-color)", padding: "4px 8px", borderRadius: "var(--radius-sm)", justifyContent: "space-between", margin: 0 }}>
              <span className="form-label text-green" style={{ fontSize: 9 }}>Y</span>
              <SmartNumberInput
                value={cy}
                step={1}
                displayScale={positionDisplayScale}
                precision={2}
                onChange={(targetY) => onUpdate({ y: -targetY })}
              />
            </div>
          </div>

          {/* TOP EDGE POINT */}
          <div style={{ background: '#0e1118', padding: '6px 8px', borderRadius: 5, border: '1px solid #232836' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#c084fc', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#c084fc' }} /> TOP POINT
              </span>
            </div>
            <div className="form-field-group" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-color)", padding: "4px 8px", borderRadius: "var(--radius-sm)", justifyContent: "space-between", margin: 0,  marginBottom: 4 }}>
              <span className="form-label text-red" style={{ fontSize: 9 }}>X</span>
              <SmartNumberInput
                value={cx}
                step={1}
                displayScale={positionDisplayScale}
                precision={2}
                onChange={(targetX) => onUpdate({ x: targetX })}
              />
            </div>
            <div className="form-field-group" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-color)", padding: "4px 8px", borderRadius: "var(--radius-sm)", justifyContent: "space-between", margin: 0 }}>
              <span className="form-label text-green" style={{ fontSize: 9 }}>Y</span>
              <SmartNumberInput
                value={cy + currentHalfH}
                step={1}
                displayScale={positionDisplayScale}
                precision={2}
                onChange={(targetTopY) => {
                  const fixedBottomY = cy - currentHalfH;
                  const validTopY = Math.max(fixedBottomY, targetTopY);
                  const newHeight = validTopY - fixedBottomY;
                  const newScaleY = parseFloat((newHeight / (2 * baseHalfH)).toFixed(3));
                  const newCy = Math.round((validTopY + fixedBottomY) / 2);
                  onUpdate({ scaleY: newScaleY, y: -newCy });
                }}
              />
            </div>
          </div>

          {/* BOTTOM EDGE POINT */}
          <div style={{ background: '#0e1118', padding: '6px 8px', borderRadius: 5, border: '1px solid #232836' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#c084fc', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#c084fc' }} /> BOTTOM POINT
              </span>
            </div>
            <div className="form-field-group" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-color)", padding: "4px 8px", borderRadius: "var(--radius-sm)", justifyContent: "space-between", margin: 0,  marginBottom: 4 }}>
              <span className="form-label text-red" style={{ fontSize: 9 }}>X</span>
              <SmartNumberInput
                value={cx}
                step={1}
                displayScale={positionDisplayScale}
                precision={2}
                onChange={(targetX) => onUpdate({ x: targetX })}
              />
            </div>
            <div className="form-field-group" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-color)", padding: "4px 8px", borderRadius: "var(--radius-sm)", justifyContent: "space-between", margin: 0 }}>
              <span className="form-label text-green" style={{ fontSize: 9 }}>Y</span>
              <SmartNumberInput
                value={cy - currentHalfH}
                step={1}
                displayScale={positionDisplayScale}
                precision={2}
                onChange={(targetBottomY) => {
                  const fixedTopY = cy + currentHalfH;
                  const validBottomY = Math.min(fixedTopY, targetBottomY);
                  const newHeight = fixedTopY - validBottomY;
                  const newScaleY = parseFloat((newHeight / (2 * baseHalfH)).toFixed(3));
                  const newCy = Math.round((fixedTopY + validBottomY) / 2);
                  onUpdate({ scaleY: newScaleY, y: -newCy });
                }}
              />
            </div>
          </div>
        </div>
      ) : (
        /* ── 4 CORNER POINTS (TL, TR, BR, BL) (STRICT OPPOSITE ANCHOR ISOLATION) ── */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {/* TOP-LEFT (TL) */}
          <div style={{ background: '#0e1118', padding: '6px 8px', borderRadius: 5, border: '1px solid #232836' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#38bdf8', display: 'block', marginBottom: 4 }}>
              ↖ TOP-LEFT (TL)
            </span>
            <div className="form-field-group" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-color)", padding: "4px 8px", borderRadius: "var(--radius-sm)", justifyContent: "space-between", margin: 0,  marginBottom: 4 }}>
              <span className="form-label text-red" style={{ fontSize: 9 }}>X</span>
              <SmartNumberInput
                value={cx - currentHalfW}
                step={1}
                displayScale={positionDisplayScale}
                precision={2}
                onChange={(targetTLX) => {
                  const fixedRightX = cx + currentHalfW;
                  const validTLX = Math.min(fixedRightX, targetTLX);
                  const newWidth = fixedRightX - validTLX;
                  const newScaleX = parseFloat((newWidth / (2 * baseHalfW)).toFixed(3));
                  const newCx = Math.round((validTLX + fixedRightX) / 2);
                  onUpdate({ scaleX: newScaleX, x: newCx });
                }}
              />
            </div>
            <div className="form-field-group" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-color)", padding: "4px 8px", borderRadius: "var(--radius-sm)", justifyContent: "space-between", margin: 0 }}>
              <span className="form-label text-green" style={{ fontSize: 9 }}>Y</span>
              <SmartNumberInput
                value={cy + currentHalfH}
                step={1}
                displayScale={positionDisplayScale}
                precision={2}
                onChange={(targetTLY) => {
                  const fixedBottomY = cy - currentHalfH;
                  const validTLY = Math.max(fixedBottomY, targetTLY);
                  const newHeight = validTLY - fixedBottomY;
                  const newScaleY = parseFloat((newHeight / (2 * baseHalfH)).toFixed(3));
                  const newCy = Math.round((validTLY + fixedBottomY) / 2);
                  onUpdate({ scaleY: newScaleY, y: -newCy });
                }}
              />
            </div>
          </div>

          {/* TOP-RIGHT (TR) */}
          <div style={{ background: '#0e1118', padding: '6px 8px', borderRadius: 5, border: '1px solid #232836' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#10b981', display: 'block', marginBottom: 4 }}>
              ↗ TOP-RIGHT (TR)
            </span>
            <div className="form-field-group" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-color)", padding: "4px 8px", borderRadius: "var(--radius-sm)", justifyContent: "space-between", margin: 0,  marginBottom: 4 }}>
              <span className="form-label text-red" style={{ fontSize: 9 }}>X</span>
              <SmartNumberInput
                value={cx + currentHalfW}
                step={1}
                displayScale={positionDisplayScale}
                precision={2}
                onChange={(targetTRX) => {
                  const fixedLeftX = cx - currentHalfW;
                  const validTRX = Math.max(fixedLeftX, targetTRX);
                  const newWidth = validTRX - fixedLeftX;
                  const newScaleX = parseFloat((newWidth / (2 * baseHalfW)).toFixed(3));
                  const newCx = Math.round((fixedLeftX + validTRX) / 2);
                  onUpdate({ scaleX: newScaleX, x: newCx });
                }}
              />
            </div>
            <div className="form-field-group" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-color)", padding: "4px 8px", borderRadius: "var(--radius-sm)", justifyContent: "space-between", margin: 0 }}>
              <span className="form-label text-green" style={{ fontSize: 9 }}>Y</span>
              <SmartNumberInput
                value={cy + currentHalfH}
                step={1}
                displayScale={positionDisplayScale}
                precision={2}
                onChange={(targetTRY) => {
                  const fixedBottomY = cy - currentHalfH;
                  const validTRY = Math.max(fixedBottomY, targetTRY);
                  const newHeight = validTRY - fixedBottomY;
                  const newScaleY = parseFloat((newHeight / (2 * baseHalfH)).toFixed(3));
                  const newCy = Math.round((validTRY + fixedBottomY) / 2);
                  onUpdate({ scaleY: newScaleY, y: -newCy });
                }}
              />
            </div>
          </div>

          {/* BOTTOM-LEFT (BL) */}
          <div style={{ background: '#0e1118', padding: '6px 8px', borderRadius: 5, border: '1px solid #232836' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#c084fc', display: 'block', marginBottom: 4 }}>
              ↙ BOTTOM-LEFT (BL)
            </span>
            <div className="form-field-group" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-color)", padding: "4px 8px", borderRadius: "var(--radius-sm)", justifyContent: "space-between", margin: 0,  marginBottom: 4 }}>
              <span className="form-label text-red" style={{ fontSize: 9 }}>X</span>
              <SmartNumberInput
                value={cx - currentHalfW}
                step={1}
                displayScale={positionDisplayScale}
                precision={2}
                onChange={(targetBLX) => {
                  const fixedRightX = cx + currentHalfW;
                  const validBLX = Math.min(fixedRightX, targetBLX);
                  const newWidth = fixedRightX - validBLX;
                  const newScaleX = parseFloat((newWidth / (2 * baseHalfW)).toFixed(3));
                  const newCx = Math.round((validBLX + fixedRightX) / 2);
                  onUpdate({ scaleX: newScaleX, x: newCx });
                }}
              />
            </div>
            <div className="form-field-group" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-color)", padding: "4px 8px", borderRadius: "var(--radius-sm)", justifyContent: "space-between", margin: 0 }}>
              <span className="form-label text-green" style={{ fontSize: 9 }}>Y</span>
              <SmartNumberInput
                value={cy - currentHalfH}
                step={1}
                displayScale={positionDisplayScale}
                precision={2}
                onChange={(targetBLY) => {
                  const fixedTopY = cy + currentHalfH;
                  const validBLY = Math.min(fixedTopY, targetBLY);
                  const newHeight = fixedTopY - validBLY;
                  const newScaleY = parseFloat((newHeight / (2 * baseHalfH)).toFixed(3));
                  const newCy = Math.round((fixedTopY + validBLY) / 2);
                  onUpdate({ scaleY: newScaleY, y: -newCy });
                }}
              />
            </div>
          </div>

          {/* BOTTOM-RIGHT (BR) */}
          <div style={{ background: '#0e1118', padding: '6px 8px', borderRadius: 5, border: '1px solid #232836' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', display: 'block', marginBottom: 4 }}>
              ↘ BOTTOM-RIGHT (BR)
            </span>
            <div className="form-field-group" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-color)", padding: "4px 8px", borderRadius: "var(--radius-sm)", justifyContent: "space-between", margin: 0,  marginBottom: 4 }}>
              <span className="form-label text-red" style={{ fontSize: 9 }}>X</span>
              <SmartNumberInput
                value={cx + currentHalfW}
                step={1}
                displayScale={positionDisplayScale}
                precision={2}
                onChange={(targetBRX) => {
                  const fixedLeftX = cx - currentHalfW;
                  const validBRX = Math.max(fixedLeftX, targetBRX);
                  const newWidth = validBRX - fixedLeftX;
                  const newScaleX = parseFloat((newWidth / (2 * baseHalfW)).toFixed(3));
                  const newCx = Math.round((fixedLeftX + validBRX) / 2);
                  onUpdate({ scaleX: newScaleX, x: newCx });
                }}
              />
            </div>
            <div className="form-field-group" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-color)", padding: "4px 8px", borderRadius: "var(--radius-sm)", justifyContent: "space-between", margin: 0 }}>
              <span className="form-label text-green" style={{ fontSize: 9 }}>Y</span>
              <SmartNumberInput
                value={cy - currentHalfH}
                step={1}
                displayScale={positionDisplayScale}
                precision={2}
                onChange={(targetBRY) => {
                  const fixedTopY = cy + currentHalfH;
                  const validBRY = Math.min(fixedTopY, targetBRY);
                  const newHeight = fixedTopY - validBRY;
                  const newScaleY = parseFloat((newHeight / (2 * baseHalfH)).toFixed(3));
                  const newCy = Math.round((fixedTopY + validBRY) / 2);
                  onUpdate({ scaleY: newScaleY, y: -newCy });
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
