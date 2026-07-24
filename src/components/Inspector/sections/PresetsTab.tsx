import React from 'react';
import { useAnimator } from '../../../context/AnimatorContext';
import { Sparkles, Trash2, Play, Edit3, Move, Maximize2 } from 'lucide-react';
import type { CustomMotionPreset } from '../../../types/animator';

export const PresetsTab: React.FC = () => {
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
    const currentScope = preset.scope || 'both';
    let hasMotion = currentScope === 'both' || currentScope === 'motion_only';
    let hasShape = currentScope === 'both' || currentScope === 'shape_only';

    if (target === 'motion') hasMotion = checked;
    if (target === 'shape') hasShape = checked;

    let newScope: 'both' | 'motion_only' | 'shape_only' | 'none' = 'both';
    if (hasMotion && hasShape) newScope = 'both';
    else if (hasMotion && !hasShape) newScope = 'motion_only';
    else if (!hasMotion && hasShape) newScope = 'shape_only';
    else newScope = 'none';

    updateCustomPreset(preset.id, { scope: newScope });
  };

  const handleTriggerPreset = (preset: CustomMotionPreset) => {
    if (!selectedPartId) {
      showToast('Canvas üzerinde uygulamak istediğiniz katmana tıklayın', 'info');
      return;
    }
    triggerLiveStunt(selectedPartId, preset.name, false, preset.id);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
      {/* Header Title */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 6, borderBottom: '1px solid var(--border-color)' }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: 6, letterSpacing: '0.5px' }}>
          <Sparkles size={14} /> ÖZEL PRESET'LERİM ({customPresets.length})
        </span>
      </div>

      {customPresets.length === 0 ? (
        <div style={{ padding: '20px 14px', background: 'rgba(0,0,0,0.25)', border: '1px dashed var(--border-color)', borderRadius: 8, textAlign: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Henüz özel preset yok. <b>Motion</b> sekmesinden <b>+ Create Preset</b> diyerek keyframe hareketlerinizi kaydedebilirsiniz!
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {customPresets.map((preset) => {
            const scope = preset.scope || 'both';
            const isMotionChecked = scope === 'both' || scope === 'motion_only';
            const isShapeChecked = scope === 'both' || scope === 'shape_only';

            return (
              <div
                key={preset.id}
                style={{
                  background: 'var(--bg-darkest)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 6,
                  padding: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  transition: 'all 0.15s ease',
                }}
              >
                {/* Header: Editable Name & Badge */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
                    <Edit3 size={11} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} />
                    <input
                      type="text"
                      value={preset.name}
                      onChange={(e) => updateCustomPreset(preset.id, { name: e.target.value })}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        borderBottom: '1px dashed rgba(255,255,255,0.15)',
                        color: '#fff',
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '1px 2px',
                        width: '100%',
                        outline: 'none',
                      }}
                      title="Preset ismini düzenlemek için tıkla"
                    />
                  </div>

                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      padding: '1px 5px',
                      borderRadius: 3,
                      background: preset.type === 'in' ? 'rgba(16,185,129,0.15)' : preset.type === 'out' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                      color: preset.type === 'in' ? '#10b981' : preset.type === 'out' ? '#ef4444' : '#f59e0b',
                      border: `1px solid ${preset.type === 'in' ? 'rgba(16,185,129,0.4)' : preset.type === 'out' ? 'rgba(239,68,68,0.4)' : 'rgba(245,158,11,0.4)'}`,
                      textTransform: 'uppercase',
                      flexShrink: 0,
                    }}
                  >
                    {preset.type} ({preset.durationFrames}F)
                  </span>
                </div>

                {/* 2 Functional Scope Toggles */}
                <div style={{ background: 'rgba(0,0,0,0.4)', padding: '5px 8px', borderRadius: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 10, color: isMotionChecked ? '#f8fafc' : '#64748b' }}>
                    <input
                      type="checkbox"
                      checked={isMotionChecked}
                      onChange={(e) => handleScopeToggle(preset, 'motion', e.target.checked)}
                      style={{ cursor: 'pointer', accentColor: '#38bdf8' }}
                    />
                    <Move size={11} style={{ color: isMotionChecked ? '#38bdf8' : '#64748b' }} />
                    <span>Hareket / Konum (Position X-Y)</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 10, color: isShapeChecked ? '#f8fafc' : '#64748b' }}>
                    <input
                      type="checkbox"
                      checked={isShapeChecked}
                      onChange={(e) => handleScopeToggle(preset, 'shape', e.target.checked)}
                      style={{ cursor: 'pointer', accentColor: '#c084fc' }}
                    />
                    <Maximize2 size={11} style={{ color: isShapeChecked ? '#c084fc' : '#64748b' }} />
                    <span>Şekil & Ölçek (Shape & Scale)</span>
                  </label>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2, gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => handleTriggerPreset(preset)}
                    style={{
                      flex: 1,
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '4px 8px',
                      background: 'var(--accent-gold)',
                      color: '#000',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                    }}
                    title={selectedPart ? `"${selectedPart.name}" katmanında çalıştır` : 'Çalıştırmak için tuvalden katman seçin'}
                  >
                    <Play size={10} fill="#000" />
                    <span>Uygula / Çalıştır</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteCustomPreset(preset.id)}
                    style={{
                      fontSize: 10,
                      padding: '4px 8px',
                      background: 'rgba(239, 68, 68, 0.12)',
                      color: '#ef4444',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: 4,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                    title="Sil"
                  >
                    <Trash2 size={10} />
                    <span>Sil</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
