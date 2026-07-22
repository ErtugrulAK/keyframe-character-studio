import React from 'react';
import { Sparkles } from 'lucide-react';
import { PRESET_POSES } from '../../../utils/defaults';

interface PresetsTabProps {
  applyPresetPose: (poseId: string) => void;
}

export const PresetsTab: React.FC<PresetsTabProps> = ({ applyPresetPose }) => {
  return (
    <div className="inspector-section presets-section">
      <div className="section-title">
        <Sparkles size={13} className="text-gold" />
        <span>PRESET POSE LIBRARY</span>
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
  );
};
