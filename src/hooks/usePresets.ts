import { useState, useRef, useEffect } from 'react';
import type { CustomMotionPreset } from '../types/animator';
import { DEFAULT_INITIAL_PRESETS } from '../context/initialStateData';

export const usePresets = () => {
  const [customPresets] = useState<CustomMotionPreset[]>(() => {
    const saved = localStorage.getItem('keyframe_custom_motion_presets');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return DEFAULT_INITIAL_PRESETS;
      }
    }
    return DEFAULT_INITIAL_PRESETS;
  });

  const customPresetsRef = useRef(customPresets);
  customPresetsRef.current = customPresets;

  useEffect(() => {
    localStorage.setItem('keyframe_custom_motion_presets', JSON.stringify(customPresets));
  }, [customPresets]);

  return { customPresets, customPresetsRef };
};
