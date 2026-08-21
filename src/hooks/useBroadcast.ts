import { useState, useCallback, useRef, useEffect } from 'react';
import type { AppMode, BroadcastObjectState, LiveStuntType, CustomMotionPreset, CharacterPart, Track } from '../types/animator';
import {
  createIdleNamedSequenceRuntime,
  startNamedSequence,
  syncBroadcastParts,
  tickBroadcastState,
  tickLiveStuntsState,
  tickNamedSequenceRuntime,
} from '../utils/broadcastEngine';

interface UseBroadcastOptions {
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  setCurrentFrame: React.Dispatch<React.SetStateAction<number>> | ((frame: number | ((prev: number) => number)) => void);
  characterParts: CharacterPart[];
  tracksRef: React.MutableRefObject<Track[]>;
  characterPartsRef: React.MutableRefObject<CharacterPart[]>;
  customPresetsRef: React.MutableRefObject<CustomMotionPreset[]>;
  fpsRef: React.MutableRefObject<number>;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const useBroadcast = ({
  setIsPlaying,
  characterParts,
  tracksRef,
  characterPartsRef,
  customPresetsRef,
  fpsRef,
  showToast,
}: UseBroadcastOptions) => {
  // Broadcast Mode State
  const [appMode, setAppMode] = useState<AppMode>('edit');
  const [broadcastState, setBroadcastState] = useState<Record<string, BroadcastObjectState>>({});
  const [namedSequenceRuntime, setNamedSequenceRuntime] = useState(createIdleNamedSequenceRuntime);
  const [broadcastSessionActivated, setBroadcastSessionActivated] = useState(false);

  useEffect(() => {
    if (appMode === 'broadcast') {
      setIsPlaying(false);
      setBroadcastState({});
      setBroadcastSessionActivated(false);
    } else {
      setNamedSequenceRuntime(createIdleNamedSequenceRuntime());
    }
  }, [appMode]);

  const playNamedSequence = useCallback((sequenceId: string, durationFrames: number) => {
    setBroadcastSessionActivated(true);
    setNamedSequenceRuntime(startNamedSequence(sequenceId, durationFrames));
  }, []);

  const stopNamedSequence = useCallback(() => {
    setNamedSequenceRuntime(createIdleNamedSequenceRuntime());
  }, []);

  const updateNamedSequenceDuration = useCallback((sequenceId: string, durationFrames: number) => {
    const duration = Number.isFinite(durationFrames) ? Math.max(0, Math.floor(durationFrames)) : 0;
    setNamedSequenceRuntime((prev) => {
      if (prev.sequenceId !== sequenceId) return prev;
      const frame = Math.min(prev.frame, duration);
      return {
        ...prev,
        durationFrames: duration,
        frame,
        status: duration === 0 || frame >= duration ? 'holding' : prev.status,
      };
    });
  }, []);

  // BUGFIX: broadcast sequence switching is driven by broadcastState, NOT by
  // the edit-timeline playback. When the part list changes while in broadcast
  // mode (e.g. selecting another sequence/template), (a) parts that no longer
  // exist are dropped from the state (no state leak from the previous
  // sequence) and (b) NEW parts start animating in. The edit playback state
  // (currentFrame/isPlaying) is left untouched — selecting a sequence never
  // behaves like pressing Play in the edit timeline.
  useEffect(() => {
    if (appMode !== 'broadcast') return;
    setBroadcastState((prev) => syncBroadcastParts(prev, characterParts));
  }, [appMode, characterParts]);

  const resetBroadcastState = useCallback(() => {
    setBroadcastState({});
    setBroadcastSessionActivated(false);
  }, []);

  const triggerBroadcastIn = useCallback((partId: string) => {
    const track = tracksRef.current.find(t => t.partId === partId);
    if (track && track.visible === false) {
      showToast('Layer is hidden via eye icon on timeline (muted from broadcast)', 'info');
      return;
    }
    setBroadcastSessionActivated(true);
    setBroadcastState(prev => ({
      ...prev,
      [partId]: { state: 'animating_in', progress: 0 }
    }));
  }, [showToast]);

  const triggerBroadcastOut = useCallback((partId: string) => {
    setBroadcastSessionActivated(true);
    setBroadcastState(prev => ({
      ...prev,
      [partId]: { state: 'animating_out', progress: 0 }
    }));
  }, []);

  const triggerAllBroadcastIn = useCallback(() => {
    setBroadcastSessionActivated(true);
    const nextState: Record<string, BroadcastObjectState> = {};
    characterPartsRef.current.forEach(p => {
      const track = tracksRef.current.find(t => t.partId === p.id);
      if (!track || track.visible !== false) {
        nextState[p.id] = { state: 'animating_in', progress: 0 };
      }
    });
    setBroadcastState(nextState);
  }, []);

  const triggerAllBroadcastOut = useCallback(() => {
    setBroadcastSessionActivated(true);
    setBroadcastState(prev => {
      const nextState = { ...prev };
      characterPartsRef.current.forEach(p => {
        if (nextState[p.id] && nextState[p.id].state !== 'hidden') {
          nextState[p.id] = { state: 'animating_out', progress: 0 };
        }
      });
      return nextState;
    });
  }, []);

  // Realtime Live Stunts Engine
  const [liveStuntsState, setLiveStuntsState] = useState<Record<string, { stunt: LiveStuntType; progress: number; loop?: boolean; customPresetId?: string }>>({});

  const triggerLiveStunt = useCallback((partId: string, stunt: LiveStuntType, loop?: boolean, customPresetId?: string) => {
    setBroadcastSessionActivated(true);
    if (customPresetId) {
      const cp = customPresetsRef.current.find(p => p.id === customPresetId);
      if (cp) {
        const isExit = cp.type === 'out' || cp.name.toLowerCase().includes('exit') || cp.name.toLowerCase().includes('out');
        const isEntrance = cp.type === 'in' || cp.name.toLowerCase().includes('enter') || cp.name.toLowerCase().includes('in');

        if (isExit) {
          setBroadcastState(prev => ({
            ...prev,
            [partId]: { state: 'animating_out', progress: 0 }
          }));
          showToast(`Triggered exit preset "${cp.name}"`, 'info');
          return;
        } else if (isEntrance) {
          setBroadcastState(prev => ({
            ...prev,
            [partId]: { state: 'animating_in', progress: 0 }
          }));
          showToast(`Triggered entrance preset "${cp.name}"`, 'success');
          return;
        }
      }
    }

    setLiveStuntsState(prev => ({
      ...prev,
      [partId]: { stunt, progress: 0, loop, customPresetId }
    }));
    showToast(`Triggered live stunt "${stunt.toUpperCase()}"${loop ? ' (LOOPING)' : ''}!`, 'success');
  }, [showToast]);

  const stopLiveStunt = useCallback((partId: string) => {
    setLiveStuntsState(prev => {
      const next = { ...prev };
      delete next[partId];
      return next;
    });
    showToast('Stopped live stunt', 'info');
  }, [showToast]);

  const setStuntLoopState = useCallback((loop: boolean) => {
    setLiveStuntsState(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(id => {
        next[id] = { ...next[id], loop };
      });
      return next;
    });
    showToast(`Live stunt loop set to ${loop ? 'ON' : 'OFF'}`, 'info');
  }, [showToast]);

  const stopAllLiveStunts = useCallback(() => {
    setLiveStuntsState({});
    showToast('Stopped all live stunts', 'info');
  }, [showToast]);

  // Broadcast Loop
  const broadcastLastTimeRef = useRef<number>(performance.now());
  const broadcastReqRef = useRef<number | null>(null);

  useEffect(() => {
    if (appMode !== 'broadcast') {
      if (broadcastReqRef.current) cancelAnimationFrame(broadcastReqRef.current);
      return;
    }

    broadcastLastTimeRef.current = performance.now();

    const loop = (time: number) => {
      const dtMs = time - broadcastLastTimeRef.current;
      broadcastLastTimeRef.current = time;

      // Update progress for active live stunts
      setLiveStuntsState(prev => 
        tickLiveStuntsState(prev, dtMs, customPresetsRef.current, fpsRef.current || 30)
      );

      // Update progress for animating objects
      setBroadcastState(prev => 
        tickBroadcastState(prev, dtMs, characterPartsRef.current, customPresetsRef.current, fpsRef.current || 30)
      );

      setNamedSequenceRuntime(prev =>
        tickNamedSequenceRuntime(prev, dtMs, fpsRef.current || 30)
      );

      broadcastReqRef.current = requestAnimationFrame(loop);
    };

    broadcastReqRef.current = requestAnimationFrame(loop);

    return () => {
      if (broadcastReqRef.current) cancelAnimationFrame(broadcastReqRef.current);
    };
  }, [appMode]);

  return {
    appMode,
    setAppMode,
    broadcastState,
    setBroadcastState,
    broadcastSessionActivated,
    namedSequenceRuntime,
    playNamedSequence,
    stopNamedSequence,
    updateNamedSequenceDuration,
    triggerBroadcastIn,
    triggerBroadcastOut,
    triggerAllBroadcastIn,
    triggerAllBroadcastOut,
    resetBroadcastState,
    liveStuntsState,
    setLiveStuntsState,
    triggerLiveStunt,
    stopLiveStunt,
    setStuntLoopState,
    stopAllLiveStunts,
  };
};
