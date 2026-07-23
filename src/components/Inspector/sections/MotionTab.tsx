import React from 'react';
import { Zap, Play, Square } from 'lucide-react';
import type { CharacterPart } from '../../../types/animator';

const IN_ANIMATIONS = [
  { id: 'none', label: 'None' },
  { id: 'fade', label: 'Fade In' },
  { id: 'slide-left', label: 'Slide Right' },
  { id: 'slide-right', label: 'Slide Left' },
  { id: 'slide-up', label: 'Slide Up' },
  { id: 'slide-down', label: 'Slide Down' },
  { id: 'pop', label: 'Pop Zoom' },
  { id: 'spin', label: 'Spin' },
  { id: 'custom_timeline', label: 'Custom Timeline' },
];

const OUT_ANIMATIONS = [
  { id: 'none', label: 'None' },
  { id: 'fade', label: 'Fade Out' },
  { id: 'slide-left', label: 'Slide Left' },
  { id: 'slide-right', label: 'Slide Right' },
  { id: 'slide-up', label: 'Slide Up' },
  { id: 'slide-down', label: 'Slide Down' },
  { id: 'pop', label: 'Pop Zoom' },
  { id: 'spin', label: 'Spin' },
  { id: 'custom_timeline', label: 'Custom Timeline' },
];

interface MotionTabProps {
  selectedPart: CharacterPart;
  handlePartPropChange: (key: keyof CharacterPart, value: any) => void;
}

export const MotionTab: React.FC<MotionTabProps> = ({ selectedPart, handlePartPropChange }) => {
  return (
    <div className="inspector-section">
      <div className="section-title">
        <Zap size={13} className="text-cyan" />
        <span>BROADCAST IN / OUT ANIMATIONS</span>
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 15 }}>
        Set automatic entrance and exit animations without manual keyframes.
      </p>

      {/* IN ANIMATION */}
      <div className="form-group" style={{ marginBottom: 20 }}>
        <div className="section-title" style={{ paddingBottom: 6 }}>
          <Play size={12} className="text-green" />
          <span>IN ANIMATION (ENTRANCE)</span>
        </div>
        
        <div className="input-field">
          <label>PRESET</label>
          <select
            value={selectedPart.inAnimPreset || 'none'}
            onChange={(e) => handlePartPropChange('inAnimPreset', e.target.value)}
            style={{ width: '100%', height: 28, background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 4, color: '#fff', fontSize: 11 }}
          >
            {IN_ANIMATIONS.map(anim => <option key={anim.id} value={anim.id}>{anim.label}</option>)}
          </select>
        </div>

        {selectedPart.inAnimPreset && selectedPart.inAnimPreset !== 'none' && selectedPart.inAnimPreset !== 'custom_timeline' && (
          <div className="input-field" style={{ marginTop: 10 }}>
            <label style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>DURATION (FRAMES)</span>
              <span className="text-cyan">{selectedPart.inAnimDuration || 30}f</span>
            </label>
            <input 
              type="range" min="1" max="120" 
              value={selectedPart.inAnimDuration || 30}
              onChange={(e) => handlePartPropChange('inAnimDuration', parseInt(e.target.value))}
              style={{ width: '100%', cursor: 'pointer' }}
            />
          </div>
        )}

        {selectedPart.inAnimPreset === 'custom_timeline' && (
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <div className="input-field" style={{ flex: 1 }}>
              <label>START FRAME</label>
              <input
                type="number" min="0" max="1200"
                value={selectedPart.inAnimTimelineStart ?? 0}
                onChange={(e) => handlePartPropChange('inAnimTimelineStart', parseInt(e.target.value) || 0)}
                style={{ width: '100%', padding: '4px 6px', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: 4 }}
              />
            </div>
            <div className="input-field" style={{ flex: 1 }}>
              <label>END FRAME</label>
              <input
                type="number" min="0" max="1200"
                value={selectedPart.inAnimTimelineEnd ?? 30}
                onChange={(e) => handlePartPropChange('inAnimTimelineEnd', parseInt(e.target.value) || 0)}
                style={{ width: '100%', padding: '4px 6px', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: 4 }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="divider-h" style={{ margin: '15px 0' }} />

      {/* OUT ANIMATION */}
      <div className="form-group">
        <div className="section-title" style={{ paddingBottom: 6 }}>
          <Square size={12} className="text-red" />
          <span>OUT ANIMATION (EXIT)</span>
        </div>
        
        <div className="input-field">
          <label>PRESET</label>
          <select
            value={selectedPart.outAnimPreset || 'none'}
            onChange={(e) => handlePartPropChange('outAnimPreset', e.target.value)}
            style={{ width: '100%', height: 28, background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 4, color: '#fff', fontSize: 11 }}
          >
            {OUT_ANIMATIONS.map(anim => <option key={anim.id} value={anim.id}>{anim.label}</option>)}
          </select>
        </div>

        {selectedPart.outAnimPreset && selectedPart.outAnimPreset !== 'none' && selectedPart.outAnimPreset !== 'custom_timeline' && (
          <div className="input-field" style={{ marginTop: 10 }}>
            <label style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>DURATION (FRAMES)</span>
              <span className="text-cyan">{selectedPart.outAnimDuration || 30}f</span>
            </label>
            <input 
              type="range" min="1" max="120" 
              value={selectedPart.outAnimDuration || 30}
              onChange={(e) => handlePartPropChange('outAnimDuration', parseInt(e.target.value))}
              style={{ width: '100%', cursor: 'pointer' }}
            />
          </div>
        )}

        {selectedPart.outAnimPreset === 'custom_timeline' && (
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <div className="input-field" style={{ flex: 1 }}>
              <label>START FRAME</label>
              <input
                type="number" min="0" max="1200"
                value={selectedPart.outAnimTimelineStart ?? 0}
                onChange={(e) => handlePartPropChange('outAnimTimelineStart', parseInt(e.target.value) || 0)}
                style={{ width: '100%', padding: '4px 6px', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: 4 }}
              />
            </div>
            <div className="input-field" style={{ flex: 1 }}>
              <label>END FRAME</label>
              <input
                type="number" min="0" max="1200"
                value={selectedPart.outAnimTimelineEnd ?? 30}
                onChange={(e) => handlePartPropChange('outAnimTimelineEnd', parseInt(e.target.value) || 0)}
                style={{ width: '100%', padding: '4px 6px', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: 4 }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
