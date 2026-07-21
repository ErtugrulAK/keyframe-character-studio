import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useAnimator } from '../../context/AnimatorContext';
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Plus,
  Layers,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import './SequencerTimeline.css';

export const SequencerTimeline: React.FC = () => {
  const {
    currentFrame,
    setCurrentFrame,
    totalFrames,
    tracks,
    selectedPartId,
    setSelectedPartId,
    selectedKeyframeId,
    setSelectedKeyframeId,
    addKeyframeToTrack,
    updateKeyframeFrame,
    toggleTrackVisibility,
    toggleTrackLock,
    deleteKeyframe,
    timelineZoom,
    setTimelineZoom,
  } = useAnimator();

  const timelineGridRef = useRef<HTMLDivElement>(null);
  const [draggingKf, setDraggingKf] = useState<{ trackId: string; keyframeId: string } | null>(null);
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);

  const FRAME_WIDTH = timelineZoom; // Dynamic px per frame step

  const frameNumbers = Array.from({ length: totalFrames + 1 }, (_, i) => i);

  // Convert click position on timeline grid to Frame index
  const getFrameFromMouse = useCallback(
    (clientX: number) => {
      if (!timelineGridRef.current) return 0;
      const rect = timelineGridRef.current.getBoundingClientRect();
      const scrollLeft = timelineGridRef.current.scrollLeft;
      const offsetX = clientX - rect.left + scrollLeft;
      const frame = Math.round(offsetX / FRAME_WIDTH);
      return Math.max(0, Math.min(totalFrames, frame));
    },
    [totalFrames, FRAME_WIDTH]
  );

  // Ruler scrub handler
  const handleRulerMouseDown = (e: React.MouseEvent) => {
    setIsScrubbing(true);
    const frame = getFrameFromMouse(e.clientX);
    setCurrentFrame(frame);
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isScrubbing) {
        const frame = getFrameFromMouse(e.clientX);
        setCurrentFrame(frame);
      } else if (draggingKf) {
        const frame = getFrameFromMouse(e.clientX);
        updateKeyframeFrame(draggingKf.trackId, draggingKf.keyframeId, frame);
      }
    },
    [isScrubbing, draggingKf, getFrameFromMouse, setCurrentFrame, updateKeyframeFrame]
  );

  const handleMouseUp = useCallback(() => {
    setIsScrubbing(false);
    setDraggingKf(null);
  }, []);

  useEffect(() => {
    if (isScrubbing || draggingKf) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isScrubbing, draggingKf, handleMouseMove, handleMouseUp]);

  return (
    <footer className="sequencer-timeline">
      {/* Timeline Header Control Bar */}
      <div className="timeline-header">
        <div className="timeline-header-left">
          <Layers size={14} className="text-cyan" />
          <span>SEQUENCER TIMELINE TRACKS</span>
        </div>

        {/* Timeline Zoom Controls */}
        <div className="timeline-header-right">
          <div className="timeline-zoom-controls">
            <button
              className="btn-icon zoom-btn"
              onClick={() => setTimelineZoom((z) => Math.max(10, z - 3))}
              title="Timeline'ı Uzaklaştır"
            >
              <ZoomOut size={13} />
            </button>

            <span className="zoom-value">{timelineZoom}px/frame</span>

            <button
              className="btn-icon zoom-btn"
              onClick={() => setTimelineZoom((z) => Math.min(36, z + 3))}
              title="Timeline'ı Yakınlaştır"
            >
              <ZoomIn size={13} />
            </button>
          </div>

          <div className="divider-v" />
          <span className="total-span">SÜRE: {totalFrames} FRAMES</span>
        </div>
      </div>

      <div className="timeline-body">
        {/* Left Track Outliner Header List */}
        <div className="track-outliner">
          <div className="outliner-ruler-header">
            <span>KATMAN HİYERARŞİSİ</span>
          </div>

          <div className="outliner-list">
            {tracks.map((track) => {
              const isSelectedPart = selectedPartId === track.partId;
              const kfCount = track.keyframes.length;

              return (
                <div
                  key={track.id}
                  className={`track-outliner-row ${isSelectedPart ? 'selected' : ''}`}
                  onClick={() => setSelectedPartId(track.partId)}
                >
                  <div className="track-controls">
                    <button
                      className="btn-icon track-icon-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleTrackVisibility(track.id);
                      }}
                      title={track.visible ? 'Gizle' : 'Göster'}
                    >
                      {track.visible ? <Eye size={13} /> : <EyeOff size={13} className="text-muted" />}
                    </button>

                    <button
                      className="btn-icon track-icon-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleTrackLock(track.id);
                      }}
                      title={track.locked ? 'Kilidi Aç' : 'Kilitle'}
                    >
                      {track.locked ? <Lock size={13} className="text-gold" /> : <Unlock size={13} />}
                    </button>
                  </div>

                  <div className="track-color-badge" style={{ backgroundColor: track.color }} />

                  <span className="track-label">{track.name}</span>

                  <span className="kf-count-tag" title="Keyframe Sayısı">{kfCount} KF</span>

                  <button
                    className="btn-icon track-add-kf-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      addKeyframeToTrack(track.id, currentFrame);
                    }}
                    title="Keyframe Ekle (Şu Anki Frame'e)"
                  >
                    <Plus size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Scrollable Timeline Grid with Ruler & Keyframe Diamonds */}
        <div className="timeline-grid-container" ref={timelineGridRef}>
          {/* Time Ruler */}
          <div className="time-ruler" onMouseDown={handleRulerMouseDown}>
            {frameNumbers.map((frame) => (
              <div
                key={frame}
                className={`ruler-mark ${frame % 5 === 0 ? 'major' : 'minor'}`}
                style={{ left: `${frame * FRAME_WIDTH}px` }}
              >
                {frame % 5 === 0 && <span className="ruler-label">{frame}</span>}
              </div>
            ))}
          </div>

          {/* Draggable Playhead Scrubber Line */}
          <div className="playhead-line" style={{ left: `${currentFrame * FRAME_WIDTH}px` }}>
            <div className="playhead-head" />
          </div>

          {/* Keyframe Track Lanes */}
          <div className="track-lanes">
            {tracks.map((track) => {
              const isSelectedPart = selectedPartId === track.partId;
              return (
                <div
                  key={track.id}
                  className={`track-lane ${isSelectedPart ? 'selected' : ''}`}
                  style={{ width: `${(totalFrames + 2) * FRAME_WIDTH}px` }}
                >
                  {/* Keyframe Diamonds */}
                  {track.keyframes.map((kf) => {
                    const isKfSelected = selectedKeyframeId === kf.id;
                    return (
                      <div
                        key={kf.id}
                        className={`keyframe-diamond ${isKfSelected ? 'selected' : ''}`}
                        style={{ left: `${kf.frame * FRAME_WIDTH}px`, borderColor: track.color }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedKeyframeId(kf.id);
                          setSelectedPartId(track.partId);
                          setCurrentFrame(kf.frame);
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setDraggingKf({ trackId: track.id, keyframeId: kf.id });
                          setSelectedKeyframeId(kf.id);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          if (confirm(`Frame ${kf.frame} keyframe'ini silmek istediğinize emin misiniz?`)) {
                            deleteKeyframe(track.id, kf.id);
                          }
                        }}
                        title={`Frame: ${kf.frame} | Easing: ${kf.easing} (Sağ tık: Sil)`}
                      >
                        <div className="diamond-inner" style={{ backgroundColor: track.color }} />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </footer>
  );
};
