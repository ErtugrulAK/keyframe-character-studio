// Keyframe Studio - 2D Motion Sequencer Timeline Component
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useAnimator } from '../../context/AnimatorContext';
import type { TrackChannel } from '../../types/animator';
import { TRACK_CHANNELS } from '../../types/animator';
import { computeMaxFrame, findChannelKeyframeAtFrame, hasChannelDataForTemplate } from '../../utils/timelineMetrics';
import { DISPLAY_CHANNELS, buildTransformSnapshot } from '../../utils/channelKeyframeGroups';
import {
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
  TrendingUp,
} from 'lucide-react';
import { InteractiveCubicBezierEditor } from '../Inspector/InteractiveCubicBezierEditor';
import { NewItemModal } from '../Modal/NewItemModal';
import { TimeRuler } from './TimeRuler';
import { TrackLane } from './TrackLane';
import { TrackOutlinerRow } from './TrackOutlinerRow';
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
    characterParts,
    selectedPartId,
    selectedPartIds,
    handleSelectPart,
    selectedKeyframeId,
    setSelectedKeyframeId,
    addKeyframeToTrack,
    updateKeyframeFrame,
    toggleTrackVisibility,
    toggleTrackEditVisibility,
    renamePartAndTrack,
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
    motionTemplates,
    activeTemplateId,
    setActiveTemplateId,
    addMotionTemplate,
    renameMotionTemplate,
    deleteMotionTemplate,
  } = useAnimator();

  // Sequencer Tree Modal Toggle State & Inline Sequence Rename
  const [isSeqTreeOpen, setIsSeqTreeOpen] = useState<boolean>(false);
  const [isAddSeqModalOpen, setIsAddSeqModalOpen] = useState<boolean>(false);
  const [editingSeqId, setEditingSeqId] = useState<string | null>(null);
  const [editingSeqName, setEditingSeqName] = useState<string>('');
  const seqMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (seqMenuRef.current && !seqMenuRef.current.contains(e.target as Node) && !editingSeqId) {
        setIsSeqTreeOpen(false);
      }
    };
    if (isSeqTreeOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSeqTreeOpen, editingSeqId]);

  // Expanded Pro Curve Studio Modal State
  const [isCurveModalOpen, setIsCurveModalOpen] = useState<boolean>(false);

  const timelineGridRef = useRef<HTMLDivElement>(null);
  const timelineBodyRef = useRef<HTMLDivElement>(null);
  const outlinerRef = useRef<HTMLDivElement>(null);

  const [draggingKf, setDraggingKf] = useState<{ trackId: string; keyframeId: string } | null>(null);
  const [draggingPKf, setDraggingPKf] = useState<{ trackId: string; channel: TrackChannel; keyframeId: string } | null>(null);
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const [hoveredKf, setHoveredKf] = useState<{ frame: number; label: string } | null>(null);

  const FRAME_WIDTH = timelineZoom;

  const frameNumbers = Array.from({ length: totalFrames + 31 }, (_, i) => i);


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
    // M5: timeline length accounts for BOTH legacy keyframes and canonical
    // channel keyframes (max across all templates — same behavior as before,
    // now via the pure, tested computeMaxFrame helper).
    const maxFrame = computeMaxFrame(tracks);
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
    const val = transform[channel] ?? (channel === 'maskScale' ? 1 : 0);
    addPropertyKeyframe(trackId, channel, currentFrame, val);
  };

  // M7: Outliner "Add Composite Keyframe" → canonical 6-channel snapshot at
  // the current frame (same behavior as KeyframesTab handleAdd).
  // Legacy-only tracks (imported old projects, no channel data) keep the
  // legacy composite keyframe path.
  const handleAddKeyframeSnapshot = (trackId: string, frame: number) => {
    const track = tracks.find((t) => t.id === trackId);
    if (!track) return;
    const activeTmpl = activeTemplateId || 'Sequence';
    if (!hasChannelDataForTemplate(track, activeTmpl)) {
      addKeyframeToTrack(trackId, frame);
      return;
    }
    const t = getComputedTransform(track.partId, frame);
    const snapshot = buildTransformSnapshot(t);
    for (const ch of DISPLAY_CHANNELS) {
      addPropertyKeyframe(trackId, ch, frame, snapshot[ch], 'easeInOut');
    }
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

      {/* Motion Design Sequence Horizontal Browser-Style Tabs Bar */}
      <div className="timeline-template-tabs-bar">
        <div className="timeline-sequence-tabs-container">
          {motionTemplates.map((tmpl) => {
            const isActive = tmpl.id === activeTemplateId;
            const isEditing = editingSeqId === tmpl.id;

            return (
              <div
                key={tmpl.id}
                className={`timeline-seq-tab ${isActive ? 'active' : ''}`}
                onClick={() => setActiveTemplateId(tmpl.id)}
                title={`Sequence: ${tmpl.name}`}
              >
                {isEditing ? (
                  <input className="input-control"
                type="text"
                    value={editingSeqName}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setEditingSeqName(e.target.value)}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Enter') {
                        if (editingSeqName.trim()) renameMotionTemplate(tmpl.id, editingSeqName.trim());
                        setEditingSeqId(null);
                      } else if (e.key === 'Escape') {
                        setEditingSeqId(null);
                      }
                    }}
                    onBlur={() => {
                      if (editingSeqName.trim()) renameMotionTemplate(tmpl.id, editingSeqName.trim());
                      setEditingSeqId(null);
                    }}
                    style={{
                      background: '#090b10',
                      border: '1px solid #38bdf8',
                      color: '#fff',
                      borderRadius: 4,
                      padding: '1px 6px',
                      fontSize: 12,
                      fontWeight: 700,
                      outline: 'none',
                      width: 90,
                    }}
                  />
                ) : (
                  <span
                    className="timeline-seq-tab-name"
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditingSeqId(tmpl.id);
                      setEditingSeqName(tmpl.name);
                    }}
                    title="Double-click to rename sequence"
                  >
                    {tmpl.name}
                  </span>
                )}

                {motionTemplates.length > 1 && (
                  <span
                    className="timeline-seq-tab-close"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteMotionTemplate(tmpl.id);
                    }}
                    title="Delete sequence"
                  >
                    ✕
                  </span>
                )}
              </div>
            );
          })}

          <button
            className="timeline-seq-tab-add"
            onClick={() => setIsAddSeqModalOpen(true)}
            title="Create New Sequence"
          >
            <Plus size={13} />
          </button>
        </div>
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
            <label className="form-label" style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)' }}>DURATION:</label>
            <input className="input-control"
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
          <button
            className={`play-main-btn-teal ${isPlaying ? 'playing' : ''}`}
            onClick={() => {
              if (!isPlaying && currentFrame >= totalFrames) {
                setCurrentFrame(0);
              }
              setIsPlaying(!isPlaying);
            }}
            title={isPlaying ? 'Pause' : 'Play'}
          >
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
            {tracks.map((track) => {
              const partItem = characterParts.find((p) => p.id === track.partId);
              const isChildLayer = Boolean(partItem?.parentId);

              return (
                <TrackOutlinerRow
                  key={track.id}
                  track={track}
                  parts={characterParts}
                  isChildLayer={isChildLayer}
                  isSelected={selectedPartIds?.includes(track.partId)}
                  editingPartId={editingPartId}
                  editingNameValue={editingNameValue}
                  currentFrame={currentFrame}
                  activeTemplateId={activeTemplateId}
                  onSelect={handleSelectPart}
                  onStartEdit={(partId, name) => { setEditingPartId(partId); setEditingNameValue(name); }}
                  onChangeEditValue={setEditingNameValue}
                  onEnterCommit={(partId, name) => { if (name.trim()) renamePartAndTrack(partId, name.trim()); setEditingPartId(null); }}
                  onBlurCommit={(partId, name) => { renamePartAndTrack(partId, name); setEditingPartId(null); }}
                  onCancelEdit={() => setEditingPartId(null)}
                  onToggleExpand={toggleTrackExpanded}
                  onToggleEditVisible={toggleTrackEditVisibility}
                  onToggleVisible={toggleTrackVisibility}
                  onToggleLock={toggleTrackLock}
                  onAddKeyframe={handleAddKeyframeSnapshot}
                  onAddChannelKeyframe={handleAddChannelKeyframe}
                  isGroupExpanded={isGroupExpanded}
                  onToggleSubGroup={toggleSubGroup}
                />
              );
            })}
          </div>
        </div>

        {/* ── RIGHT SCROLLABLE GRID ── */}
        <div className="timeline-grid-container" ref={timelineGridRef} onScroll={handleGridScroll}>
          {/* Time Ruler */}
          <TimeRuler
            frameNumbers={frameNumbers}
            frameWidth={FRAME_WIDTH}
            totalFrames={totalFrames}
            onMouseDown={handleRulerMouseDown}
          />

          {/* Playhead */}
          <div className="playhead-line" style={{ left: `${currentFrame * FRAME_WIDTH}px` }}>
            <div className="playhead-head">
              <span className="playhead-frame-label">{currentFrame}</span>
            </div>
          </div>

          {/* Track Lanes */}
          <div className="ue-track-lanes">
            {tracks.map((track) => (
              <TrackLane
                key={track.id}
                track={track}
                isSelected={selectedPartId === track.partId}
                selectedKeyframeId={selectedKeyframeId}
                frameWidth={FRAME_WIDTH}
                totalFrames={totalFrames}
                activeTemplateId={activeTemplateId}
                isGroupExpanded={isGroupExpanded}
                onSelectKeyframe={setSelectedKeyframeId}
                onSelectPart={handleSelectPart}
                onSetFrame={setCurrentFrame}
                onStartDragKf={setDraggingKf}
                onStartDragPKf={setDraggingPKf}
                onHoverKf={setHoveredKf}
                onDeleteKeyframe={deleteKeyframe}
                onDeletePropertyKeyframe={deletePropertyKeyframe}
              />
            ))}
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
            const activeTmpl = activeTemplateId || 'Sequence';
            const track = tracks.find((t) => t.partId === selectedPartId) || tracks[0];
            if (!track) return [0.42, 0, 0.58, 1];

            const tmplKfs = (track.keyframes || []).filter((k) => (k.templateId || 'Sequence') === activeTmpl);
            const exactKf = tmplKfs.find((k) => k.frame === currentFrame);
            if (exactKf?.bezierControlPoints) return exactKf.bezierControlPoints;

            const pastKfs = tmplKfs.filter((k) => k.frame <= currentFrame).sort((a, b) => b.frame - a.frame);
            if (pastKfs.length > 0 && pastKfs[0].bezierControlPoints) return pastKfs[0].bezierControlPoints;
            if (tmplKfs.length > 0 && tmplKfs[0].bezierControlPoints) return tmplKfs[0].bezierControlPoints;

            if (track.channels) {
              for (const ch of TRACK_CHANNELS) {
                const chKfs = (track.channels[ch] || []).filter((k) => (k.templateId || 'Sequence') === activeTmpl);
                const matchCh = chKfs.find((k) => k.frame === currentFrame) || chKfs[0];
                if (matchCh?.bezierControlPoints) return matchCh.bezierControlPoints;
              }
            }

            return [0.42, 0, 0.58, 1];
          })()}
          onChange={(points) => {
            const activeTmpl = activeTemplateId || 'Sequence';
            const track = tracks.find((t) => t.partId === selectedPartId) || tracks[0];
            if (!track) return;

            const tmplKfs = (track.keyframes || []).filter((k) => (k.templateId || 'Sequence') === activeTmpl);
            let targetKf = tmplKfs.find((k) => k.frame === currentFrame);

            if (!targetKf && tmplKfs.length > 0) {
              const pastKfs = tmplKfs.filter((k) => k.frame <= currentFrame).sort((a, b) => b.frame - a.frame);
              targetKf = pastKfs[0] || tmplKfs[0];
            }

            if (!targetKf) {
              // M5: canonical fallback — channel-only tracks have no legacy
              // keyframes; resolve the channel keyframe at this frame so bezier
              // edits land on channels (updateKeyframeBezierPointsMutator is
              // dual — it updates both keyframes[] and channels[] by id).
              targetKf = findChannelKeyframeAtFrame(track, activeTmpl, currentFrame) as any;
            }

            if (targetKf) {
              updateKeyframeBezierPoints(track.id, targetKf.id, points);
            } else if (!hasChannelDataForTemplate(track, activeTmpl)) {
              // Legacy-only track with no keyframe: keep the old snapshot behavior.
              addKeyframeToTrack(track.id, currentFrame);
            }
            // Channel track with no keyframe at this frame: nothing to attach
            // bezier to — do not pollute channels with a legacy snapshot.
          }}
          initialModalOpen={true}
          onCloseModal={() => setIsCurveModalOpen(false)}
        />
      )}

      {/* New Sequence Modal */}
      <NewItemModal
        isOpen={isAddSeqModalOpen}
        title="Create New Sequence"
        subtitle="Add a new animation sequence to the active template."
        placeholder="Sequence name (e.g. In_V1, Out_V1)..."
        defaultValue="New Sequence"
        confirmLabel="Create Sequence"
        onClose={() => setIsAddSeqModalOpen(false)}
        onSubmit={(val) => addMotionTemplate(val)}
      />
    </footer>
  );
};

