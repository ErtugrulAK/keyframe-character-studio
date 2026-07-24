import React from 'react';
import { useAnimator } from '../../../context/AnimatorContext';
import { Sparkles, Trash2, Play, Edit3, Move, Maximize2, Tag } from 'lucide-react';
import { PRESET_POSES } from '../../../utils/defaults';
import type { CustomMotionPreset } from '../../../types/animator';

interface PresetsTabProps {
  applyPresetPose: (poseId: string) => void;
}

export const PresetsTab: React.FC<PresetsTabProps> = ({ applyPresetPose }) => {
  const {
    customPresets,
    updateCustomPreset,
    deleteCustomPreset,
    triggerLiveStunt,
    selectedPartId,
    characterParts,
    showToast,
  } = useAnimator();

  const selectedPart = characterParts.find(p => p.id === selectedPartId);

  const handleScopeToggle = (preset: CustomMotionPreset, target: 'motion' | 'shape', checked: boolean) => {
    let currentScope = preset.scope || 'both';
    let hasMotion = currentScope === 'both' || currentScope === 'motion_only';
    let hasShape = currentScope === 'both' || currentScope === 'shape_only';

    if (target === 'motion') hasMotion = checked;
    if (target === 'shape') hasShape = checked;

    let newScope: 'both' | 'motion_only' | 'shape_only' = 'both';
    if (hasMotion && hasShape) newScope = 'both';
    else if (hasMotion && !hasShape) newScope = 'motion_only';
    else if (!hasMotion && hasShape) newScope = 'shape_only';
    else newScope = 'both';

    updateCustomPreset(preset.id, { scope: newScope });
  };

  const handleTriggerPreset = (preset: CustomMotionPreset) => {
    if (!selectedPartId) {
      showToast('Select an element on canvas to apply preset', 'info');
      return;
    }
    triggerLiveStunt(selectedPartId, preset.name, false, preset.id);
  };

  return (
    <div className="inspector-section presets-section" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Section 1: User Created Custom Presets */}
      <div>
        <div className="section-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-gold)' }}>
            <Sparkles size={14} /> KENDİ PRESET'LERİM ({customPresets.length})
          </span>
        </div>

        {customPresets.length === 0 ? (
          <div style={{ padding: '16px 12px', background: 'rgba(0,0,0,0.2)', border: '1px dashed var(--border-color)', borderRadius: 8, textAlign: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Henüz kaydedilmiş preset yok. <b>Motion</b> sekmesinden <b>+ Create Preset</b> diyerek kendi animasyonlarınızı kaydedebilirsiniz!
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {customPresets.map((preset) => {
              const scope = preset.scope || 'both';
              const isMotionChecked = scope === 'both' || scope === 'motion_only';
              const isShapeChecked = scope === 'both' || scope === 'shape_only';

              return (
                <div
                  key={preset.id}
                  style={{
                    background: 'var(--bg-dark)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    padding: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  {/* Title & Type Badge */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                      <Edit3 size={12} style={{ color: 'var(--accent-cyan)' }} />
                      <input
                        type="text"
                        value={preset.name}
                        onChange={(e) => updateCustomPreset(preset.id, { name: e.target.value })}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          borderBottom: '1px dashed rgba(255,255,255,0.2)',
                          color: '#fff',
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '1px 3px',
                          width: '100%',
                          outline: 'none',
                        }}
                        title="Tıkla ve preset ismini düzenle"
                      />
                    </div>

                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 800,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: preset.type === 'in' ? 'rgba(16,185,129,0.2)' : preset.type === 'out' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)',
                        color: preset.type === 'in' ? '#10b981' : preset.type === 'out' ? '#ef4444' : '#f59e0b',
                        border: `1px solid ${preset.type === 'in' ? '#10b981' : preset.type === 'out' ? '#ef4444' : '#f59e0b'}`,
                        textTransform: 'uppercase',
                      }}
                    >
                      {preset.type} ({preset.durationFrames}F)
                    </span>
                  </div>

                  {/* 2 Feature Scope Checkboxes */}
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px 8px', borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 10, color: isMotionChecked ? '#fff' : 'var(--text-muted)' }}>
                      <input
                        type="checkbox"
                        checked={isMotionChecked}
                        onChange={(e) => handleScopeToggle(preset, 'motion', e.target.checked)}
                        style={{ cursor: 'pointer', accentColor: '#38bdf8' }}
                      />
                      <Move size={11} style={{ color: '#38bdf8' }} />
                      <span>Hareket / Konum (Position X-Y)</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 10, color: isShapeChecked ? '#fff' : 'var(--text-muted)' }}>
                      <input
                        type="checkbox"
                        checked={isShapeChecked}
                        onChange={(e) => handleScopeToggle(preset, 'shape', e.target.checked)}
                        style={{ cursor: 'pointer', accentColor: '#c084fc' }}
                      />
                      <Maximize2 size={11} style={{ color: '#c084fc' }} />
                      <span>Şekil & Ölçek (Shape & Scale)</span>
                    </label>
                  </div>

                  {/* Actions Bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                    <button
                      type="button"
                      onClick={() => handleTriggerPreset(preset)}
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '4px 10px',
                        background: 'var(--accent-gold)',
                        color: '#000',
                        border: 'none',
                        borderRadius: 4,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                      title={selectedPart ? `Apply to "${selectedPart.name}"` : 'Select element on canvas to apply'}
                    >
                      <Play size={11} fill="#000" />
                      <span>Uygula / Çalıştır</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteCustomPreset(preset.id)}
                      style={{
                        fontSize: 10,
                        padding: '4px 8px',
                        background: 'rgba(239, 68, 68, 0.15)',
                        color: '#ef4444',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        borderRadius: 4,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                      title="Preset'i sil"
                    >
                      <Trash2 size={11} />
                      <span>Sil</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="divider-h" style={{ margin: '4px 0', borderColor: 'var(--border-color)' }} />

      {/* Section 2: Character Pose Library */}
      <div>
        <div className="section-title" style={{ marginBottom: 10 }}>
          <Tag size={13} className="text-cyan" />
          <span>STANDART POZ KÜTÜPHANESİ</span>
        </div>

        <div className="preset-grid">
          {PRESET_POSES.map((pose) => (
            <button
              key={pose.id}
              className="btn-secondary preset-btn"
              onClick={() => applyPresetPose(pose.id)}
              title={`Apply ${pose.name} pose to character`}
            >
              {pose.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
