import React, { useState } from 'react';
import { useAnimator } from '../../context/AnimatorContext';
import { Play, Square, RefreshCw, Zap, EyeOff, Sparkles, Repeat, OctagonX } from 'lucide-react';
import type { LiveStuntType } from '../../types/animator';
import './LiveDirector.css';

const BUILTIN_STUNTS: { id: LiveStuntType; label: string; icon: string }[] = [
  { id: 'bounce', label: 'BOUNCE', icon: '🏀' },
  { id: 'pulse', label: 'PULSE', icon: '💥' },
  { id: 'wobble', label: 'WOBBLE', icon: '👋' },
  { id: 'spin', label: 'SPIN 360', icon: '🌀' },
  { id: 'shake', label: 'SHAKE', icon: '🔥' },
  { id: 'float', label: 'FLOAT', icon: '🎈' },
];

export const LiveDirectorPanel: React.FC = () => {
  const {
    characterParts,
    tracks,
    broadcastState,
    triggerBroadcastIn,
    triggerBroadcastOut,
    triggerAllBroadcastIn,
    triggerAllBroadcastOut,
    resetBroadcastState,
    triggerLiveStunt,
    stopLiveStunt,
    setStuntLoopState,
    stopAllLiveStunts,
    liveStuntsState,
    customPresets,
  } = useAnimator();

  const [isLoopingStunt, setIsLoopingStunt] = useState<boolean>(false);

  const activeDirectorParts = characterParts.filter(part => {
    const track = tracks.find(t => t.partId === part.id);
    return !track || track.visible !== false;
  });
  const stuntPresets = customPresets.filter(p => p.type === 'stunt' || p.type === 'in' || p.type === 'out');

  return (
    <div className="live-director-panel">
      <div className="director-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 14, margin: 0, color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Zap size={14} /> LIVE DIRECTOR PANEL
          </h2>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Trigger broadcast graphic animations & live custom keyframe stunts in real time</span>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Global Loop Stunt Toggle */}
          <button
            type="button"
            className="btn-director"
            onClick={() => {
              const nextVal = !isLoopingStunt;
              setIsLoopingStunt(nextVal);
              setStuntLoopState(nextVal);
            }}
            style={{
              fontSize: 10,
              padding: '4px 8px',
              height: 28,
              background: isLoopingStunt ? 'rgba(192, 132, 252, 0.25)' : 'var(--bg-input)',
              border: `1px solid ${isLoopingStunt ? '#c084fc' : 'var(--border-color)'}`,
              color: isLoopingStunt ? '#c084fc' : 'var(--text-muted)',
              fontWeight: 700,
            }}
            title={isLoopingStunt ? 'Looping Stunts is ON (Infinite Repeat)' : 'Single Shot Stunts (Click to disable Loop)'}
          >
            <Repeat size={12} /> {isLoopingStunt ? 'LOOP: ON' : 'LOOP: OFF'}
          </button>

          {Object.keys(liveStuntsState).length > 0 && (
            <button
              type="button"
              className="btn-director out"
              onClick={stopAllLiveStunts}
              style={{ fontSize: 10, padding: '4px 8px', height: 28, background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#ef4444', fontWeight: 700 }}
              title="Stop All Running Live Stunts Immediately"
            >
              🛑 STOP ALL STUNTS
            </button>
          )}

          <button
            className="btn-director active"
            style={{ fontSize: 11, padding: '4px 10px', height: 28, background: 'var(--accent-green)', color: '#000', fontWeight: 700 }}
            onClick={triggerAllBroadcastIn}
          >
            <Play size={12} fill="#000" /> PLAY ALL IN
          </button>
          <button
            className="btn-director out"
            style={{ fontSize: 11, padding: '4px 10px', height: 28 }}
            onClick={triggerAllBroadcastOut}
          >
            <Square size={12} /> PLAY ALL OUT
          </button>
          <button
            className="btn-director"
            style={{ fontSize: 11, padding: '4px 10px', height: 28, color: 'var(--text-muted)' }}
            onClick={resetBroadcastState}
          >
            <RefreshCw size={12} /> RESET ALL
          </button>
        </div>
      </div>
      
      <div className="director-list" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {activeDirectorParts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 12px', background: 'var(--bg-dark)', borderRadius: 8, border: '1px dashed var(--border-color)', color: 'var(--text-muted)', fontSize: 11 }}>
            <EyeOff size={20} style={{ marginBottom: 6, display: 'block', margin: '0 auto 6px', color: '#ef4444' }} />
            <span>Yayında aktif katman bulunmuyor. Zaman çizelgesinden göz simgesi kapalı olan katmanlar yayından gizlenir.</span>
          </div>
        ) : (
          activeDirectorParts.map(part => {
            const st = broadcastState[part.id];
            const currentState = st ? st.state : 'hidden';
            const isAnimatingIn = currentState === 'animating_in';
            const isAnimatingOut = currentState === 'animating_out';
            const isVisible = currentState === 'visible';

            const activeStunt = liveStuntsState[part.id];
            const isStunting = !!activeStunt;
            
            let statusColor = 'var(--text-muted)';
            let statusText = 'HIDDEN';
            if (isStunting) {
              statusColor = 'var(--accent-gold)';
              statusText = `STUNT: ${activeStunt.stunt.toUpperCase()} ${activeStunt.loop ? '(LOOPING)' : ''}`;
            }
            else if (isAnimatingIn) { statusColor = 'var(--accent-cyan)'; statusText = 'PLAYING IN'; }
            else if (isVisible) { statusColor = 'var(--accent-green)'; statusText = 'LIVE'; }
            else if (isAnimatingOut) { statusColor = 'var(--accent-red)'; statusText = 'PLAYING OUT'; }

          return (
            <div key={part.id} className="director-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="director-item-info">
                  <span className="director-item-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {part.name || part.type}
                  </span>
                  <span className="director-item-status" style={{ color: statusColor }}>
                    <div className="status-dot" style={{ backgroundColor: statusColor }} />
                    {statusText}
                  </span>
                </div>
                <div className="director-item-actions">
                  <button 
                    className={`btn-director ${currentState !== 'hidden' && !isAnimatingOut ? 'active' : ''}`}
                    onClick={() => triggerBroadcastIn(part.id)}
                    title="Trigger entrance animation"
                  >
                    <Play size={14} /> PLAY IN
                  </button>
                  <button 
                    className="btn-director out"
                    onClick={() => triggerBroadcastOut(part.id)}
                    disabled={currentState === 'hidden' && !isAnimatingOut}
                  >
                    <Square size={14} /> PLAY OUT
                  </button>
                </div>
              </div>

              {/* Realtime Live Stunts & Custom Motion Presets Bar */}
              {currentState !== 'hidden' && (
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 10px', borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Sparkles size={11} /> LIVE STUNTS & CUSTOM KEYFRAME ATTRACTIONS:
                    </span>
                    {isStunting && (
                      <button
                        type="button"
                        onClick={() => stopLiveStunt(part.id)}
                        style={{
                          fontSize: 9,
                          padding: '2px 6px',
                          background: '#ef4444',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 4,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 3,
                        }}
                      >
                        <OctagonX size={10} /> STOP STUNT
                      </button>
                    )}
                  </div>

                  {/* Built-in Instant Stunts */}
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {BUILTIN_STUNTS.map((stunt) => {
                      const isActive = activeStunt?.stunt === stunt.id;
                      return (
                        <button
                          key={stunt.id}
                          type="button"
                          onClick={() => {
                            if (isActive) {
                              stopLiveStunt(part.id);
                            } else {
                              triggerLiveStunt(part.id, stunt.id, isLoopingStunt);
                            }
                          }}
                          style={{
                            fontSize: 9,
                            padding: '3px 7px',
                            background: isActive ? 'var(--accent-gold)' : 'var(--bg-input)',
                            color: isActive ? '#000' : '#fff',
                            border: `1px solid ${isActive ? '#f59e0b' : 'var(--border-color)'}`,
                            boxShadow: isActive ? '0 0 8px rgba(245,158,11,0.5)' : 'none',
                            borderRadius: 4,
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 3,
                            transition: 'all 0.15s ease',
                          }}
                          title={isActive ? 'Click to stop stunt' : 'Click to trigger stunt'}
                        >
                          <span>{stunt.icon}</span>
                          <span>{stunt.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom Saved Keyframe Motion Presets */}
                  {stuntPresets.length > 0 && (
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 2, paddingTop: 4, borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
                      <span style={{ fontSize: 9, color: '#c084fc', fontWeight: 700, alignSelf: 'center', marginRight: 4 }}>
                        CUSTOM SAVED:
                      </span>
                      {stuntPresets.map((preset) => {
                        const isActive = activeStunt?.customPresetId === preset.id;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => {
                              if (isActive) {
                                stopLiveStunt(part.id);
                              } else {
                                triggerLiveStunt(part.id, preset.name, isLoopingStunt, preset.id);
                              }
                            }}
                            style={{
                              fontSize: 9,
                              padding: '3px 7px',
                              background: isActive ? '#c084fc' : 'rgba(147, 51, 234, 0.15)',
                              color: isActive ? '#000' : '#c084fc',
                              border: `1px solid ${isActive ? '#c084fc' : 'rgba(147, 51, 234, 0.4)'}`,
                              boxShadow: isActive ? '0 0 8px rgba(192,132,252,0.6)' : 'none',
                              borderRadius: 4,
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 3,
                              transition: 'all 0.15s ease',
                            }}
                            title={isActive ? 'Click to stop custom stunt' : 'Click to trigger custom stunt'}
                          >
                            <span>⭐</span>
                            <span>{preset.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
      </div>
    </div>
  );
};
