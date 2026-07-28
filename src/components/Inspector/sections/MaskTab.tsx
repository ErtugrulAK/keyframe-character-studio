import React from 'react';
import type { CharacterPart, Transform } from '../../../types/animator';
import { useAnimator } from '../../../context/AnimatorContext';
import { Scissors } from 'lucide-react';

interface MaskTabProps {
  selectedPart: CharacterPart;
  transform: Transform;
  updateCurrentTransform: (newTransform: Partial<Transform>) => void;
}

export const MaskTab: React.FC<MaskTabProps> = ({ selectedPart, transform, updateCurrentTransform }) => {
  const { activeTool, setActiveTool } = useAnimator();
  
  const mask = transform.mask || selectedPart.mask || {
    enabled: false,
    inverted: false,
    feather: 0,
    opacity: 1,
    closed: true,
    points: []
  };

  const handleToggleMask = () => {
    if (!mask.enabled && mask.points.length === 0) {
      const w = selectedPart.width || 100;
      const h = selectedPart.height || 100;
      const defaultPoints = [
        { x: -w/2, y: -h/2 },
        { x: w/2, y: -h/2 },
        { x: w/2, y: h/2 },
        { x: -w/2, y: h/2 }
      ];
      updateCurrentTransform({ mask: { ...mask, enabled: true, points: defaultPoints } });
      setActiveTool('mask');
    } else {
      updateCurrentTransform({ mask: { ...mask, enabled: !mask.enabled } });
      if (!mask.enabled) {
        setActiveTool('mask');
      } else if (activeTool === 'mask') {
        setActiveTool('select');
      }
    }
  };

  return (
    <div className="property-group">
      <div className="property-header">
        <h4>Mask Properties</h4>
      </div>

      <div className="property-row">
        <label className="property-label">Enable Mask</label>
        <div className="property-control">
          <label className="checkbox-container">
            <input
              type="checkbox"
              checked={mask.enabled}
              onChange={handleToggleMask}
            />
            <span className="checkmark"></span>
            {mask.enabled ? 'Enabled' : 'Disabled'}
          </label>
        </div>
      </div>

      {mask.enabled && (
        <>
          <div className="property-row">
            <label className="property-label">Edit Mode</label>
            <div className="property-control">
              <button
                className={`btn-secondary ${activeTool === 'mask' ? 'active' : ''}`}
                onClick={() => setActiveTool(activeTool === 'mask' ? 'select' : 'mask')}
                style={{ width: '100%', display: 'flex', gap: '8px', justifyContent: 'center' }}
              >
                <Scissors size={14} />
                {activeTool === 'mask' ? 'Exit Edit Mode' : 'Edit Mask Points'}
              </button>
            </div>
          </div>

          <div className="property-row">
            <label className="property-label">Inverted</label>
            <div className="property-control">
              <label className="checkbox-container">
                <input
                  type="checkbox"
                  checked={mask.inverted}
                  onChange={(e) => updateCurrentTransform({ mask: { ...mask, inverted: e.target.checked } })}
                />
                <span className="checkmark"></span>
                Invert Mask
              </label>
            </div>
          </div>

          <div className="property-row">
            <label className="property-label">Feather (px)</label>
            <div className="property-control">
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                className="input-control"
                value={mask.feather}
                onChange={(e) => updateCurrentTransform({ mask: { ...mask, feather: parseFloat(e.target.value) || 0 } })}
              />
            </div>
          </div>

          <div className="property-row">
            <label className="property-label">Opacity</label>
            <div className="property-control flex-row">
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={mask.opacity}
                onChange={(e) => updateCurrentTransform({ mask: { ...mask, opacity: parseFloat(e.target.value) || 0 } })}
                style={{ flex: 1 }}
              />
              <span className="value-display" style={{ width: 40, textAlign: 'right' }}>
                {Math.round(mask.opacity * 100)}%
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
