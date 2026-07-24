import React, { useState } from 'react';
import { Zap, Play, Square, Clock, Sparkles, MoveRight, MoveLeft, MoveUp, MoveDown, Minimize2, RotateCw, Film, EyeOff, Trash2, BookmarkPlus } from 'lucide-react';
import type { CharacterPart } from '../../../types/animator';
import { useAnimator } from '../../../context/AnimatorContext';

const IN_PRESETS = [
  { id: 'none', label: 'None', icon: EyeOff, desc: 'Instant cut' },
  { id: 'fade', label: 'Fade In', icon: Sparkles, desc: 'Smooth opacity fade' },
  { id: 'slide-left', label: 'Slide In R', icon: MoveRight, desc: 'Slide from right' },
  { id: 'slide-right', label: 'Slide In L', icon: MoveLeft, desc: 'Slide from left' },
  { id: 'slide-up', label: 'Slide In Up', icon: MoveUp, desc: 'Slide from bottom' },
  { id: 'slide-down', label: 'Slide In Dn', icon: MoveDown, desc: 'Slide from top' },
  { id: 'pop', label: 'Pop Zoom', icon: Minimize2, desc: 'Scale pop entrance' },
  { id: 'spin', label: 'Spin Entrance', icon: RotateCw, desc: 'Rotate + zoom' },
  { id: 'custom_timeline', label: 'Custom Timeline', icon: Film, desc: 'Use keyframe frames' },
];

const OUT_PRESETS = [
  { id: 'none', label: 'None', icon: EyeOff, desc: 'Instant cut' },
  { id: 'fade', label: 'Fade Out', icon: Sparkles, desc: 'Smooth opacity fade' },
  { id: 'slide-left', label: 'Slide Out L', icon: MoveLeft, desc: 'Slide to left' },
  { id: 'slide-right', label: 'Slide Out R', icon: MoveRight, desc: 'Slide to right' },
  { id: 'slide-up', label: 'Slide Out Up', icon: MoveUp, desc: 'Slide to top' },
  { id: 'slide-down', label: 'Slide Out Dn', icon: MoveDown, desc: 'Slide to bottom' },
  { id: 'pop', label: 'Pop Exit', icon: Minimize2, desc: 'Scale shrink exit' },
  { id: 'spin', label: 'Spin Exit', icon: RotateCw, desc: 'Rotate + shrink' },
  { id: 'custom_timeline', label: 'Custom Timeline', icon: Film, desc: 'Use keyframe frames' },
];

const DURATION_PRESETS = [15, 30, 45, 60];

interface MotionTabProps {
  selectedPart: CharacterPart;
  handlePartPropChange: (key: keyof CharacterPart, value: any) => void;
}

export const MotionTab: React.FC<MotionTabProps> = ({ selectedPart, handlePartPropChange }) => {
  const {
    currentFrame,
    fps,
    customPresets,
    saveTrackAsPreset,
    deleteCustomPreset,
    tracks,
  } = useAnimator();

  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetType, setNewPresetType] = useState<'in' | 'out' | 'stunt'>('in');
  const [presetStartF, setPresetStartF] = useState<number>(0);
  const [presetEndF, setPresetEndF] = useState<number>(50);
  const [showSaveCard, setShowSaveCard] = useState(false);

  const activeIn = selectedPart.inAnimPreset || 'none';
  const activeOut = selectedPart.outAnimPreset || 'none';

  const inCustomPresets = customPresets.filter(p => p.type === 'in');
  const outCustomPresets = customPresets.filter(p => p.type === 'out');

  const selectedTrack = tracks.find(t => t.partId === selectedPart.id);
  const hasKeyframes = selectedTrack && selectedTrack.keyframes.length > 0;

  const handleSavePresetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetName.trim()) return;
    saveTrackAsPreset(selectedPart.id, newPresetName.trim(), newPresetType, presetStartF, presetEndF);
    setNewPresetName('');
    setShowSaveCard(false);
  };

  return (
    <div className="inspector-section" style={{ gap: 16 }}>
      {/* Header Banner */}
      <div 
        style={{ 
          background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.12), rgba(16, 185, 129, 0.12))', 
          border: '1px solid rgba(6, 182, 212, 0.25)', 
          borderRadius: 8, 
          padding: '12px 14px' 
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Zap size={14} /> MOTION & BROADCAST ENGINE
          </span>
          <span className="badge-tag" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', fontSize: 9 }}>
            LIVE
          </span>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
          Preset or custom keyframe transitions for Broadcast Mode and layer visibility ranges.
        </p>
      </div>

      {/* ── DYNAMIC GEOMETRIC MASK SHAPE & MODE TOGGLES ── */}
      <div 
        className="form-group" 
        style={{ 
          background: 'var(--bg-dark)', 
          border: '1px solid rgba(147, 51, 234, 0.3)', 
          borderRadius: 8, 
          padding: 14 
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#c084fc', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={14} /> GEOMETRIC MASK SHAPE FRAME
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            {(selectedPart.maskShape || 'none').toUpperCase()}
          </span>
        </div>

        {/* Visual Shape Selectors */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 12 }}>
          {[
            { id: 'none', label: 'Default Box', desc: 'Standard rectangle frame' },
            { id: 'circle', label: 'Circle (Daire)', desc: 'Clip inside circle' },
            { id: 'pill', label: 'Pill / Capsule', desc: 'Rounded pill shape' },
            { id: 'star', label: 'Star (Yıldız)', desc: '5-point star frame' },
            { id: 'hexagon', label: 'Hexagon', desc: '6-side polygon' },
            { id: 'heart', label: 'Heart (Kalp)', desc: 'Heart shape frame' },
          ].map((shape) => {
            const isSelected = (selectedPart.maskShape || 'none') === shape.id;
            return (
              <button
                key={shape.id}
                type="button"
                onClick={() => handlePartPropChange('maskShape', shape.id)}
                title={shape.desc}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '6px 4px',
                  background: isSelected ? 'rgba(147, 51, 234, 0.25)' : 'var(--bg-input)',
                  border: `1px solid ${isSelected ? '#c084fc' : 'var(--border-color)'}`,
                  borderRadius: 6,
                  color: isSelected ? '#c084fc' : '#fff',
                  fontSize: 10,
                  fontWeight: isSelected ? 700 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {shape.label}
              </button>
            );
          })}
        </div>

        {/* Independent Mode Toggles */}
        <div style={{ background: 'rgba(0,0,0,0.3)', padding: 10, borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 11, color: '#fff' }}>
            <input
              type="checkbox"
              checked={selectedPart.enableMaskShape !== false}
              onChange={(e) => handlePartPropChange('enableMaskShape', e.target.checked)}
              style={{ cursor: 'pointer', accentColor: '#c084fc' }}
            />
            <span>Apply Geometric Mask Shape</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 11, color: '#fff' }}>
            <input
              type="checkbox"
              checked={selectedPart.enableMotionAnim !== false}
              onChange={(e) => handlePartPropChange('enableMotionAnim', e.target.checked)}
              style={{ cursor: 'pointer', accentColor: '#10b981' }}
            />
            <span>Apply Entrance & Exit Motion Animations</span>
          </label>
        </div>
      </div>

      {/* ── SAVE KEYFRAMES AS REUSABLE PRESET CARD ── */}
      <div
        style={{
          background: 'var(--bg-dark)',
          border: '1px dashed var(--accent-gold)',
          borderRadius: 8,
          padding: 12,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <BookmarkPlus size={14} /> SAVE LAYER KEYFRAMES AS PRESET
          </span>
          <button
            type="button"
            className="btn-secondary"
            style={{ fontSize: 10, padding: '3px 8px', color: 'var(--accent-gold)' }}
            onClick={() => setShowSaveCard(!showSaveCard)}
          >
            {showSaveCard ? 'Cancel' : '+ Create Preset'}
          </button>
        </div>

        {showSaveCard && (
          <form onSubmit={handleSavePresetSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            <div className="input-field">
              <label style={{ fontSize: 10 }}>PRESET NAME</label>
              <input
                type="text"
                placeholder="e.g. Pink Slide In Top"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                style={{ width: '100%', padding: '5px 8px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: 4, fontSize: 11 }}
              />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <div className="input-field" style={{ flex: 1 }}>
                <label style={{ fontSize: 10 }}>TYPE</label>
                <select
                  value={newPresetType}
                  onChange={(e) => setNewPresetType(e.target.value as 'in' | 'out' | 'stunt')}
                  style={{ width: '100%', height: 26, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: 4, fontSize: 11 }}
                >
                  <option value="in">Entrance (IN)</option>
                  <option value="out">Exit (OUT)</option>
                  <option value="stunt">Live Stunt / Loop (Atraksiyon)</option>
                </select>
              </div>

              <div className="input-field" style={{ flex: 1 }}>
                <label style={{ fontSize: 10 }}>START FRAME</label>
                <input
                  type="number" min="0" max="1200"
                  value={presetStartF}
                  onChange={(e) => setPresetStartF(parseInt(e.target.value) || 0)}
                  style={{ width: '100%', padding: '4px 6px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: 4, fontSize: 11 }}
                />
              </div>

              <div className="input-field" style={{ flex: 1 }}>
                <label style={{ fontSize: 10 }}>END FRAME</label>
                <input
                  type="number" min="0" max="1200"
                  value={presetEndF}
                  onChange={(e) => setPresetEndF(parseInt(e.target.value) || 0)}
                  style={{ width: '100%', padding: '4px 6px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: 4, fontSize: 11 }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={!hasKeyframes || !newPresetName.trim()}
              style={{
                marginTop: 4,
                padding: '6px',
                background: 'var(--accent-gold)',
                color: '#000',
                fontWeight: 700,
                fontSize: 11,
                border: 'none',
                borderRadius: 4,
                cursor: hasKeyframes && newPresetName.trim() ? 'pointer' : 'not-allowed',
                opacity: hasKeyframes && newPresetName.trim() ? 1 : 0.5,
              }}
            >
              SAVE AS REUSABLE PRESET
            </button>
            {!hasKeyframes && (
              <span style={{ fontSize: 10, color: 'var(--accent-red)', textAlign: 'center' }}>
                Add keyframes to "{selectedPart.name}" first to save a preset.
              </span>
            )}
          </form>
        )}
      </div>

      {/* ── SECTION 1: IN ANIMATION (ENTRANCE) ── */}
      <div 
        className="form-group" 
        style={{ 
          background: 'var(--bg-dark)', 
          border: '1px solid rgba(16, 185, 129, 0.25)', 
          borderRadius: 8, 
          padding: 14 
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div className="section-title" style={{ margin: 0, padding: 0 }}>
            <Play size={13} className="text-green" />
            <span style={{ color: '#10b981', fontWeight: 700 }}>IN ANIMATION (ENTRANCE)</span>
          </div>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            {activeIn.toUpperCase()}
          </span>
        </div>

        {/* Visual Grid Selector */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 12 }}>
          {IN_PRESETS.map((preset) => {
            const IconComp = preset.icon;
            const isSelected = activeIn === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handlePartPropChange('inAnimPreset', preset.id)}
                title={preset.desc}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  padding: '8px 4px',
                  background: isSelected ? 'rgba(16, 185, 129, 0.2)' : 'var(--bg-input)',
                  border: `1px solid ${isSelected ? '#10b981' : 'var(--border-color)'}`,
                  borderRadius: 6,
                  color: isSelected ? '#10b981' : '#fff',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <IconComp size={14} />
                <span style={{ fontSize: 10, fontWeight: isSelected ? 700 : 400, textAlign: 'center', lineHeight: 1.1 }}>
                  {preset.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Custom Presets Grid (if any) */}
        {inCustomPresets.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <span style={{ fontSize: 10, color: 'var(--accent-gold)', fontWeight: 700, display: 'block', marginBottom: 6 }}>
              CUSTOM SAVED IN PRESETS:
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {inCustomPresets.map((cp) => {
                const isSelected = activeIn === cp.id;
                return (
                  <div
                    key={cp.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 8px',
                      background: isSelected ? 'rgba(16, 185, 129, 0.2)' : 'var(--bg-input)',
                      border: `1px solid ${isSelected ? '#10b981' : 'var(--border-color)'}`,
                      borderRadius: 4,
                      cursor: 'pointer',
                    }}
                    onClick={() => handlePartPropChange('inAnimPreset', cp.id)}
                  >
                    <span style={{ fontSize: 10, color: isSelected ? '#10b981' : '#fff', fontWeight: isSelected ? 700 : 400 }}>
                      ✨ {cp.name} ({cp.durationFrames}f)
                    </span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); deleteCustomPreset(cp.id); }}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}
                      title="Delete Preset"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Duration Slider & Quick Pills for Presets */}
        {activeIn !== 'none' && activeIn !== 'custom_timeline' && (
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: 10, borderRadius: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontSize: 10, color: 'var(--text-muted)' }}>DURATION (FRAMES & SECONDS)</label>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#10b981' }}>
                {selectedPart.inAnimDuration || 30}f ({((selectedPart.inAnimDuration || 30) / fps).toFixed(2)}s)
              </span>
            </div>
            <input 
              type="range" min="5" max="120" step="5"
              value={selectedPart.inAnimDuration || 30}
              onChange={(e) => handlePartPropChange('inAnimDuration', parseInt(e.target.value))}
              style={{ width: '100%', cursor: 'pointer', accentColor: '#10b981', marginBottom: 8 }}
            />
            {/* Quick Pills */}
            <div style={{ display: 'flex', gap: 6 }}>
              {DURATION_PRESETS.map((f) => (
                <button
                  key={`in-dur-${f}`}
                  type="button"
                  onClick={() => handlePartPropChange('inAnimDuration', f)}
                  style={{
                    flex: 1,
                    fontSize: 9,
                    padding: '3px 0',
                    background: (selectedPart.inAnimDuration || 30) === f ? '#10b981' : 'var(--bg-dark)',
                    color: (selectedPart.inAnimDuration || 30) === f ? '#000' : 'var(--text-muted)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 4,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {f}f ({(f / fps).toFixed(1)}s)
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Custom Timeline Range */}
        {activeIn === 'custom_timeline' && (
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: 10, borderRadius: 6, display: 'flex', gap: 10 }}>
            <div className="input-field" style={{ flex: 1 }}>
              <label style={{ fontSize: 10 }}>TIMELINE START FRAME</label>
              <input
                type="number" min="0" max="1200"
                value={selectedPart.inAnimTimelineStart ?? 0}
                onChange={(e) => handlePartPropChange('inAnimTimelineStart', parseInt(e.target.value) || 0)}
                style={{ width: '100%', padding: '4px 6px', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: 4 }}
              />
            </div>
            <div className="input-field" style={{ flex: 1 }}>
              <label style={{ fontSize: 10 }}>TIMELINE END FRAME</label>
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

      {/* ── SECTION 2: OUT ANIMATION (EXIT) ── */}
      <div 
        className="form-group" 
        style={{ 
          background: 'var(--bg-dark)', 
          border: '1px solid rgba(239, 68, 68, 0.25)', 
          borderRadius: 8, 
          padding: 14 
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div className="section-title" style={{ margin: 0, padding: 0 }}>
            <Square size={13} className="text-red" />
            <span style={{ color: '#ef4444', fontWeight: 700 }}>OUT ANIMATION (EXIT)</span>
          </div>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            {activeOut.toUpperCase()}
          </span>
        </div>

        {/* Visual Grid Selector */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 12 }}>
          {OUT_PRESETS.map((preset) => {
            const IconComp = preset.icon;
            const isSelected = activeOut === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handlePartPropChange('outAnimPreset', preset.id)}
                title={preset.desc}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  padding: '8px 4px',
                  background: isSelected ? 'rgba(239, 68, 68, 0.2)' : 'var(--bg-input)',
                  border: `1px solid ${isSelected ? '#ef4444' : 'var(--border-color)'}`,
                  borderRadius: 6,
                  color: isSelected ? '#ef4444' : '#fff',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <IconComp size={14} />
                <span style={{ fontSize: 10, fontWeight: isSelected ? 700 : 400, textAlign: 'center', lineHeight: 1.1 }}>
                  {preset.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Custom Presets Grid (if any) */}
        {outCustomPresets.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <span style={{ fontSize: 10, color: 'var(--accent-gold)', fontWeight: 700, display: 'block', marginBottom: 6 }}>
              CUSTOM SAVED OUT PRESETS:
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {outCustomPresets.map((cp) => {
                const isSelected = activeOut === cp.id;
                return (
                  <div
                    key={cp.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 8px',
                      background: isSelected ? 'rgba(239, 68, 68, 0.2)' : 'var(--bg-input)',
                      border: `1px solid ${isSelected ? '#ef4444' : 'var(--border-color)'}`,
                      borderRadius: 4,
                      cursor: 'pointer',
                    }}
                    onClick={() => handlePartPropChange('outAnimPreset', cp.id)}
                  >
                    <span style={{ fontSize: 10, color: isSelected ? '#ef4444' : '#fff', fontWeight: isSelected ? 700 : 400 }}>
                      ✨ {cp.name} ({cp.durationFrames}f)
                    </span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); deleteCustomPreset(cp.id); }}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}
                      title="Delete Preset"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Duration Slider & Quick Pills for Presets */}
        {activeOut !== 'none' && activeOut !== 'custom_timeline' && (
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: 10, borderRadius: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontSize: 10, color: 'var(--text-muted)' }}>DURATION (FRAMES & SECONDS)</label>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#ef4444' }}>
                {selectedPart.outAnimDuration || 30}f ({((selectedPart.outAnimDuration || 30) / fps).toFixed(2)}s)
              </span>
            </div>
            <input 
              type="range" min="5" max="120" step="5"
              value={selectedPart.outAnimDuration || 30}
              onChange={(e) => handlePartPropChange('outAnimDuration', parseInt(e.target.value))}
              style={{ width: '100%', cursor: 'pointer', accentColor: '#ef4444', marginBottom: 8 }}
            />
            {/* Quick Pills */}
            <div style={{ display: 'flex', gap: 6 }}>
              {DURATION_PRESETS.map((f) => (
                <button
                  key={`out-dur-${f}`}
                  type="button"
                  onClick={() => handlePartPropChange('outAnimDuration', f)}
                  style={{
                    flex: 1,
                    fontSize: 9,
                    padding: '3px 0',
                    background: (selectedPart.outAnimDuration || 30) === f ? '#ef4444' : 'var(--bg-dark)',
                    color: (selectedPart.outAnimDuration || 30) === f ? '#fff' : 'var(--text-muted)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 4,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {f}f ({(f / fps).toFixed(1)}s)
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Custom Timeline Range */}
        {activeOut === 'custom_timeline' && (
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: 10, borderRadius: 6, display: 'flex', gap: 10 }}>
            <div className="input-field" style={{ flex: 1 }}>
              <label style={{ fontSize: 10 }}>TIMELINE START FRAME</label>
              <input
                type="number" min="0" max="1200"
                value={selectedPart.outAnimTimelineStart ?? 0}
                onChange={(e) => handlePartPropChange('outAnimTimelineStart', parseInt(e.target.value) || 0)}
                style={{ width: '100%', padding: '4px 6px', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: 4 }}
              />
            </div>
            <div className="input-field" style={{ flex: 1 }}>
              <label style={{ fontSize: 10 }}>TIMELINE END FRAME</label>
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

      {/* ── SECTION 3: LAYER APPEARANCE TIMING ── */}
      <div 
        className="form-group" 
        style={{ 
          background: 'var(--bg-dark)', 
          border: '1px solid rgba(6, 182, 212, 0.25)', 
          borderRadius: 8, 
          padding: 14 
        }}
      >
        <div className="section-title" style={{ paddingBottom: 6 }}>
          <Clock size={13} className="text-cyan" />
          <span style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>APPEARANCE TIMING (IN / OUT FRAMES)</span>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
          Set exact start/end frames or seconds for when this layer appears on screen.
        </p>

        <div style={{ display: 'flex', gap: 10 }}>
          <div className="input-field" style={{ flex: 1 }}>
            <label style={{ fontSize: 10, color: '#10b981' }}>APPEAR AT (FRAME)</label>
            <input
              type="number" min="0" max="1200"
              placeholder="0 (Start)"
              value={selectedPart.visibleStartFrame ?? ''}
              onChange={(e) => {
                const val = e.target.value === '' ? undefined : parseInt(e.target.value);
                handlePartPropChange('visibleStartFrame', val);
              }}
              style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: 6, fontSize: 12, fontFamily: 'monospace' }}
            />
          </div>
          <div className="input-field" style={{ flex: 1 }}>
            <label style={{ fontSize: 10, color: '#ef4444' }}>DISAPPEAR AT (FRAME)</label>
            <input
              type="number" min="0" max="1200"
              placeholder="Always visible"
              value={selectedPart.visibleEndFrame ?? ''}
              onChange={(e) => {
                const val = e.target.value === '' ? undefined : parseInt(e.target.value);
                handlePartPropChange('visibleEndFrame', val);
              }}
              style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: 6, fontSize: 12, fontFamily: 'monospace' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
          <button
            className="btn-secondary"
            style={{ flex: 1, fontSize: 10, padding: '6px 10px', color: 'var(--accent-cyan)', background: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.3)', borderRadius: 6 }}
            onClick={() => handlePartPropChange('visibleStartFrame', currentFrame)}
          >
            Start at Frame {currentFrame} ({(currentFrame / fps).toFixed(1)}s)
          </button>
          {(selectedPart.visibleStartFrame !== undefined || selectedPart.visibleEndFrame !== undefined) && (
            <button
              className="btn-secondary"
              style={{ fontSize: 10, padding: '6px 10px', color: 'var(--text-muted)', borderRadius: 6 }}
              onClick={() => {
                handlePartPropChange('visibleStartFrame', undefined);
                handlePartPropChange('visibleEndFrame', undefined);
              }}
            >
              Clear Timing
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
