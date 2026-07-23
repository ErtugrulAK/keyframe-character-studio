import React from 'react';
import { useAnimator } from '../../context/AnimatorContext';
import { Play, Square, RefreshCw, Zap } from 'lucide-react';
import './LiveDirector.css';

export const LiveDirectorPanel: React.FC = () => {
  const {
    characterParts,
    broadcastState,
    triggerBroadcastIn,
    triggerBroadcastOut,
    triggerAllBroadcastIn,
    triggerAllBroadcastOut,
    resetBroadcastState,
  } = useAnimator();

  const directorParts = characterParts; 

  return (
    <div className="live-director-panel">
      <div className="director-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 14, margin: 0, color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Zap size={14} /> LIVE DIRECTOR PANEL
          </h2>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Trigger broadcast graphic animations in real time</span>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
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
      
      <div className="director-list">
        {directorParts.map(part => {
          const st = broadcastState[part.id];
          const currentState = st ? st.state : 'hidden';
          const isAnimatingIn = currentState === 'animating_in';
          const isAnimatingOut = currentState === 'animating_out';
          const isVisible = currentState === 'visible';
          
          let statusColor = 'var(--text-muted)';
          let statusText = 'HIDDEN';
          if (isAnimatingIn) { statusColor = 'var(--accent-cyan)'; statusText = 'PLAYING IN'; }
          else if (isVisible) { statusColor = 'var(--accent-green)'; statusText = 'LIVE'; }
          else if (isAnimatingOut) { statusColor = 'var(--accent-red)'; statusText = 'PLAYING OUT'; }

          return (
            <div key={part.id} className="director-item">
              <div className="director-item-info">
                <span className="director-item-name">{part.name || part.type}</span>
                <span className="director-item-status" style={{ color: statusColor }}>
                  <div className="status-dot" style={{ backgroundColor: statusColor }} />
                  {statusText}
                </span>
              </div>
              <div className="director-item-actions">
                <button 
                  className={`btn-director ${currentState !== 'hidden' && !isAnimatingOut ? 'active' : ''}`}
                  onClick={() => triggerBroadcastIn(part.id)}
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
          );
        })}
      </div>
    </div>
  );
};
