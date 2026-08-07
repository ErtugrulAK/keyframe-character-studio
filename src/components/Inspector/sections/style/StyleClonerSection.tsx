import React from 'react';
import { Grid3x3 } from 'lucide-react';
import type { CharacterPart } from '../../../../types/animator';
import { SmartNumberInput } from '../../inputs/SmartNumberInput';
import { StyleCard } from './StyleCard';

interface StyleClonerSectionProps {
  selectedPart: CharacterPart;
  onPartPropChange: (key: keyof CharacterPart, value: any) => void;
}

export const StyleClonerSection: React.FC<StyleClonerSectionProps> = ({ selectedPart, onPartPropChange }) => {
  const cfg = selectedPart.clonerConfig;
  if (!cfg) return null;

  const updateCfg = (patch: Partial<typeof cfg>) => {
    onPartPropChange('clonerConfig', { ...cfg, ...patch });
  };

  return (
    <StyleCard title="CLONER" icon={<Grid3x3 size={13} />} color="#a855f7">
      <div className="form-field-group">
        <label className="form-label">CLONER LAYOUT MODE</label>
        <select className="select-control"
          value={cfg.mode}
          onChange={(e) => updateCfg({ mode: e.target.value as any })}
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
          <option value="grid">2D Grid Layout</option>
          <option value="circle">Circular Radial Layout</option>
          <option value="linear">Linear Strip Layout</option>
        </select>
      </div>

      {cfg.mode === 'grid' && (
        <div className="input-grid">
          <div className="form-field-group">
            <label className="form-label">COUNT X</label>
            <SmartNumberInput
              value={cfg.countX}
              min={1}
              max={10}
              onChange={(val) => updateCfg({ countX: val })}
            />
          </div>
          <div className="form-field-group">
            <label className="form-label">COUNT Y</label>
            <SmartNumberInput
              value={cfg.countY}
              min={1}
              max={10}
              onChange={(val) => updateCfg({ countY: val })}
            />
          </div>
        </div>
      )}

      {cfg.mode === 'circle' && (
        <div className="input-grid">
          <div className="form-field-group">
            <label className="form-label">CIRCLE COUNT</label>
            <SmartNumberInput
              value={cfg.countCircle}
              min={3}
              max={24}
              onChange={(val) => updateCfg({ countCircle: val })}
            />
          </div>
          <div className="form-field-group">
            <label className="form-label">RADIUS (PX)</label>
            <SmartNumberInput
              value={cfg.radius}
              min={10}
              max={200}
              onChange={(val) => updateCfg({ radius: val })}
            />
          </div>
        </div>
      )}

      <div className="form-field-group">
        <label className="form-label">EFFECTOR TYPE</label>
        <select className="select-control"
          value={cfg.effector}
          onChange={(e) => updateCfg({ effector: e.target.value as any })}
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
          <option value="none">None (Static Grid)</option>
          <option value="wave">Sinusoidal Wave Motion</option>
          <option value="random">Random Noise Motion</option>
        </select>
      </div>

      {cfg.effector === 'wave' && (
        <div className="input-grid">
          <div className="form-field-group">
            <label className="form-label">WAVE SPEED</label>
            <SmartNumberInput
              value={cfg.waveSpeed}
              min={0.2}
              max={5}
              step={0.2}
              onChange={(val) => updateCfg({ waveSpeed: val })}
            />
          </div>
          <div className="form-field-group">
            <label className="form-label">AMPLITUDE</label>
            <SmartNumberInput
              value={cfg.waveAmplitude}
              min={2}
              max={50}
              onChange={(val) => updateCfg({ waveAmplitude: val })}
            />
          </div>
        </div>
      )}
    </StyleCard>
  );
};
