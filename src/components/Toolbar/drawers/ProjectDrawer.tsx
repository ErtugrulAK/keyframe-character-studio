import React from 'react';
import { useAnimator } from '../../../context/useAnimator';

export const ProjectDrawer: React.FC = () => {
  const { projectResolution, setProjectResolution } = useAnimator();

  return (
    <div className="drawer-content project-drawer-content">
      <div className="project-section">
        <label className="form-label project-field-label">
          Resolution Presets
        </label>
        <div className="project-preset-grid">
          <button
            className={`drawer-item-card project-preset-card ${projectResolution.width === 1920 && projectResolution.height === 1080 ? 'active' : ''}`}
            onClick={() => setProjectResolution({ width: 1920, height: 1080 })}
          >
            1080p (16:9)
          </button>
          <button
            className={`drawer-item-card project-preset-card ${projectResolution.width === 1080 && projectResolution.height === 1920 ? 'active' : ''}`}
            onClick={() => setProjectResolution({ width: 1080, height: 1920 })}
          >
            Vertical (9:16)
          </button>
          <button
            className={`drawer-item-card project-preset-card ${projectResolution.width === 1080 && projectResolution.height === 1080 ? 'active' : ''}`}
            onClick={() => setProjectResolution({ width: 1080, height: 1080 })}
          >
            Square (1:1)
          </button>
          <button
            className={`drawer-item-card project-preset-card ${projectResolution.width === 2560 && projectResolution.height === 1440 ? 'active' : ''}`}
            onClick={() => setProjectResolution({ width: 2560, height: 1440 })}
          >
            1440p (16:9)
          </button>
        </div>
      </div>

      <div className="project-field-row">
        <div className="project-field">
          <label className="form-label project-field-label">Width (px)</label>
          <input className="input-control project-num-input"
                type="number"
            value={projectResolution.width}
            onChange={(e) => setProjectResolution((p) => ({ ...p, width: parseInt(e.target.value) || 1920 }))}
          />
        </div>
        <div className="project-field">
          <label className="form-label project-field-label">Height (px)</label>
          <input className="input-control project-num-input"
                type="number"
            value={projectResolution.height}
            onChange={(e) => setProjectResolution((p) => ({ ...p, height: parseInt(e.target.value) || 1080 }))}
          />
        </div>
      </div>
    </div>
  );
};
