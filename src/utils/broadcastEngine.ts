import type { CharacterPart, CustomMotionPreset, LiveStuntType, BroadcastObjectState } from '../types/animator';

export const tickLiveStuntsState = (
  prevState: Record<string, { stunt: LiveStuntType; progress: number; loop?: boolean; customPresetId?: string }>,
  dtMs: number,
  customPresets: CustomMotionPreset[],
  fps: number
): Record<string, { stunt: LiveStuntType; progress: number; loop?: boolean; customPresetId?: string }> => {
  let changed = false;
  const next = { ...prevState };
  
  Object.entries(next).forEach(([id, item]) => {
    changed = true;
    let stuntDurMs = 800; // default built-in stunt duration 800ms
    if (item.customPresetId) {
      const cp = customPresets.find(p => p.id === item.customPresetId);
      if (cp) {
        const durF = cp.durationFrames || 30;
        stuntDurMs = (durF / (fps || 30)) * 1000;
      }
    }
    const deltaP = dtMs / Math.max(50, stuntDurMs);
    let newP = item.progress + deltaP;

    if (newP >= 1) {
      if (item.loop) {
        newP = newP % 1; // infinite loop reset
        next[id] = { ...item, progress: newP };
      } else {
        delete next[id]; // finished single-shot
      }
    } else {
      next[id] = { ...item, progress: newP };
    }
  });
  
  return changed ? next : prevState;
};

export const tickBroadcastState = (
  prevState: Record<string, BroadcastObjectState>,
  dtMs: number,
  characterParts: CharacterPart[],
  customPresets: CustomMotionPreset[],
  fps: number
): Record<string, BroadcastObjectState> => {
  let changed = false;
  const nextState = { ...prevState };

  Object.entries(nextState).forEach(([id, st]) => {
    if (st.state === 'animating_in' || st.state === 'animating_out') {
      changed = true;
      const part = characterParts.find(p => p.id === id);
      let durFrames = 30;
      if (part) {
        if (st.state === 'animating_in') {
          const cp = customPresets.find(p => p.id === part.inAnimPreset);
          if (cp) {
            durFrames = cp.durationFrames || part.inAnimDuration || 30;
          } else if (part.inAnimPreset === 'custom_timeline') {
            durFrames = Math.max(1, (part.inAnimTimelineEnd || 30) - (part.inAnimTimelineStart || 0));
          } else {
            durFrames = part.inAnimDuration || 30;
          }
        } else {
          const cp = customPresets.find(p => p.id === part.outAnimPreset);
          if (cp) {
            durFrames = cp.durationFrames || part.outAnimDuration || 30;
          } else if (part.outAnimPreset === 'custom_timeline') {
            durFrames = Math.max(1, (part.outAnimTimelineEnd || 30) - (part.outAnimTimelineStart || 0));
          } else {
            durFrames = part.outAnimDuration || 30;
          }
        }
      }
      const durMs = (durFrames / (fps || 30)) * 1000;
      const progressDelta = dtMs / Math.max(50, durMs);
      const newProgress = Math.min(1, st.progress + progressDelta);

      if (newProgress >= 1) {
        nextState[id] = {
          state: st.state === 'animating_in' ? 'visible' : 'hidden',
          progress: 1
        };
      } else {
        nextState[id] = { ...st, progress: newProgress };
      }
    }
  });

  return changed ? nextState : prevState;
};
