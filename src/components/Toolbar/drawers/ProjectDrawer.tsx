import React from 'react';
import { useAnimator } from '../../../context/AnimatorContext';
import { Monitor } from 'lucide-react';

export const ProjectDrawer: React.FC = () => {
  const { projectResolution, setProjectResolution } = useAnimator();

  return (
    <div className="drawer-content" style={{ padding: '12px 14px' }}>
      <div className="drawer-header" style={{ marginBottom: 12 }}>
        <span className="drawer-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Monitor size={14} className="text-cyan" /> PROJE & KOMPOZİSYON AYARLARI
        </span>
      </div>

      <div className="form-group" style={{ marginBottom: 15 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 6, display: 'block' }}>
          Çözünürlük Şablonları
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <button
            className={`drawer-item-card ${projectResolution.width === 1920 && projectResolution.height === 1080 ? 'active' : ''}`}
            onClick={() => setProjectResolution({ width: 1920, height: 1080 })}
            style={{ padding: '8px 6px', fontSize: 11, fontWeight: 700, textAlign: 'center' }}
          >
            1080p (16:9)
          </button>
          <button
            className={`drawer-item-card ${projectResolution.width === 1080 && projectResolution.height === 1920 ? 'active' : ''}`}
            onClick={() => setProjectResolution({ width: 1080, height: 1920 })}
            style={{ padding: '8px 6px', fontSize: 11, fontWeight: 700, textAlign: 'center' }}
          >
            Vertical (9:16)
          </button>
          <button
            className={`drawer-item-card ${projectResolution.width === 1080 && projectResolution.height === 1080 ? 'active' : ''}`}
            onClick={() => setProjectResolution({ width: 1080, height: 1080 })}
            style={{ padding: '8px 6px', fontSize: 11, fontWeight: 700, textAlign: 'center' }}
          >
            Square (1:1)
          </button>
          <button
            className={`drawer-item-card ${projectResolution.width === 2560 && projectResolution.height === 1440 ? 'active' : ''}`}
            onClick={() => setProjectResolution({ width: 2560, height: 1440 })}
            style={{ padding: '8px 6px', fontSize: 11, fontWeight: 700, textAlign: 'center' }}
          >
            1440p (16:9)
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 4, display: 'block' }}>Genişlik (Width)</label>
          <input
            type="number"
            value={projectResolution.width}
            onChange={(e) => setProjectResolution((p) => ({ ...p, width: parseInt(e.target.value) || 1920 }))}
            style={{
              width: '100%',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              color: '#fff',
              borderRadius: 4,
              padding: '6px 8px',
              fontSize: 12,
              fontWeight: 700,
            }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 4, display: 'block' }}>Yükseklik (Height)</label>
          <input
            type="number"
            value={projectResolution.height}
            onChange={(e) => setProjectResolution((p) => ({ ...p, height: parseInt(e.target.value) || 1080 }))}
            style={{
              width: '100%',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              color: '#fff',
              borderRadius: 4,
              padding: '6px 8px',
              fontSize: 12,
              fontWeight: 700,
            }}
          />
        </div>
      </div>
    </div>
  );
};
