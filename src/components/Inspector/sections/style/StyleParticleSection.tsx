import React from 'react';
import type { CharacterPart } from '../../../../types/animator';
import { SmartNumberInput } from '../../inputs/SmartNumberInput';
import { StyleCard } from './StyleCard';

interface StyleParticleSectionProps {
  selectedPart: CharacterPart;
  onPartPropChange: (key: keyof CharacterPart, value: any) => void;
}

export const StyleParticleSection: React.FC<StyleParticleSectionProps> = ({ selectedPart, onPartPropChange }) => {
  const cfg = selectedPart.particleConfig;
  if (!cfg) return null;

  const updateCfg = (patch: Partial<typeof cfg>) => {
    onPartPropChange('particleConfig', { ...cfg, ...patch });
  };

  return (
    <StyleCard title="PARTICLES" collapsible defaultOpen={false}>
      <div className="input-grid">
        <div className="form-field-group">
          <label className="form-label">PARTICLE COUNT</label>
          <SmartNumberInput
            value={cfg.count}
            min={5}
            max={150}
            onChange={(val) => updateCfg({ count: val })}
          />
        </div>
        <div className="form-field-group">
          <label className="form-label">SPEED (PX/S)</label>
          <SmartNumberInput
            value={cfg.speed}
            min={5}
            max={120}
            onChange={(val) => updateCfg({ speed: val })}
          />
        </div>
      </div>

      <div className="form-field-group">
        <label className="form-label">PARTICLE SHAPE</label>
        <select className="select-control"
          value={cfg.shape}
          onChange={(e) => updateCfg({ shape: e.target.value as any })}
          style={{
            width: '100%',
            height: 28,
            background: 'var(--bg-input)',
            border: '1px solid var(--border-color)',
            borderRadius: 4,
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            padding: '0 6px',
          }}
        >
          <option value="dot">Solid Dot</option>
          <option value="cross">Cross (+)</option>
          <option value="triangle">Triangle (▲)</option>
          <option value="circle_outline">Circle Ring (○)</option>
        </select>
      </div>
    </StyleCard>
  );
};
