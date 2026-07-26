import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useAnimator } from '../../context/AnimatorContext';
import type { TrackChannel } from '../../types/animator';
import { TRACK_CHANNELS } from '../../types/animator';
import {
  Eye,
  EyeOff,
  Tv,
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
  ChevronRight,
  ChevronDown,
  Diamond,
  TrendingUp,
  GripVertical,
} from 'lucide-react';
import { InteractiveCubicBezierEditor } from '../Inspector/InteractiveCubicBezierEditor';
import './SequencerTimeline.css';

// Visual metadata for each Transform channel
const CHANNEL_META: Record<TrackChannel, { label: string; color: string; shortLabel: string }> = {
  x:        { label: 'Location X',  shortLabel: 'X',  color: '#ef4444' },
  y:        { label: 'Location Y',  shortLabel: 'Y',  color: '#22c55e' },
  rotation: { label: 'Rotation',    shortLabel: 'R°', color: '#3b82f6' },
  scaleX:   { label: 'Scale X',     shortLabel: 'SX', color: '#a855f7' },
  scaleY:   { label: 'Scale Y',     shortLabel: 'SY', color: '#ec4899' },
  opacity:  { label: 'Opacity',     shortLabel: 'Op', color: '#f59e0b' },
};

const TRACK_ROW_HEIGHT = 34;   // parent track row
const CHANNEL_ROW_HEIGHT = 28; // sub-channel row

const LayerIndexInput: React.FC<{
  trackId: string;
  current1BasedIndex: number;
  maxIndex: number;
  setTrackIndex: (trackId: string, val: number) => void;
}> = ({ trackId, current1BasedIndex, maxIndex, setTrackIndex }) => {
  const [editingVal, setEditingVal] = useState<string>(String(current1BasedIndex));

  useEffect(() => {
    setEditingVal(String(current1BasedIndex));
  }, [current1BasedIndex]);

  const commitValue = () => {
    let parsed = parseInt(editingVal, 10);
    if (!isNaN(parsed)) {
      parsed = Math.max(1, Math.min(maxIndex, parsed));
      setTrackIndex(trackId, parsed);
      setEditingVal(String(parsed));
    } else {
      setEditingVal(String(current1BasedIndex));
    }
  };

  return (
    <input
      type="number"
      min={1}
      max={maxIndex}
      value={editingVal}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          commitValue();
          (e.target as HTMLInputElement).blur();
        } else if (e.key === 'Escape') {
          setEditingVal(String(current1BasedIndex));
          (e.target as HTMLInputElement).blur();
        }
      }}
      onChange={(e) => {
        setEditingVal(e.target.value);
        const parsed = parseInt(e.target.value, 10);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= maxIndex) {
          setTrackIndex(trackId, parsed);
        }
      }}
      onBlur={commitValue}
      style={{
        width: 34,
        height: 20,
        background: 'rgba(255, 255, 255, 0.12)',
        border: '1px solid var(--accent-cyan)',
        color: '#fff',
        fontSize: 10,
        fontWeight: 800,
        borderRadius: 4,
        textAlign: 'center',
        outline: 'none',
        cursor: 'pointer',
      }}
      title="Edit layer index number (1 = top layer)"
    />
  );
};

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
    characterParts,
    selectedPartId,
    setSelectedPartId,
    selectedKeyframeId,
    setSelectedKeyframeId,
    addKeyframeToTrack,
    updateKeyframeFrame,
    toggleTrackVisibility,
    toggleTrackEditVisibility,
    renamePartAndTrack,
    reorderTracks,
    setTrackIndex,
    toggleTrackLock,
    toggleTrackExpanded,
    deleteKeyframe,
    timelineZoom,
    setTimelineZoom,
    isLooping,
    setIsLooping,
    undo,
    redo,
    canUndo,
    canRedo,
    addPropertyKeyframe,
    deletePropertyKeyframe,
    updatePropertyKeyframeFrame,
    updateKeyframeBezierPoints,
    getComputedTransform,
  } = useAnimator();

  // Expanded Pro Curve Studio Modal State
  const [isCurveModalOpen, setIsCurveModalOpen] = useState<boolean>(false);

  const timelineGridRef = useRef<HTMLDivElement>(null);
  const timelineBodyRef = useRef<HTMLDivElement>(null);
  const outlinerRef = useRef<HTMLDivElement>(null);

  const [draggingKf, setDraggingKf] = useState<{ trackId: string; keyframeId: string } | null>(null);
  const [draggingPKf, setDraggingPKf] = useState<{ trackId: string; channel: TrackChannel; keyframeId: string } | null>(null);
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const [hoveredKf, setHoveredKf] = useState<{ frame: number; label: string } | null>(null);
  const [draggedTrackIndex, setDraggedTrackIndex] = useState<number | null>(null);
  const [dragOverTrackIndex, setDragOverTrackIndex] = useState<number | null>(null);

  const FRAME_WIDTH = timelineZoom;

  const frameNumbers = Array.from({ length: totalFrames + 1 }, (_, i) => i);


  const getFrameFromMouse = useCallback(
    (clientX: number) => {
      if (!timelineGridRef.current) return 0;
      const rect = timelineGridRef.current.getBoundingClientRect();
      const scrollLeft = timelineGridRef.current.scrollLeft;
      const offsetX = clientX - rect.left + scrollLeft;
      return Math.max(0, Math.min(totalFrames, Math.round(offsetX / FRAME_WIDTH)));
    },
    [totalFrames, FRAME_WIDTH]
  );

  const handleCropToContent = () => {
    let maxFrame = 0;
    tracks.forEach((track) => {
      track.keyframes.forEach((kf) => { if (kf.frame > maxFrame) maxFrame = kf.frame; });
      TRACK_CHANNELS.forEach((ch) => {
        (track.channels?.[ch] ?? []).forEach((pkf) => { if (pkf.frame > maxFrame) maxFrame = pkf.frame; });
      });
    });
    setTotalFrames(maxFrame > 0 ? maxFrame : 30);
  };

  // Wheel zoom handler
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (!timelineGridRef.current) return;
      const grid = timelineGridRef.current;
      const rect = grid.getBoundingClientRect();
      if (e.shiftKey) { e.preventDefault(); grid.scrollLeft += e.deltaY; return; }
      e.preventDefault();
      const mouseXInGrid = e.clientX - rect.left;
      const currentScrollLeft = grid.scrollLeft;
      const frameAtMouse = (mouseXInGrid + currentScrollLeft) / FRAME_WIDTH;
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
      const newZoom = Math.min(60, Math.max(6, Math.round(FRAME_WIDTH * zoomFactor)));
      if (newZoom !== FRAME_WIDTH) {
        setTimelineZoom(newZoom);
        requestAnimationFrame(() => {
          if (timelineGridRef.current)
            timelineGridRef.current.scrollLeft = Math.max(0, frameAtMouse * newZoom - mouseXInGrid);
        });
      }
    },
    [FRAME_WIDTH, setTimelineZoom]
  );

  useEffect(() => {
    const gridEl = timelineGridRef.current;
    if (!gridEl) return;
    gridEl.addEventListener('wheel', handleWheel, { passive: false });
    return () => gridEl.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // Auto scroll playhead into view
  useEffect(() => {
    if (!timelineGridRef.current) return;
    const grid = timelineGridRef.current;
    const currentX = currentFrame * FRAME_WIDTH;
    const visibleStart = grid.scrollLeft;
    const visibleEnd = visibleStart + grid.clientWidth - 40;
    if (currentX < visibleStart) grid.scrollLeft = Math.max(0, currentX - 60);
    else if (currentX > visibleEnd) grid.scrollLeft = currentX - grid.clientWidth + 100;
  }, [currentFrame, FRAME_WIDTH]);

  // Sync vertical scroll between outliner and grid
  const handleGridScroll = useCallback(() => {
    if (outlinerRef.current && timelineGridRef.current) {
      outlinerRef.current.scrollTop = timelineGridRef.current.scrollTop;
    }
  }, []);

  const handleOutlinerScroll = useCallback(() => {
    if (outlinerRef.current && timelineGridRef.current) {
      timelineGridRef.current.scrollTop = outlinerRef.current.scrollTop;
    }
  }, []);

  const handleRulerMouseDown = (e: React.MouseEvent) => {
    setIsScrubbing(true);
    setCurrentFrame(getFrameFromMouse(e.clientX));
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isScrubbing) {
        setCurrentFrame(getFrameFromMouse(e.clientX));
      } else if (draggingKf) {
        updateKeyframeFrame(draggingKf.trackId, draggingKf.keyframeId, getFrameFromMouse(e.clientX));
      } else if (draggingPKf) {
        updatePropertyKeyframeFrame(draggingPKf.trackId, draggingPKf.channel, draggingPKf.keyframeId, getFrameFromMouse(e.clientX));
      }
    },
    [isScrubbing, draggingKf, draggingPKf, getFrameFromMouse, setCurrentFrame, updateKeyframeFrame, updatePropertyKeyframeFrame]
  );

  const handleMouseUp = useCallback(() => {
    setIsScrubbing(false);
    setDraggingKf(null);
    setDraggingPKf(null);
  }, []);

  useEffect(() => {
    if (isScrubbing || draggingKf || draggingPKf) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isScrubbing, draggingKf, draggingPKf, handleMouseMove, handleMouseUp]);

  // Timeline panel height resizing
  const [timelineHeight, setTimelineHeight] = useState<number>(320);
  const [isResizingHeight, setIsResizingHeight] = useState<boolean>(false);
  const resizeStartYRef = useRef<number>(0);
  const initialHeightRef = useRef<number>(320);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingHeight(true);
    resizeStartYRef.current = e.clientY;
    initialHeightRef.current = timelineHeight;
  };
  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizingHeight) return;
    const dy = resizeStartYRef.current - e.clientY;
    setTimelineHeight(Math.max(150, Math.min(700, initialHeightRef.current + dy)));
  }, [isResizingHeight]);
  const handleResizeEnd = useCallback(() => setIsResizingHeight(false), []);
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

  const handleFitTimeline = () => {
    if (!timelineGridRef.current) return;
    const gridWidth = timelineGridRef.current.clientWidth - 40;
    setTimelineZoom(Math.max(6, Math.min(30, Math.floor(gridWidth / totalFrames))));
    if (timelineGridRef.current) timelineGridRef.current.scrollLeft = 0;
  };

  const formatTimecode = (frame: number, currentFps: number) => {
    const totalSeconds = Math.floor(frame / currentFps);
    const subFrames = frame % currentFps;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(subFrames).padStart(2, '0')}`;
  };

  // Add property keyframe at current frame for given channel
  const handleAddChannelKeyframe = (trackId: string, channel: TrackChannel, partId: string) => {
    const transform = getComputedTransform(partId, currentFrame);
    addPropertyKeyframe(trackId, channel, currentFrame, transform[channel]);
  };

  // State for sub-group collapsing (e.g., location, rotation, scale)
  const [subGroupState, setSubGroupState] = useState<Record<string, boolean>>({});

  // Inline Layer Renaming State
  const [editingPartId, setEditingPartId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState<string>('');

  const isGroupExpanded = (key: string, defaultVal: boolean = true) => {
    return subGroupState[key] !== undefined ? subGroupState[key] : defaultVal;
  };

  const toggleSubGroup = (key: string, defaultVal: boolean = true) => {
    setSubGroupState((prev) => ({
      ...prev,
      [key]: !isGroupExpanded(key, defaultVal),
    }));
  };

  return (
    <footer className="sequencer-timeline" style={{ height: `${timelineHeight}px` }}>
      {/* Top Resizer Handle Bar */}
      <div className="timeline-resizer-bar" onMouseDown={handleResizeStart} title="Drag to resize timeline panel">
        <div className="resizer-handle-pill" />
      </div>

      {/* Header Bar */}
      <div className="timeline-header">
        <div className="timeline-header-left" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={15} className="text-teal" />
            <span className="timecode-text">{formatTimecode(currentFrame, fps)}</span>
            <span className="timecode-total">/ {formatTimecode(totalFrames, fps)}</span>
          </div>
          <div className="divider-v" />
          <div className="duration-control-box" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)' }}>DURATION:</label>
            <input
              type="number" step={0.5} min={0.5} max={40}
              style={{ width: 44, height: 22, background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 4, color: '#fff', fontSize: 11, fontWeight: 700, textAlign: 'center' }}
              value={Number((totalFrames / fps).toFixed(1))}
              onFocus={(e) => e.target.select()}
              onChange={(e) => { const sec = parseFloat(e.target.value); if (!isNaN(sec) && sec > 0) setTotalFrames(Math.round(sec * fps)); }}
            />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>s</span>
            <div style={{ display: 'flex', gap: 3, marginLeft: 2 }}>
              {[1, 2, 3, 5, 10].map((sec) => (
                <button key={sec} className={`duration-preset-pill ${totalFrames === sec * fps ? 'active' : ''}`} onClick={() => setTotalFrames(sec * fps)} title={`${sec}s`}>{sec}s</button>
              ))}
            </div>
            <button className="fit-pill-btn crop-btn" onClick={handleCropToContent} style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 4, padding: '3px 8px' }}>
              <Scissors size={12} className="text-teal" /><span>Crop</span>
            </button>
          </div>
        </div>

        <div className="timeline-header-center">
          <button className="btn-icon transport-btn" onClick={() => setCurrentFrame((f) => Math.max(0, f - 1))} title="Step Back"><SkipBack size={16} /></button>
          <button className={`play-main-btn-teal ${isPlaying ? 'playing' : ''}`} onClick={() => setIsPlaying(!isPlaying)} title={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? <Pause size={18} /> : <Play size={18} className="translate-x-px" />}
          </button>
          <button className="btn-icon transport-btn" onClick={() => setCurrentFrame((f) => Math.min(totalFrames, f + 1))} title="Step Forward"><SkipForward size={16} /></button>
          <button className={`btn-icon transport-btn ${isLooping ? 'active' : ''}`} onClick={() => setIsLooping(!isLooping)} title="Toggle Loop"><Repeat size={15} /></button>
        </div>

        <div className="timeline-header-right">
          <button
            type="button"
            className="btn-director active"
            onClick={() => setIsCurveModalOpen(true)}
            style={{
              fontSize: 10,
              fontWeight: 800,
              padding: '3px 9px',
              height: 26,
              background: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              color: 'var(--accent-cyan)',
              borderRadius: 6,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              marginRight: 6,
            }}
            title="Open Expanded Pro Cubic Bezier Motion Curve Studio Modal"
          >
            <TrendingUp size={13} className="text-cyan" />
            <span>Motion Curves</span>
          </button>
          <div className="divider-v" style={{ marginRight: 6 }} />
          <button className="btn-icon transport-btn" onClick={undo} disabled={!canUndo} title="Undo"><Undo2 size={15} /></button>
          <button className="btn-icon transport-btn" onClick={redo} disabled={!canRedo} title="Redo"><Redo2 size={15} /></button>
          <div className="divider-v" />
          <button className="btn-icon zoom-btn" onClick={() => setTimelineZoom((z) => Math.max(6, z - 3))} title="Zoom Out"><ZoomOut size={14} /></button>
          <button className="fit-pill-btn" onClick={handleFitTimeline} title="Fit Sequence">Fit</button>
          <button className="btn-icon zoom-btn" onClick={() => setTimelineZoom((z) => Math.min(60, z + 3))} title="Zoom In"><ZoomIn size={14} /></button>
        </div>
      </div>

      {/* Body: Left Outliner + Right Grid */}
      <div className="timeline-body" ref={timelineBodyRef}>

        {/* ── LEFT OUTLINER ── */}
        <div className="track-outliner ue-outliner">
          {/* Sticky ruler-height spacer to align with grid ruler */}
          <div className="ue-outliner-ruler-spacer">
            <span>LAYERS ({tracks.length})</span>
          </div>

          <div className="ue-outliner-list" ref={outlinerRef} onScroll={handleOutlinerScroll}>
            {tracks.map((track, trackIdx) => {
              const isSelected = selectedPartId === track.partId;
              const isTrackExpanded = track.expanded === true;
              const isTransformExpanded = isGroupExpanded(`${track.id}_transform`, true);
              const isLocationExpanded = isGroupExpanded(`${track.id}_location`, true);
              const isRotationExpanded = isGroupExpanded(`${track.id}_rotation`, false);
              const isScaleExpanded = isGroupExpanded(`${track.id}_scale`, false);

              const partItem = characterParts.find((p) => p.id === track.partId);
              const isChildLayer = Boolean(partItem?.parentId);

              return (
                <div key={track.id} className="ue-track-group">
                  {/* ── LAYER ROW ── */}
                  <div
                    className={`ue-track-row ${isSelected ? 'selected' : ''} ${draggedTrackIndex === trackIdx ? 'dragging' : ''} ${dragOverTrackIndex === trackIdx ? 'drag-over' : ''}`}
                    style={{ height: TRACK_ROW_HEIGHT, paddingLeft: isChildLayer ? 22 : 6 }}
                    onClick={() => setSelectedPartId(track.partId)}
                    draggable={true}
                    onDragStart={(e) => {
                      setDraggedTrackIndex(trackIdx);
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', String(trackIdx));
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (dragOverTrackIndex !== trackIdx) {
                        setDragOverTrackIndex(trackIdx);
                      }
                    }}
                    onDragLeave={() => {
                      if (dragOverTrackIndex === trackIdx) {
                        setDragOverTrackIndex(null);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggedTrackIndex !== null && draggedTrackIndex !== trackIdx) {
                        reorderTracks(draggedTrackIndex, trackIdx);
                      }
                      setDraggedTrackIndex(null);
                      setDragOverTrackIndex(null);
                    }}
                    onDragEnd={() => {
                      setDraggedTrackIndex(null);
                      setDragOverTrackIndex(null);
                    }}
                  >
                    <span title="Drag up or down to reorder layer depth" style={{ display: 'flex', alignItems: 'center' }}>
                      <GripVertical size={13} className="track-drag-grip" />
                    </span>

                    {isChildLayer && (
                      <span style={{ fontSize: 10, color: 'var(--accent-cyan)', fontWeight: 800, marginRight: -2 }}>└─</span>
                    )}

                    <button
                      className="ue-expand-btn"
                      onClick={(e) => { e.stopPropagation(); toggleTrackExpanded(track.id); }}
                      title={isTrackExpanded ? 'Collapse' : 'Expand properties'}
                    >
                      {isTrackExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    </button>

                    <span className="ue-color-dot" style={{ backgroundColor: track.color }} />
                    
                    {/* Double-Click Inline Renaming */}
                    {editingPartId === track.partId ? (
                      <input
                        type="text"
                        autoFocus
                        value={editingNameValue}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setEditingNameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            renamePartAndTrack(track.partId, editingNameValue);
                            setEditingPartId(null);
                          } else if (e.key === 'Escape') {
                            setEditingPartId(null);
                          }
                        }}
                        onBlur={() => {
                          renamePartAndTrack(track.partId, editingNameValue);
                          setEditingPartId(null);
                        }}
                        style={{
                          background: 'var(--bg-input)',
                          border: '1px solid var(--accent-cyan)',
                          color: '#fff',
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '1px 5px',
                          borderRadius: 3,
                          outline: 'none',
                          maxWidth: 130,
                        }}
                      />
                    ) : (
                      <span
                        className="ue-track-name"
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setEditingPartId(track.partId);
                          setEditingNameValue(track.name);
                        }}
                        title="Double-click to rename layer"
                      >
                        {track.name}
                      </span>
                    )}

                    {/* Editable Layer Index Input */}
                    <LayerIndexInput
                      trackId={track.id}
                      current1BasedIndex={trackIdx + 1}
                      maxIndex={tracks.length}
                      setTrackIndex={setTrackIndex}
                    />

                    <div className="ue-track-controls">
                      {/* 1. Edit Canvas Hard-Hide Eye */}
                      <button
                        className={`btn-icon track-icon-btn ${track.editVisible === false ? 'muted' : ''}`}
                        onClick={(e) => { e.stopPropagation(); toggleTrackEditVisibility(track.id); }}
                        title={track.editVisible !== false ? 'Edit Canvas Eye: Visible & Editable on Canvas' : 'Edit Canvas Eye: HARD HIDDEN from Canvas (Completely Non-interactive & Non-clickable)'}
                      >
                        {track.editVisible !== false ? <Eye size={12} className="text-teal" /> : <EyeOff size={12} style={{ color: '#ef4444' }} />}
                      </button>

                      {/* 2. Broadcast Live Mute TV */}
                      <button
                        className={`btn-icon track-icon-btn ${!track.visible ? 'muted' : ''}`}
                        onClick={(e) => { e.stopPropagation(); toggleTrackVisibility(track.id); }}
                        title={track.visible ? 'Broadcast Live Eye: Included in Live Director Reji' : 'Broadcast Live Eye: MUTED from Live Director Reji'}
                      >
                        {track.visible ? <Tv size={12} style={{ color: '#10b981' }} /> : <Tv size={12} style={{ color: '#ef4444', opacity: 0.5 }} />}
                      </button>

                      {/* 3. Lock Button */}
                      <button className="btn-icon track-icon-btn" onClick={(e) => { e.stopPropagation(); toggleTrackLock(track.id); }} title={track.locked ? 'Unlock' : 'Lock Layer'}>
                        {track.locked ? <Lock size={12} className="text-gold" /> : <Unlock size={12} />}
                      </button>

                      {/* 4. Add Keyframe Button */}
                      <button className="btn-icon track-add-kf-btn" onClick={(e) => { e.stopPropagation(); addKeyframeToTrack(track.id, currentFrame); }} title="Add Composite Keyframe">
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>

                  {/* ── TRANSFORM & SUB-GROUPS (when expanded) ── */}
                  {isTrackExpanded && (
                    <div className="ue-channel-group">
                      {/* Transform Category Header */}
                      <div
                        className="ue-transform-header"
                        style={{ height: CHANNEL_ROW_HEIGHT }}
                        onClick={() => toggleSubGroup(`${track.id}_transform`, true)}
                      >
                        <span className="ue-sub-chevron">{isTransformExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}</span>
                        <span className="ue-transform-label">Transform</span>
                      </div>

                      {isTransformExpanded && (
                        <>
                          {/* 1. Location Sub-Group */}
                          <div
                            className="ue-subgroup-header"
                            style={{ height: CHANNEL_ROW_HEIGHT }}
                            onClick={() => toggleSubGroup(`${track.id}_location`, true)}
                          >
                            <span className="ue-sub-chevron">{isLocationExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}</span>
                            <span className="ue-subgroup-label">Location</span>
                          </div>

                          {isLocationExpanded && ['x', 'y'].map((chKey) => {
                            const ch = chKey as TrackChannel;
                            const meta = CHANNEL_META[ch];
                            const chKfs = track.channels?.[ch] ?? [];
                            return (
                              <div key={ch} className="ue-channel-row" style={{ height: CHANNEL_ROW_HEIGHT }}>
                                <span className="ue-channel-indent" />
                                <span className="ue-channel-color-bar" style={{ backgroundColor: meta.color }} />
                                <span className="ue-channel-label" style={{ color: meta.color }}>{meta.label}</span>
                                <span className="ue-kf-count" style={{ color: meta.color }}>{chKfs.length}</span>
                                <button
                                  className="btn-icon track-add-kf-btn"
                                  style={{ color: meta.color }}
                                  onClick={() => handleAddChannelKeyframe(track.id, ch, track.partId)}
                                  title={`Add ${meta.label} keyframe`}
                                >
                                  <Diamond size={11} />
                                </button>
                              </div>
                            );
                          })}

                          {/* 2. Rotation Sub-Group */}
                          <div
                            className="ue-subgroup-header"
                            style={{ height: CHANNEL_ROW_HEIGHT }}
                            onClick={() => toggleSubGroup(`${track.id}_rotation`, false)}
                          >
                            <span className="ue-sub-chevron">{isRotationExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}</span>
                            <span className="ue-subgroup-label">Rotation</span>
                          </div>

                          {isRotationExpanded && ['rotation'].map((chKey) => {
                            const ch = chKey as TrackChannel;
                            const meta = CHANNEL_META[ch];
                            const chKfs = track.channels?.[ch] ?? [];
                            return (
                              <div key={ch} className="ue-channel-row" style={{ height: CHANNEL_ROW_HEIGHT }}>
                                <span className="ue-channel-indent" />
                                <span className="ue-channel-color-bar" style={{ backgroundColor: meta.color }} />
                                <span className="ue-channel-label" style={{ color: meta.color }}>{meta.label}</span>
                                <span className="ue-kf-count" style={{ color: meta.color }}>{chKfs.length}</span>
                                <button
                                  className="btn-icon track-add-kf-btn"
                                  style={{ color: meta.color }}
                                  onClick={() => handleAddChannelKeyframe(track.id, ch, track.partId)}
                                  title={`Add ${meta.label} keyframe`}
                                >
                                  <Diamond size={11} />
                                </button>
                              </div>
                            );
                          })}

                          {/* 3. Scale Sub-Group */}
                          <div
                            className="ue-subgroup-header"
                            style={{ height: CHANNEL_ROW_HEIGHT }}
                            onClick={() => toggleSubGroup(`${track.id}_scale`, false)}
                          >
                            <span className="ue-sub-chevron">{isScaleExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}</span>
                            <span className="ue-subgroup-label">Scale</span>
                          </div>

                          {isScaleExpanded && ['scaleX', 'scaleY'].map((chKey) => {
                            const ch = chKey as TrackChannel;
                            const meta = CHANNEL_META[ch];
                            const chKfs = track.channels?.[ch] ?? [];
                            return (
                              <div key={ch} className="ue-channel-row" style={{ height: CHANNEL_ROW_HEIGHT }}>
                                <span className="ue-channel-indent" />
                                <span className="ue-channel-color-bar" style={{ backgroundColor: meta.color }} />
                                <span className="ue-channel-label" style={{ color: meta.color }}>{meta.label}</span>
                                <span className="ue-kf-count" style={{ color: meta.color }}>{chKfs.length}</span>
                                <button
                                  className="btn-icon track-add-kf-btn"
                                  style={{ color: meta.color }}
                                  onClick={() => handleAddChannelKeyframe(track.id, ch, track.partId)}
                                  title={`Add ${meta.label} keyframe`}
                                >
                                  <Diamond size={11} />
                                </button>
                              </div>
                            );
                          })}

                          {/* 4. Opacity Row */}
                          {['opacity'].map((chKey) => {
                            const ch = chKey as TrackChannel;
                            const meta = CHANNEL_META[ch];
                            const chKfs = track.channels?.[ch] ?? [];
                            return (
                              <div key={ch} className="ue-channel-row" style={{ height: CHANNEL_ROW_HEIGHT }}>
                                <span className="ue-channel-indent-sm" />
                                <span className="ue-channel-color-bar" style={{ backgroundColor: meta.color }} />
                                <span className="ue-channel-label" style={{ color: meta.color }}>{meta.label}</span>
                                <span className="ue-kf-count" style={{ color: meta.color }}>{chKfs.length}</span>
                                <button
                                  className="btn-icon track-add-kf-btn"
                                  style={{ color: meta.color }}
                                  onClick={() => handleAddChannelKeyframe(track.id, ch, track.partId)}
                                  title={`Add ${meta.label} keyframe`}
                                >
                                  <Diamond size={11} />
                                </button>
                              </div>
                            );
                          })}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── RIGHT SCROLLABLE GRID ── */}
        <div className="timeline-grid-container" ref={timelineGridRef} onScroll={handleGridScroll}>
          {/* Time Ruler */}
          <div className="time-ruler" onMouseDown={handleRulerMouseDown}>
            {frameNumbers.map((frame) => {
              const isMajor = frame % 5 === 0;
              const isTen = frame % 10 === 0;
              return (
                <div key={frame} className={`ruler-mark ${isTen ? 'ten' : isMajor ? 'major' : 'minor'}`} style={{ left: `${frame * FRAME_WIDTH}px` }}>
                  {isMajor && <span className="ruler-label">{frame}</span>}
                </div>
              );
            })}
          </div>

          {/* Playhead */}
          <div className="playhead-line" style={{ left: `${currentFrame * FRAME_WIDTH}px` }}>
            <div className="playhead-head">
              <span className="playhead-frame-label">{currentFrame}</span>
            </div>
          </div>

          {/* Track Lanes */}
          <div className="ue-track-lanes">
            {tracks.map((track) => {
              const isSelected = selectedPartId === track.partId;
              const isTrackExpanded = track.expanded === true;
              const isTransformExpanded = isGroupExpanded(`${track.id}_transform`, true);
              const isLocationExpanded = isGroupExpanded(`${track.id}_location`, true);
              const isRotationExpanded = isGroupExpanded(`${track.id}_rotation`, false);
              const isScaleExpanded = isGroupExpanded(`${track.id}_scale`, false);

              const sortedKfs = [...track.keyframes].sort((a, b) => a.frame - b.frame);

              return (
                <div key={track.id} className="ue-lane-group">
                  {/* ── PARENT LANE (composite keyframes) ── */}
                  <div
                    className={`ue-track-lane ${isSelected ? 'selected' : ''}`}
                    style={{ height: TRACK_ROW_HEIGHT, width: `${(totalFrames + 3) * FRAME_WIDTH}px`, backgroundSize: `${FRAME_WIDTH}px 100%`, position: 'relative' }}
                  >
                    {/* Span bars between composite keyframes */}
                    {sortedKfs.map((kf, idx) => {
                      if (idx === sortedKfs.length - 1) return null;
                      const nextKf = sortedKfs[idx + 1];
                      return (
                        <div
                          key={`span-${kf.id}`}
                          className="keyframe-span-bar"
                          style={{ left: `${kf.frame * FRAME_WIDTH}px`, width: `${(nextKf.frame - kf.frame) * FRAME_WIDTH}px`, borderColor: track.color }}
                          title={`${kf.easing} (${kf.frame}→${nextKf.frame})`}
                        >
                          <span className="span-easing-tag">{kf.easing}</span>
                        </div>
                      );
                    })}
                    {/* Composite keyframe diamonds */}
                    {track.keyframes.map((kf) => {
                      const isKfSelected = selectedKeyframeId === kf.id;
                      return (
                        <div
                          key={kf.id}
                          className={`keyframe-diamond ${isKfSelected ? 'selected' : ''}`}
                          style={{ left: `${kf.frame * FRAME_WIDTH}px`, borderColor: track.color }}
                          onClick={(e) => { e.stopPropagation(); setSelectedKeyframeId(kf.id); setSelectedPartId(track.partId); setCurrentFrame(kf.frame); }}
                          onMouseDown={(e) => { e.stopPropagation(); setDraggingKf({ trackId: track.id, keyframeId: kf.id }); setSelectedKeyframeId(kf.id); }}
                          onMouseEnter={() => setHoveredKf({ frame: kf.frame, label: `${track.name} | ${kf.easing}` })}
                          onMouseLeave={() => setHoveredKf(null)}
                          onContextMenu={(e) => { e.preventDefault(); deleteKeyframe(track.id, kf.id); }}
                          title={`[${track.name}] Frame: ${kf.frame} | ${kf.easing} (Right-click: Delete)`}
                        >
                          <div className="diamond-inner" style={{ backgroundColor: track.color }} />
                        </div>
                      );
                    })}
                  </div>

                  {/* ── CHANNEL LANES MATCHING SUB-GROUPS ── */}
                  {isTrackExpanded && (
                    <div className="ue-channel-lanes">
                      {/* Transform Header Lane Spacer */}
                      <div className="ue-channel-header-lane" style={{ height: CHANNEL_ROW_HEIGHT, width: `${(totalFrames + 3) * FRAME_WIDTH}px`, backgroundSize: `${FRAME_WIDTH}px 100%` }} />

                      {isTransformExpanded && (
                        <>
                          {/* Location Header Lane Spacer */}
                          <div className="ue-channel-header-lane" style={{ height: CHANNEL_ROW_HEIGHT, width: `${(totalFrames + 3) * FRAME_WIDTH}px`, backgroundSize: `${FRAME_WIDTH}px 100%` }} />
                          {isLocationExpanded && ['x', 'y'].map((chKey) => {
                            const ch = chKey as TrackChannel;
                            const meta = CHANNEL_META[ch];
                            const chKfs = [...(track.channels?.[ch] ?? [])].sort((a, b) => a.frame - b.frame);
                            return (
                              <div key={ch} className="ue-channel-lane" style={{ height: CHANNEL_ROW_HEIGHT, width: `${(totalFrames + 3) * FRAME_WIDTH}px`, backgroundSize: `${FRAME_WIDTH}px 100%` }}>
                                {/* Horizontal connecting trajectory line for keyframes (Unreal Engine style) */}
                                {chKfs.length > 0 && (
                                  <div
                                    className="ue-trajectory-line"
                                    style={{
                                      left: `${chKfs[0].frame * FRAME_WIDTH}px`,
                                      width: `${(chKfs[chKfs.length - 1].frame - chKfs[0].frame) * FRAME_WIDTH}px`,
                                      backgroundColor: meta.color,
                                    }}
                                  />
                                )}
                                {chKfs.map((pkf) => (
                                  <div
                                    key={pkf.id}
                                    className="ue-prop-diamond"
                                    style={{ left: `${pkf.frame * FRAME_WIDTH}px`, '--diamond-color': meta.color } as React.CSSProperties}
                                    onMouseDown={(e) => { e.stopPropagation(); setDraggingPKf({ trackId: track.id, channel: ch, keyframeId: pkf.id }); setCurrentFrame(pkf.frame); }}
                                    onMouseEnter={() => setHoveredKf({ frame: pkf.frame, label: `${meta.label}: ${pkf.value.toFixed(2)}` })}
                                    onMouseLeave={() => setHoveredKf(null)}
                                    onContextMenu={(e) => { e.preventDefault(); deletePropertyKeyframe(track.id, ch, pkf.id); }}
                                    title={`${meta.label} = ${pkf.value.toFixed(2)} @ F${pkf.frame}`}
                                  />
                                ))}
                              </div>
                            );
                          })}

                          {/* Rotation Header Lane Spacer */}
                          <div className="ue-channel-header-lane" style={{ height: CHANNEL_ROW_HEIGHT, width: `${(totalFrames + 3) * FRAME_WIDTH}px`, backgroundSize: `${FRAME_WIDTH}px 100%` }} />
                          {isRotationExpanded && ['rotation'].map((chKey) => {
                            const ch = chKey as TrackChannel;
                            const meta = CHANNEL_META[ch];
                            const chKfs = [...(track.channels?.[ch] ?? [])].sort((a, b) => a.frame - b.frame);
                            return (
                              <div key={ch} className="ue-channel-lane" style={{ height: CHANNEL_ROW_HEIGHT, width: `${(totalFrames + 3) * FRAME_WIDTH}px`, backgroundSize: `${FRAME_WIDTH}px 100%` }}>
                                {chKfs.length > 0 && (
                                  <div
                                    className="ue-trajectory-line"
                                    style={{
                                      left: `${chKfs[0].frame * FRAME_WIDTH}px`,
                                      width: `${(chKfs[chKfs.length - 1].frame - chKfs[0].frame) * FRAME_WIDTH}px`,
                                      backgroundColor: meta.color,
                                    }}
                                  />
                                )}
                                {chKfs.map((pkf) => (
                                  <div
                                    key={pkf.id}
                                    className="ue-prop-diamond"
                                    style={{ left: `${pkf.frame * FRAME_WIDTH}px`, '--diamond-color': meta.color } as React.CSSProperties}
                                    onMouseDown={(e) => { e.stopPropagation(); setDraggingPKf({ trackId: track.id, channel: ch, keyframeId: pkf.id }); setCurrentFrame(pkf.frame); }}
                                    onMouseEnter={() => setHoveredKf({ frame: pkf.frame, label: `${meta.label}: ${pkf.value.toFixed(2)}` })}
                                    onMouseLeave={() => setHoveredKf(null)}
                                    onContextMenu={(e) => { e.preventDefault(); deletePropertyKeyframe(track.id, ch, pkf.id); }}
                                    title={`${meta.label} = ${pkf.value.toFixed(2)} @ F${pkf.frame}`}
                                  />
                                ))}
                              </div>
                            );
                          })}

                          {/* Scale Header Lane Spacer */}
                          <div className="ue-channel-header-lane" style={{ height: CHANNEL_ROW_HEIGHT, width: `${(totalFrames + 3) * FRAME_WIDTH}px`, backgroundSize: `${FRAME_WIDTH}px 100%` }} />
                          {isScaleExpanded && ['scaleX', 'scaleY'].map((chKey) => {
                            const ch = chKey as TrackChannel;
                            const meta = CHANNEL_META[ch];
                            const chKfs = [...(track.channels?.[ch] ?? [])].sort((a, b) => a.frame - b.frame);
                            return (
                              <div key={ch} className="ue-channel-lane" style={{ height: CHANNEL_ROW_HEIGHT, width: `${(totalFrames + 3) * FRAME_WIDTH}px`, backgroundSize: `${FRAME_WIDTH}px 100%` }}>
                                {chKfs.length > 0 && (
                                  <div
                                    className="ue-trajectory-line"
                                    style={{
                                      left: `${chKfs[0].frame * FRAME_WIDTH}px`,
                                      width: `${(chKfs[chKfs.length - 1].frame - chKfs[0].frame) * FRAME_WIDTH}px`,
                                      backgroundColor: meta.color,
                                    }}
                                  />
                                )}
                                {chKfs.map((pkf) => (
                                  <div
                                    key={pkf.id}
                                    className="ue-prop-diamond"
                                    style={{ left: `${pkf.frame * FRAME_WIDTH}px`, '--diamond-color': meta.color } as React.CSSProperties}
                                    onMouseDown={(e) => { e.stopPropagation(); setDraggingPKf({ trackId: track.id, channel: ch, keyframeId: pkf.id }); setCurrentFrame(pkf.frame); }}
                                    onMouseEnter={() => setHoveredKf({ frame: pkf.frame, label: `${meta.label}: ${pkf.value.toFixed(2)}` })}
                                    onMouseLeave={() => setHoveredKf(null)}
                                    onContextMenu={(e) => { e.preventDefault(); deletePropertyKeyframe(track.id, ch, pkf.id); }}
                                    title={`${meta.label} = ${pkf.value.toFixed(2)} @ F${pkf.frame}`}
                                  />
                                ))}
                              </div>
                            );
                          })}

                          {/* Opacity Channel Lane */}
                          {['opacity'].map((chKey) => {
                            const ch = chKey as TrackChannel;
                            const meta = CHANNEL_META[ch];
                            const chKfs = [...(track.channels?.[ch] ?? [])].sort((a, b) => a.frame - b.frame);
                            return (
                              <div key={ch} className="ue-channel-lane" style={{ height: CHANNEL_ROW_HEIGHT, width: `${(totalFrames + 3) * FRAME_WIDTH}px`, backgroundSize: `${FRAME_WIDTH}px 100%` }}>
                                {chKfs.length > 0 && (
                                  <div
                                    className="ue-trajectory-line"
                                    style={{
                                      left: `${chKfs[0].frame * FRAME_WIDTH}px`,
                                      width: `${(chKfs[chKfs.length - 1].frame - chKfs[0].frame) * FRAME_WIDTH}px`,
                                      backgroundColor: meta.color,
                                    }}
                                  />
                                )}
                                {chKfs.map((pkf) => (
                                  <div
                                    key={pkf.id}
                                    className="ue-prop-diamond"
                                    style={{ left: `${pkf.frame * FRAME_WIDTH}px`, '--diamond-color': meta.color } as React.CSSProperties}
                                    onMouseDown={(e) => { e.stopPropagation(); setDraggingPKf({ trackId: track.id, channel: ch, keyframeId: pkf.id }); setCurrentFrame(pkf.frame); }}
                                    onMouseEnter={() => setHoveredKf({ frame: pkf.frame, label: `${meta.label}: ${pkf.value.toFixed(2)}` })}
                                    onMouseLeave={() => setHoveredKf(null)}
                                    onContextMenu={(e) => { e.preventDefault(); deletePropertyKeyframe(track.id, ch, pkf.id); }}
                                    title={`${meta.label} = ${pkf.value.toFixed(2)} @ F${pkf.frame}`}
                                  />
                                ))}
                              </div>
                            );
                          })}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Floating Keyframe Tooltip */}
      {hoveredKf && (
        <div className="kf-hover-tooltip">
          <span className="tooltip-frame">F{hoveredKf.frame}</span>
          <span className="tooltip-easing">{hoveredKf.label}</span>
        </div>
      )}

      {/* Expanded Pro Cubic Bezier Curve Studio Modal */}
      {isCurveModalOpen && (
        <InteractiveCubicBezierEditor
          controlPoints={(() => {
            const track = tracks.find((t) => t.partId === selectedPartId);
            const kf = track?.keyframes.find((k) => k.frame === currentFrame);
            return kf?.bezierControlPoints || [0.42, 0, 0.58, 1];
          })()}
          onChange={(points) => {
            const track = tracks.find((t) => t.partId === selectedPartId);
            const kf = track?.keyframes.find((k) => k.frame === currentFrame);
            if (track && kf) {
              updateKeyframeBezierPoints(track.id, kf.id, points);
            }
          }}
          initialModalOpen={true}
          onCloseModal={() => setIsCurveModalOpen(false)}
        />
      )}
    </footer>
  );
};
