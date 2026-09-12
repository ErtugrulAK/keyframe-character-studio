// Keyframe Studio - 2D Motion Sequencer Timeline Component
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useAnimator } from '../../context/useAnimator';
import { type PropertyKeyframe, type TrackChannel, type AnimationChannel } from '../../types/animator';
import { computeMaxFrame, hasChannelDataForTemplate, resolveCurveSegment, type CurveSegmentKeyframe } from '../../utils/timelineMetrics';
import { DISPLAY_CHANNELS, TRIM_PATH_CHANNELS, buildTransformSnapshot } from '../../utils/channelKeyframeGroups';
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
import { ConfirmationDialog } from '../Modal/ConfirmationDialog';
import { TimeRuler } from './TimeRuler';
import { TrackLane } from './TrackLane';
import { CHANNEL_META } from './timelineConstants';
import { copyKeyframeGroupData, type KeyframeCopyPayload } from '../../utils/keyframeCopyPaste';
import { TrackOutlinerRow } from './TrackOutlinerRow';
import { InlineRename } from '../Shared/InlineRename';
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
    duplicateKeyframeGroup,
    pasteKeyframeClipboard,
    updateKeyframeBezierPoints,
    updatePropertyKeyframeValue,
    updatePropertyKeyframeTemporalHandles,
    updateMaskPathKeyframeFrame,
    deleteMaskPathKeyframe,
    getComputedTransform,
    motionTemplates,
    activeTemplateId,
    setActiveTemplateId,
    addMotionTemplate,
    renameMotionTemplate,
    deleteMotionTemplate,
    updateMotionTemplateDuration,
  } = useAnimator();
  // Sequencer Tree Modal Toggle State & Inline Sequence Rename
  const [isSeqTreeOpen, setIsSeqTreeOpen] = useState<boolean>(false);
  const [isAddSeqModalOpen, setIsAddSeqModalOpen] = useState<boolean>(false);
  const [editingSeqId, setEditingSeqId] = useState<string | null>(null);
  const [editingSeqName, setEditingSeqName] = useState<string>('');
  const [pendingDeleteSequence, setPendingDeleteSequence] = useState<{ id: string; name: string } | null>(null);
  const seqMenuRef = useRef<HTMLDivElement>(null);
  const selectedTrack = selectedPartId
    ? tracks.find((track) => track.partId === selectedPartId) ?? null
    : null;
  const activeGraphTemplate = activeTemplateId || 'Sequence';
  const hasActiveChannelData = (track: typeof tracks[number]): boolean => (
    Object.values(track.maskChannels ?? {}).some((keyframes) =>
      keyframes.some((keyframe) => (keyframe.templateId || 'Sequence') === activeGraphTemplate),
    )
    || Object.values(track.channels).some((keyframes) =>
      keyframes.some((keyframe) => (keyframe.templateId || 'Sequence') === activeGraphTemplate),
    )
  );
  const graphTrack = selectedTrack && hasActiveChannelData(selectedTrack)
    ? selectedTrack
    : tracks.find(hasActiveChannelData) ?? tracks[0] ?? null;
  const graphChannel = graphTrack
    ? Object.keys(graphTrack.channels).find((channel) =>
      graphTrack.channels[channel as TrackChannel]?.some((keyframe) => (keyframe.templateId || 'Sequence') === activeGraphTemplate),
    )
      ?? Object.keys(graphTrack.maskChannels ?? {}).find((channel) =>
        graphTrack.maskChannels?.[channel as keyof NonNullable<typeof graphTrack.maskChannels>]?.some((keyframe) => (keyframe.templateId || 'Sequence') === activeGraphTemplate),
      )
    : undefined;
  const graphKeyframes = graphChannel
    ? (graphTrack?.channels[graphChannel as TrackChannel] ?? graphTrack?.maskChannels?.[graphChannel as keyof NonNullable<typeof graphTrack.maskChannels>] ?? [])
      .filter((keyframe) => (keyframe.templateId || 'Sequence') === activeGraphTemplate)
    : [];
  const activeSequenceDurationFrames = motionTemplates.find((template) => template.id === activeTemplateId)?.durationFrames ?? totalFrames;

  /**
   * Motion Curves shapes ONE segment: the curve that leads INTO the keyframe
   * under the playhead, from the keyframe before it. The evaluator reads a
   * segment's curve from the keyframe the segment starts at, so the edit lands
   * on the previous keyframe, and a keyframe without a predecessor (the first,
   * or the only one) owns no segment — the modal then explains that instead of
   * silently editing another keyframe.
   */
  const curveKeyframes: CurveSegmentKeyframe[] = graphKeyframes.length > 0
    ? graphKeyframes
    : (graphTrack?.keyframes ?? []).filter((keyframe) => (keyframe.templateId || 'Sequence') === activeGraphTemplate);
  const curveSegment = resolveCurveSegment(curveKeyframes, activeGraphTemplate, selectedKeyframeId, currentFrame);
  const curveSegmentFrames = curveSegment ? { from: curveSegment.from.frame, to: curveSegment.to.frame } : undefined;
  const curveChannelLabel = graphChannel
    ? CHANNEL_META[graphChannel as TrackChannel]?.label ?? `Mask ${String(graphChannel).split(':').slice(1).join(' ')}`
    : undefined;
  const curveInactiveReason = curveSegment
    ? null
    : curveKeyframes.length < 2
      ? 'This property carries a single keyframe, and a curve belongs to the segment between two keyframes. Add a second keyframe, then select the later one to shape the segment that leads into it.'
      : 'Select a keyframe other than the first one. A curve shapes the segment that leads into a keyframe from the one before it, so the first keyframe — and a keyframe with nothing before it — has no curve to edit.';


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

  // M28 — timeline-LOCAL keyframe clipboard (not persisted; not the part
  // clipboard; survives track/part/frame changes until replaced).
  const [kfClipboard, setKfClipboard] = useState<KeyframeCopyPayload | null>(null);
  const handleCopyKeyframes = useCallback(
    (trackId: string, frame: number) => {
      const track = tracks.find((t) => t.id === trackId);
      if (!track) return;
      setKfClipboard(copyKeyframeGroupData(track, frame)); // copy: NO history
    },
    [tracks]
  );
  const handlePasteKeyframes = useCallback(
    (trackId: string, frame: number) => {
      if (!kfClipboard) return;
      pasteKeyframeClipboard(trackId, frame, kfClipboard);
    },
    [kfClipboard, pasteKeyframeClipboard]
  );

  const [draggingKf, setDraggingKf] = useState<{ trackId: string; keyframeId: string } | null>(null);
  const [draggingPKf, setDraggingPKf] = useState<{ trackId: string; channel: AnimationChannel; keyframeId: string } | null>(null);
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
        // BUGFIX: drag a keyframe (or a whole canonical frame group) to a new
        // frame. getFrameFromMouse clamps to [0, totalFrames]. Legacy
        // composite keyframes move individually; canonical (M6 channel)
        // frame-group diamonds move EVERY channel keyframe at their original
        // frame together — the x/y/rotation/scale group never splits.
        const targetFrame = getFrameFromMouse(e.clientX);
        const tr = tracks.find((t) => t.id === draggingKf.trackId);
        if (tr) {
          const legacyKf = (tr.keyframes || []).find((k) => k.id === draggingKf.keyframeId);
          if (legacyKf) {
            updateKeyframeFrame(tr.id, draggingKf.keyframeId, targetFrame);
          } else {
            const activeTmpl = activeTemplateId || 'Sequence';
            const origFrame = Object.values(tr.channels ?? {})
              .flat()
              .find((k) => k.id === draggingKf.keyframeId)?.frame;
            if (origFrame !== undefined) {
              for (const [ch, arr] of Object.entries(tr.channels ?? {})) {
                const kf = (arr as PropertyKeyframe[]).find(
                  (k) => (k.templateId || 'Sequence') === activeTmpl && k.frame === origFrame,
                );
                if (kf) updatePropertyKeyframeFrame(tr.id, ch as TrackChannel, kf.id, targetFrame);
              }
            }
          }
        }
      } else if (draggingPKf) {
        const targetFrame = getFrameFromMouse(e.clientX);
        if (draggingPKf.channel.endsWith(':path')) {
          updateMaskPathKeyframeFrame(
            draggingPKf.trackId,
            draggingPKf.channel as `${string}:path`,
            draggingPKf.keyframeId,
            targetFrame,
          );
        } else {
          updatePropertyKeyframeFrame(draggingPKf.trackId, draggingPKf.channel, draggingPKf.keyframeId, targetFrame);
        }
      }
    },
    [isScrubbing, draggingKf, draggingPKf, getFrameFromMouse, setCurrentFrame, updateKeyframeFrame, updatePropertyKeyframeFrame, updateMaskPathKeyframeFrame, tracks, activeTemplateId]
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
  const handleAddChannelKeyframe = (trackId: string, channel: AnimationChannel, partId: string) => {
    const transform = getComputedTransform(partId, currentFrame);
    const part = characterParts.find((candidate) => candidate.id === partId);
    const maskValue = (() => {
      if (!channel.includes(':')) return undefined;
      const separator = channel.lastIndexOf(':');
      const maskId = channel.slice(0, separator);
      const property = channel.slice(separator + 1) as 'opacity' | 'feather' | 'expansion';
      const mask = part?.masks?.find((candidate) => candidate.id === maskId);
      return mask?.[property];
    })();
    const val = maskValue !== undefined
      ? maskValue
      : channel === 'trimPathStart'
        ? (part?.trimPathStart ?? 0)
        : channel === 'trimPathEnd'
          ? (part?.trimPathEnd ?? 1)
          : channel === 'trimPathOffset'
            ? (part?.trimPathOffset ?? 0)
            : (transform as unknown as Record<string, number>)[channel] ?? (channel === 'maskScale' ? 1 : 0);
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
    const part = characterParts.find((candidate) => candidate.id === track.partId);
    const trimValues = {
      trimPathStart: part?.trimPathStart ?? 0,
      trimPathEnd: part?.trimPathEnd ?? 1,
      trimPathOffset: part?.trimPathOffset ?? 0,
    };
    for (const ch of TRIM_PATH_CHANNELS) {
      addPropertyKeyframe(trackId, ch, frame, trimValues[ch], 'easeInOut');
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
                  <InlineRename
                    value={editingSeqName}
                    ariaLabel={`Rename sequence ${tmpl.name}`}
                    className="timeline-seq-tab-inline-input"
                    onCommit={(next) => {
                      renameMotionTemplate(tmpl.id, next);
                      setEditingSeqId(null);
                    }}
                    onCancel={() => setEditingSeqId(null)}
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
                  <button
                    type="button"
                    className="timeline-seq-tab-close"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPendingDeleteSequence({ id: tmpl.id, name: tmpl.name });
                    }}
                    title="Delete sequence"
                    aria-label={`Delete sequence ${tmpl.name}`}
                  >
                    ×
                  </button>
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

      <ConfirmationDialog
        isOpen={pendingDeleteSequence !== null}
        title="Delete sequence?"
        description={pendingDeleteSequence ? `Deleting “${pendingDeleteSequence.name}” also removes its authored animation channels.` : ''}
        onCancel={() => setPendingDeleteSequence(null)}
        onConfirm={() => {
          if (pendingDeleteSequence) deleteMotionTemplate(pendingDeleteSequence.id);
          setPendingDeleteSequence(null);
        }}
      />

      {/* Header Bar */}
      <div className="timeline-header">
        <div className="timeline-header-left timeline-header-band timeline-header-band-timing">
          <div className="timeline-timing-group">
            <Clock size={15} className="timeline-clock-icon" aria-hidden="true" />
            <span className="timecode-text">{formatTimecode(currentFrame, fps)}</span>
            <span className="timecode-total">/ {formatTimecode(totalFrames, fps)}</span>
          </div>
          <div className="divider-v" />
          <div className="duration-control-box">
            <label className="duration-label" htmlFor="sequence-duration-input">DURATION</label>
            <span className="duration-input-group">
              <input
                id="sequence-duration-input"
                className="duration-input"
                type="number"
                step={0.5}
                min={0.5}
                max={40}
                value={Number((activeSequenceDurationFrames / fps).toFixed(1))}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const sec = parseFloat(e.target.value);
                  if (!isNaN(sec) && sec > 0) {
                    const durationFrames = Math.round(sec * fps);
                    updateMotionTemplateDuration(activeTemplateId, durationFrames);
                    setTotalFrames(durationFrames);
                  }
                }}
              />
              <span className="duration-unit" aria-hidden="true">s</span>
            </span>
            <div className="duration-preset-group" role="group" aria-label="Sequence duration presets">
              {[1, 2, 3, 5, 10].map((sec) => (
                <button key={sec} className={`duration-preset-pill ${activeSequenceDurationFrames === sec * fps ? 'active' : ''}`} onClick={() => {
                  const durationFrames = sec * fps;
                  updateMotionTemplateDuration(activeTemplateId, durationFrames);
                  setTotalFrames(durationFrames);
                }} title={`Set the sequence to ${sec} seconds`} aria-pressed={activeSequenceDurationFrames === sec * fps}>{sec}s</button>
              ))}
            </div>
            <button className="fit-pill-btn crop-btn" onClick={handleCropToContent} title="Crop the sequence to the last keyframe">
              <Scissors size={12} aria-hidden="true" /><span>Crop</span>
            </button>
          </div>
        </div>

        <div className="timeline-header-center timeline-transport-band">
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

        <div className="timeline-header-right timeline-actions-band">
          <button
            type="button"
            className="btn-director active motion-curves-btn"
            onClick={() => setIsCurveModalOpen(true)}
            title="Open Expanded Pro Cubic Bezier Motion Curve Studio Modal"
          >
            <TrendingUp size={13} aria-hidden="true" />
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
      <div className="timeline-body timeline-body-v3" ref={timelineBodyRef}>

        {/* ── LEFT OUTLINER ── */}
        <div className="track-outliner ue-outliner timeline-layer-pane">
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
                  onEnterCommit={(partId, name) => { if (name.trim()) renamePartAndTrack(partId, name.trim()); setEditingPartId(null); }}
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
        <div className="timeline-grid-container timeline-graph-pane" ref={timelineGridRef} onScroll={handleGridScroll}>
          {/* Time Ruler */}
          <TimeRuler
            frameNumbers={frameNumbers}
            frameWidth={FRAME_WIDTH}
            totalFrames={totalFrames}
            onMouseDown={handleRulerMouseDown}
          />

          {/* Playhead */}
          <div className="playhead-line" data-frame={currentFrame} style={{ left: `${currentFrame * FRAME_WIDTH}px` }}>
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
                onUpdateMaskPathKeyframeFrame={updateMaskPathKeyframeFrame}
                onDeleteMaskPathKeyframe={deleteMaskPathKeyframe}
                onDuplicateKeyframeGroup={duplicateKeyframeGroup}
                kfClipboard={kfClipboard}
                onCopyKeyframes={handleCopyKeyframes}
                onPasteKeyframes={handlePasteKeyframes}
                onFrameFromClientX={getFrameFromMouse}
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
          controlPoints={curveSegment?.from.bezierControlPoints ?? [0.42, 0, 0.58, 1]}
          segmentFrames={curveSegmentFrames}
          segmentChannelLabel={curveChannelLabel}
          inactiveReason={curveInactiveReason}
          onChange={(points) => {
            if (!curveSegment || !graphTrack) return;
            // The segment's curve lives on the keyframe it starts at; the
            // mutator is dual, so this covers legacy and channel keyframes.
            updateKeyframeBezierPoints(graphTrack.id, curveSegment.from.id, points);
          }}
          valueKeyframes={graphKeyframes.filter((keyframe) => (keyframe.templateId || 'Sequence') === (activeTemplateId || 'Sequence'))}
          onChangeKeyframeValue={(keyframeId, value) => {
            if (graphTrack && graphChannel) updatePropertyKeyframeValue(graphTrack.id, graphChannel as AnimationChannel, keyframeId, value);
          }}
          onChangeKeyframeHandles={(keyframeId, patch) => {
            if (graphTrack && graphChannel) updatePropertyKeyframeTemporalHandles(graphTrack.id, graphChannel as AnimationChannel, keyframeId, patch);
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

