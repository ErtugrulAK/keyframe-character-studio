import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useAnimator } from '../../context/AnimatorContext';
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Plus,
  ZoomIn,
  ZoomOut,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Undo2,
  Redo2,
  Clock,
  Scissors,
} from 'lucide-react';
import './SequencerTimeline.css';

export const SequencerTimeline: React.FC = () => {
  const {
    currentFrame,
    setCurrentFrame,
    isPlaying,
    setIsPlaying,
    totalFrames,
    setTotalFrames,
    fps,
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
    isLooping,
    setIsLooping,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useAnimator();

  const timelineGridRef = useRef<HTMLDivElement>(null);
  const timelineBodyRef = useRef<HTMLDivElement>(null);
  const [draggingKf, setDraggingKf] = useState<{ trackId: string; keyframeId: string } | null>(null);
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const [hoveredKf, setHoveredKf] = useState<{ frame: number; easing: string; trackName: string } | null>(null);

  const FRAME_WIDTH = timelineZoom; // Dynamic px per frame step

  const frameNumbers = Array.from({ length: totalFrames + 1 }, (_, i) => i);

  // Convert click position on timeline grid to Frame index (clamped to totalFrames)
  const getFrameFromMouse = useCallback(
    (clientX: number) => {
      if (!timelineGridRef.current) return 0;
      const rect = timelineGridRef.current.getBoundingClientRect();
      const scrollLeft = timelineGridRef.current.scrollLeft;
      const offsetX = clientX - rect.left + scrollLeft;
      const frame = Math.max(0, Math.min(totalFrames, Math.round(offsetX / FRAME_WIDTH)));
      return frame;
    },
    [totalFrames, FRAME_WIDTH]
  );

  // Crop timeline length to last keyframe position (removes empty trailing frames)
  const handleCropToContent = () => {
    let maxFrame = 0;
    tracks.forEach((track) => {
      track.keyframes.forEach((kf) => {
        if (kf.frame > maxFrame) {
          maxFrame = kf.frame;
        }
      });
    });
    const optimalFrames = maxFrame > 0 ? maxFrame : 30;
    setTotalFrames(optimalFrames);
  };

  // Scroll to Zoom & Pan Event Handler
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (!timelineGridRef.current) return;
      
      const grid = timelineGridRef.current;
      const rect = grid.getBoundingClientRect();

      // Check if scrolling horizontally (Shift + Wheel) or vertically for panning
      if (e.shiftKey) {
        e.preventDefault();
        grid.scrollLeft += e.deltaY;
        return;
      }

      // Scroll Zooming (Standard mouse wheel or Ctrl + Wheel)
      e.preventDefault();

      const mouseXInGrid = e.clientX - rect.left;
      const currentScrollLeft = grid.scrollLeft;
      const frameAtMouse = (mouseXInGrid + currentScrollLeft) / FRAME_WIDTH;

      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
      const newZoom = Math.min(60, Math.max(6, Math.round(FRAME_WIDTH * zoomFactor)));

      if (newZoom !== FRAME_WIDTH) {
        setTimelineZoom(newZoom);
        
        // Adjust scroll position to zoom centered around mouse cursor
        requestAnimationFrame(() => {
          if (timelineGridRef.current) {
            timelineGridRef.current.scrollLeft = Math.max(0, frameAtMouse * newZoom - mouseXInGrid);
          }
        });
      }
    },
    [FRAME_WIDTH, setTimelineZoom]
  );

  // Attach native non-passive wheel event listener to timeline grid ref
  useEffect(() => {
    const gridEl = timelineGridRef.current;
    if (!gridEl) return;

    gridEl.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      gridEl.removeEventListener('wheel', handleWheel);
    };
  }, [handleWheel]);

  // Auto-scroll timeline when currentFrame plays out of viewport
  useEffect(() => {
    if (!timelineGridRef.current) return;
    const grid = timelineGridRef.current;
    const currentX = currentFrame * FRAME_WIDTH;
    const visibleStart = grid.scrollLeft;
    const visibleEnd = visibleStart + grid.clientWidth - 40;

    if (currentX < visibleStart) {
      grid.scrollLeft = Math.max(0, currentX - 60);
    } else if (currentX > visibleEnd) {
      grid.scrollLeft = currentX - grid.clientWidth + 100;
    }
  }, [currentFrame, FRAME_WIDTH]);

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

  // Timeline Panel Height Resizing
  const [timelineHeight, setTimelineHeight] = useState<number>(295);
  const [isResizingHeight, setIsResizingHeight] = useState<boolean>(false);
  const resizeStartYRef = useRef<number>(0);
  const initialHeightRef = useRef<number>(295);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingHeight(true);
    resizeStartYRef.current = e.clientY;
    initialHeightRef.current = timelineHeight;
  };

  const handleResizeMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizingHeight) return;
      const dy = resizeStartYRef.current - e.clientY; // Drag up expands height
      const newHeight = Math.max(130, Math.min(650, initialHeightRef.current + dy));
      setTimelineHeight(newHeight);
    },
    [isResizingHeight]
  );

  const handleResizeEnd = useCallback(() => {
    setIsResizingHeight(false);
  }, []);

  useEffect(() => {
    if (isResizingHeight) {
      window.addEventListener('mousemove', handleResizeMove);
      window.addEventListener('mouseup', handleResizeEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleResizeMove);
      window.removeEventListener('mouseup', handleResizeEnd);
    };
  }, [isResizingHeight, handleResizeMove, handleResizeEnd]);

  // Mouse Wheel Scroll Zoom on Timeline Track Grid
  useEffect(() => {
    const gridEl = timelineGridRef.current;
    if (!gridEl) return;

    const handleTimelineWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.shiftKey) {
        // Shift + Wheel scrolls timeline tracks horizontally
        gridEl.scrollLeft += e.deltaY;
      } else {
        // Direct Scroll Wheel zooms timeline tracks in/out
        const zoomDelta = e.deltaY < 0 ? 2 : -2;
        setTimelineZoom((prev) => Math.max(6, Math.min(60, prev + zoomDelta)));
      }
    };

    gridEl.addEventListener('wheel', handleTimelineWheel, { passive: false });
    return () => {
      gridEl.removeEventListener('wheel', handleTimelineWheel);
    };
  }, []);

  const handleFitTimeline = () => {
    if (!timelineGridRef.current) return;
    const gridWidth = timelineGridRef.current.clientWidth - 40;
    const optimalZoom = Math.max(6, Math.min(30, Math.floor(gridWidth / totalFrames)));
    setTimelineZoom(optimalZoom);
    if (timelineGridRef.current) timelineGridRef.current.scrollLeft = 0;
  };

  const formatTimecode = (frame: number, currentFps: number) => {
    const totalSeconds = Math.floor(frame / currentFps);
    const subFrames = frame % currentFps;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(subFrames).padStart(2, '0')}`;
  };

  return (
    <footer className="sequencer-timeline" style={{ height: `${timelineHeight}px` }}>
      {/* Top Resizer Handle Bar */}
      <div
        className="timeline-resizer-bar"
        onMouseDown={handleResizeStart}
        title="Drag up or down to adjust timeline panel height"
      >
        <div className="resizer-handle-pill" />
      </div>

      {/* Keyframes Studio Timeline Header Bar */}
      <div className="timeline-header">
        {/* Left: Timecode Readout & Duration Controls */}
        <div className="timeline-header-left" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={15} className="text-teal" />
            <span className="timecode-text">{formatTimecode(currentFrame, fps)}</span>
            <span className="timecode-total">/ {formatTimecode(totalFrames, fps)}</span>
          </div>

          <div className="divider-v" />

          {/* Sequence Duration Control */}
          <div className="duration-control-box" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)' }}>DURATION:</label>
            <input
              type="number"
              step={0.5}
              min={0.5}
              max={40}
              style={{
                width: 44,
                height: 22,
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                borderRadius: 4,
                color: '#fff',
                fontSize: 11,
                fontWeight: 700,
                textAlign: 'center',
              }}
              value={Number((totalFrames / fps).toFixed(1))}
              onFocus={(e) => e.target.select()}
              onChange={(e) => {
                const sec = parseFloat(e.target.value);
                if (!isNaN(sec) && sec > 0) {
                  setTotalFrames(Math.round(sec * fps));
                }
              }}
            />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>s</span>

            {/* Quick Duration Preset Pills */}
            <div style={{ display: 'flex', gap: 3, marginLeft: 2 }}>
              {[1, 2, 3, 5, 10].map((sec) => (
                <button
                  key={sec}
                  className={`duration-preset-pill ${totalFrames === sec * fps ? 'active' : ''}`}
                  onClick={() => setTotalFrames(sec * fps)}
                  title={`Set sequence duration to ${sec}s (${sec * fps} frames)`}
                >
                  {sec}s
                </button>
              ))}
            </div>

            {/* Crop Trailing Empty Frames Button */}
            <button
              className="fit-pill-btn crop-btn"
              onClick={handleCropToContent}
              title="Crop timeline duration to the last keyframe position (removes empty trailing frames)"
              style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 4, padding: '3px 8px' }}
            >
              <Scissors size={12} className="text-teal" />
              <span>Crop Content</span>
            </button>
          </div>
        </div>

        {/* Center: Playback Transport Buttons */}
        <div className="timeline-header-center">
          <button
            className="btn-icon transport-btn"
            onClick={() => setCurrentFrame((f) => Math.max(0, f - 1))}
            title="Step 1 Frame Back"
          >
            <SkipBack size={16} />
          </button>

          <button
            className={`play-main-btn-teal ${isPlaying ? 'playing' : ''}`}
            onClick={() => setIsPlaying(!isPlaying)}
            title={isPlaying ? 'Pause Animation' : 'Play Animation'}
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} className="translate-x-px" />}
          </button>

          <button
            className="btn-icon transport-btn"
            onClick={() => setCurrentFrame((f) => Math.min(totalFrames, f + 1))}
            title="Step 1 Frame Forward"
          >
            <SkipForward size={16} />
          </button>

          <button
            className={`btn-icon transport-btn ${isLooping ? 'active' : ''}`}
            onClick={() => setIsLooping(!isLooping)}
            title="Toggle Loop"
          >
            <Repeat size={15} />
          </button>
        </div>

        {/* Right: Undo/Redo & Zoom Pill Controls */}
        <div className="timeline-header-right">
          <button
            className="btn-icon transport-btn"
            onClick={undo}
            disabled={!canUndo}
            title="Undo"
          >
            <Undo2 size={15} />
          </button>

          <button
            className="btn-icon transport-btn"
            onClick={redo}
            disabled={!canRedo}
            title="Redo"
          >
            <Redo2 size={15} />
          </button>

          <div className="divider-v" />

          <button
            className="btn-icon zoom-btn"
            onClick={() => setTimelineZoom((z) => Math.max(6, z - 3))}
            title="Zoom Out Timeline"
          >
            <ZoomOut size={14} />
          </button>

          <button className="fit-pill-btn" onClick={handleFitTimeline} title="Fit Entire Sequence">
            Fit timeline
          </button>

          <button
            className="btn-icon zoom-btn"
            onClick={() => setTimelineZoom((z) => Math.min(60, z + 3))}
            title="Zoom In Timeline"
          >
            <ZoomIn size={14} />
          </button>
        </div>
      </div>

      <div className="timeline-body" ref={timelineBodyRef}>
        {/* Left Track Outliner Header List */}
        <div className="track-outliner">
          <div className="outliner-ruler-header">
            <span>LAYER HIERARCHY ({tracks.length} LAYERS)</span>
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
                      title={track.visible ? 'Hide' : 'Show'}
                    >
                      {track.visible ? <Eye size={13} /> : <EyeOff size={13} className="text-muted" />}
                    </button>

                    <button
                      className="btn-icon track-icon-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleTrackLock(track.id);
                      }}
                      title={track.locked ? 'Unlock' : 'Lock'}
                    >
                      {track.locked ? <Lock size={13} className="text-gold" /> : <Unlock size={13} />}
                    </button>
                  </div>

                  <div className="track-color-badge" style={{ backgroundColor: track.color }} />

                  <span className="track-label">{track.name}</span>

                  <span className="kf-count-tag" title="Keyframe Count">{kfCount} Keyframes</span>

                  <button
                    className="btn-icon track-add-kf-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      addKeyframeToTrack(track.id, currentFrame);
                    }}
                    title="Add Keyframe at Current Frame"
                  >
                    <Plus size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Scrollable Timeline Grid with Ruler, Interpolation Bars & Keyframe Diamonds */}
        <div className="timeline-grid-container" ref={timelineGridRef}>
          {/* Time Ruler */}
          <div className="time-ruler" onMouseDown={handleRulerMouseDown}>
            {frameNumbers.map((frame) => {
              const isMajor = frame % 5 === 0;
              const isTen = frame % 10 === 0;
              return (
                <div
                  key={frame}
                  className={`ruler-mark ${isTen ? 'ten' : isMajor ? 'major' : 'minor'}`}
                  style={{ left: `${frame * FRAME_WIDTH}px` }}
                >
                  {isMajor && <span className="ruler-label">{frame}</span>}
                </div>
              );
            })}
          </div>

          {/* Draggable Playhead Scrubber Line */}
          <div className="playhead-line" style={{ left: `${currentFrame * FRAME_WIDTH}px` }}>
            <div className="playhead-head">
              <span className="playhead-frame-label">{currentFrame}</span>
            </div>
          </div>

          {/* Keyframe Track Lanes */}
          <div className="track-lanes">
            {tracks.map((track) => {
              const isSelectedPart = selectedPartId === track.partId;
              const sortedKfs = [...track.keyframes].sort((a, b) => a.frame - b.frame);

              return (
                <div
                  key={track.id}
                  className={`track-lane ${isSelectedPart ? 'selected' : ''}`}
                  style={{ width: `${(totalFrames + 3) * FRAME_WIDTH}px` }}
                >
                  {/* Motion Connecting Span Lines between keyframes */}
                  {sortedKfs.map((kf, idx) => {
                    if (idx === sortedKfs.length - 1) return null;
                    const nextKf = sortedKfs[idx + 1];
                    const startX = kf.frame * FRAME_WIDTH;
                    const width = (nextKf.frame - kf.frame) * FRAME_WIDTH;

                    return (
                      <div
                        key={`span-${kf.id}-${nextKf.id}`}
                        className="keyframe-span-bar"
                        style={{
                          left: `${startX}px`,
                          width: `${width}px`,
                          borderColor: track.color,
                        }}
                        title={`Interpolation: ${kf.easing} (${kf.frame} → ${nextKf.frame})`}
                      >
                        <span className="span-easing-tag">{kf.easing}</span>
                      </div>
                    );
                  })}

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
                        onMouseEnter={() => setHoveredKf({ frame: kf.frame, easing: kf.easing, trackName: track.name })}
                        onMouseLeave={() => setHoveredKf(null)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          deleteKeyframe(track.id, kf.id);
                        }}
                        title={`[${track.name}] Frame: ${kf.frame} | Curve: ${kf.easing} (Right-click: Delete)`}
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

        {/* Floating Tooltip info on hover keyframe */}
        {hoveredKf && (
          <div className="kf-hover-tooltip">
            <span className="tooltip-track">{hoveredKf.trackName}</span>
            <span className="tooltip-frame">Frame: {hoveredKf.frame}</span>
            <span className="tooltip-easing">Curve: {hoveredKf.easing}</span>
          </div>
        )}
      </div>
    </footer>
  );
};

