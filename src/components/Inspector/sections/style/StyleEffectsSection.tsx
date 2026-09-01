import React from 'react';
import type { CharacterPart } from '../../../../types/animator';
import { SmartHexInput } from '../../inputs/SmartHexInput';
import { SmartNumberInput } from '../../inputs/SmartNumberInput';
import { StyleCard } from './StyleCard';

interface StyleEffectsSectionProps {
  selectedPart: CharacterPart;
  onPartPropChange: (key: keyof CharacterPart, value: any) => void;
}

export const StyleEffectsSection: React.FC<StyleEffectsSectionProps> = ({ selectedPart, onPartPropChange }) => {
  return (
    <StyleCard title="EFFECTS" collapsible defaultOpen={false}>
      {/* DROP SHADOW / GLOW CONTROLS */}
      <div className="form-field-group" style={{ marginBottom: 8 }}>
        <label className="form-label">SHADOW / GLOW COLOR</label>
        <div className="color-picker-compact">
          <input
            type="color"
            className="color-swatch-input"
            value={selectedPart.shadowColor || '#000000'}
            onChange={(e) => onPartPropChange('shadowColor', e.target.value)}
          />
          <SmartHexInput
            value={selectedPart.shadowColor || ''}
            fallback="#000000"
            placeholder="NONE"
            onChange={(val) => onPartPropChange('shadowColor', val)}
          />
          <button
            type="button"
            className="btn-secondary"
            style={{ padding: '2px 8px', fontSize: 10, height: 32, whiteSpace: 'nowrap' }}
            onClick={() => onPartPropChange('shadowColor', undefined)}
          >
            Clear Shadow
          </button>
        </div>
      </div>

      {selectedPart.shadowColor && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, background: 'var(--bg-panel)', border: '1px solid var(--border-color)', padding: '6px 8px', borderRadius: 'var(--radius-sm)' }}>
            <span className="param-label" style={{ fontSize: 9 }}>BLUR RADIUS</span>
            <SmartNumberInput
              value={selectedPart.shadowBlur ?? 8}
              min={0}
              max={50}
              onChange={(val) => onPartPropChange('shadowBlur', val)}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, background: 'var(--bg-panel)', border: '1px solid var(--border-color)', padding: '6px 8px', borderRadius: 'var(--radius-sm)' }}>
            <span className="param-label" style={{ fontSize: 9 }}>OFFSET X</span>
            <SmartNumberInput
              value={selectedPart.shadowOffsetX ?? 0}
              min={-50}
              max={50}
              onChange={(val) => onPartPropChange('shadowOffsetX', val)}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, background: 'var(--bg-panel)', border: '1px solid var(--border-color)', padding: '6px 8px', borderRadius: 'var(--radius-sm)' }}>
            <span className="param-label" style={{ fontSize: 9 }}>OFFSET Y</span>
            <SmartNumberInput
              value={selectedPart.shadowOffsetY ?? 4}
              min={-50}
              max={50}
              onChange={(val) => onPartPropChange('shadowOffsetY', val)}
            />
          </div>
        </div>
      )}
    </StyleCard>
  );
};
