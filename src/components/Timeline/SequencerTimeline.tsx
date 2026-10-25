// Keyframe Studio - 2D Motion Sequencer Timeline Component
import React, { useRef, useState, useEffect, useCallback, useLayoutEffect, useMemo } from 'react';
import { useAnimator } from '../../context/useAnimator';
import { commitWorkspaceLayout, createFrameEase, prefersReducedMotion, REFIT_UNTOUCHED_CAMERA_COMMAND, WORKSPACE_LAYOUT_COMMAND_EVENT, type FrameEase } from '../../utils/workspaceLayout';
import { type TrackChannel, type AnimationChannel } from '../../types/animator';
import { computeMaxFrame, resolveChannelAnimationState, resolveCurveSegment, resolveCurveTarget, type CurveSegmentKeyframe } from '../../utils/timelineMetrics';
import { resolveAuthoredLocalTransform, resolveAuthoredBasePose } from '../../utils/channelKeyframeGroups';
import { locateKeyframe } from '../../utils/trackMutations';
import { duplicateKeyframeGroup as previewKeyframeDuplicate } from '../../utils/keyframeDuplicate';
import {
  Plus,
  ZoomIn,
  ZoomOut,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronsLeft,
  Repeat,
  Undo2,
  Redo2,
  Clock,
  Scissors,
  TrendingUp,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { InteractiveCubicBezierEditor } from '../Inspector/InteractiveCubicBezierEditor';
import { NewItemModal } from '../Modal/NewItemModal';
import { ConfirmationDialog } from '../Modal/ConfirmationDialog';
import { TimeRuler } from './TimeRuler';
import { TrackLane, type KeyframePress } from './TrackLane';
import { CHANNEL_META, clampPanelSize, TRACK_ROW_HEIGHT, KEYFRAME_DRAG_THRESHOLD_PX, OUTLINER_DEFAULT_WIDTH, OUTLINER_MAX_WIDTH, OUTLINER_MIN_WIDTH, resolveTimelineHeightCeiling, TIMELINE_COLLAPSED_HEIGHT, TIMELINE_DEFAULT_HEIGHT, TIMELINE_EDGE_TRANSITION_MS, TIMELINE_MIN_HEIGHT, resolveOpeningTimelineHeight, shouldOpenTimelineCollapsed } from './timelineConstants';
import { copyKeyframeGroupData, type KeyframeCopyPayload } from '../../utils/keyframeCopyPaste';
import { TrackOutlinerRow } from './TrackOutlinerRow';
import { projectLayerOrdinals } from '../../utils/layerOrdinal';
import { frameToSeconds, secondsToFrame } from '../../utils/timebase';
import { InlineRename } from '../Shared/InlineRename';
import { useRowWindow, type RowViewport } from '../../hooks/useRowWindow';
import { useRetainedScrollTop, useRetainedUiState } from '../../hooks/useRetainedUiState';
import { rowOffsets, type RowWindowSegment } from '../../utils/rowWindow';
import { edgeScrollStep, laneContextOf, laneGroupHeight, laneKeyframePositions, laneKeyframes, type LaneContext } from './timelineLaneLayout';
import './SequencerTimeline.css';

/**
 * Anything that already owns a pointer gesture may not begin a marquee: a
 * keyframe drag, the ruler (scrub), the panel dividers (resize), scrollbars
 * (which are not part of the scroll surface at all — the press would land on the
 * container outside its client box), and every form control or menu trigger.
 */
const MARQUEE_BLOCKERS = '.keyframe-diamond, .ue-prop-diamond, .time-ruler, .playhead-line, .timeline-resizer-bar, .timeline-column-resizer, input, textarea, select, button, [role="separator"]';

/** A press that travels less than this is a click, not a selection drag. */
const MARQUEE_DRAG_THRESHOLD_PX = 3;

/** How close to the playhead line a press still counts as "on the playhead". */
const PLAYHEAD_POINTER_TOLERANCE_PX = 4;

/** Edge auto-scroll cadence of a marquee held at the edge of the lanes. */
const MARQUEE_AUTOSCROLL_INTERVAL_MS = 30;

/** A keyframe press that has been armed but has not travelled far enough yet. */
interface KeyframePressArm {
  ids: string[];
  /** The frame the gesture started at: the pointer delta is measured from it. */
  anchorFrame: number;
  /** True when the grabbed diamond is the layer row's frame-group diamond. */
  expandFrameGroups: boolean;
  /** The pointer that armed the press; -1 when the event carried no identity. */
  pointerId: number;
  originClientX: number;
  /** The element the press landed on: it keeps the pointer captured while dragging. */
  captureTarget: Element | null;
  /** K2: the pressed diamond's owner track (the duplicate lands there). */
  trackId: string;
  /** Alt at press time arms the duplicate gesture once travel crosses the threshold. */
  altKey: boolean;
}

/** The keyframe drag in flight. */
interface KeyframeDrag {
  ids: string[];
  anchorFrame: number;
  /** The frame the set currently sits at (advances by what actually moved). */
  appliedFrame: number;
  expandFrameGroups: boolean;
  /** The pointer that owns the drag; -1 when the event carried no identity. */
  pointerId: number;
  /** K2: 'duplicate' copies the source group to `appliedFrame`; source unmoved. */
  mode: 'move' | 'duplicate';
  /** The track the copy lands on (duplicate) — the pressed diamond's owner. */
  trackId: string;
}


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
    selectedKeyframeIds,
    selectKeyframes,
    addKeyframeToTrack,
    deleteKeyframeFrameGroup,
    moveSelectedKeyframes,
    startBatchInteraction,
    endBatchInteraction,
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
    armChannel,
    disableChannelAnimation,
    deletePropertyKeyframe,
    duplicateKeyframeGroup,
    duplicateKeyframeGroupAt,
    showToast,
    pasteKeyframeClipboard,
    updateKeyframeBezierPoints,
    updatePropertyKeyframeValue,
    updatePropertyKeyframeTemporalHandles,
    applyTemporalHandlesToSegment,
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
  // WP-05: the derived display ordinal, the same projection the Outliner shows.
  const layerOrdinals = useMemo(() => projectLayerOrdinals(characterParts), [characterParts]);
  // Sequencer Tree Modal Toggle State & Inline Sequence Rename
  const [isSeqTreeOpen, setIsSeqTreeOpen] = useState<boolean>(false);
  const [isAddSeqModalOpen, setIsAddSeqModalOpen] = useState<boolean>(false);
  const [editingSeqId, setEditingSeqId] = useState<string | null>(null);
  const [editingSeqName, setEditingSeqName] = useState<string>('');
  const [pendingDeleteSequence, setPendingDeleteSequence] = useState<{ id: string; name: string } | null>(null);
  const [pendingStopAnim, setPendingStopAnim] = useState<{ trackId: string; channel: AnimationChannel; label: string; partName: string; keyCount: number } | null>(null);
  const seqMenuRef = useRef<HTMLDivElement>(null);
  const selectedTrack = selectedPartId
    ? tracks.find((track) => track.partId === selectedPartId) ?? null
    : null;
  const activeGraphTemplate = activeTemplateId || 'Sequence';
  // The Motion Curves modal edits the SELECTED layer only. `resolveCurveTarget`
  // resolves the exact channel (or legacy keyframe list) inside that one track;
  // the modal never falls back to another layer, because a fallback would write
  // the curve into a layer the user did not select.
  const curveTarget = resolveCurveTarget(selectedTrack, activeGraphTemplate, selectedKeyframeId);
  const graphChannel = curveTarget?.channel ?? undefined;
  const graphKeyframes = curveTarget?.keyframes ?? [];
  const activeSequenceDurationFrames = motionTemplates.find((template) => template.id === activeTemplateId)?.durationFrames ?? totalFrames;

  /**
   * Motion Curves shapes ONE segment: the curve that leads INTO the keyframe
   * under the playhead, from the keyframe before it. The evaluator reads a
   * segment's curve from the keyframe the segment starts at, so the edit lands
   * on the previous keyframe, and a keyframe without a predecessor (the first,
   * or the only one) owns no segment — the modal then explains that instead of
   * silently editing another keyframe.
   */
  const curveKeyframes: CurveSegmentKeyframe[] = graphKeyframes;
  const curveSegment = resolveCurveSegment(curveKeyframes, activeGraphTemplate, selectedKeyframeId, currentFrame);
  const curveSegmentFrames = curveSegment ? { from: curveSegment.from.frame, to: curveSegment.to.frame } : undefined;
  const curveChannelLabel = graphChannel
    ? CHANNEL_META[graphChannel as TrackChannel]?.label ?? `Mask ${String(graphChannel).split(':').slice(1).join(' ')}`
    : undefined;
  const curveInactiveReason = curveSegment
    ? null
    : curveTarget === null
      ? 'The selected layer carries no keyframes for the active sequence, so there is no segment to shape. Select a keyframed layer or add a second keyframe to this property.'
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

  /**
   * The timeline's ONE pointer gesture (R3-04 / R4-03). The moving set is
   * captured once at press time from the one selection store, and every pointer
   * move moves exactly that set by the pointer's frame delta — a marquee or Shift
   * selection therefore moves as one set, one gesture is one history entry, and
   * consecutive moves of one drag can never be applied twice.
   *
   * The gesture lives in REFS, not in render state: nothing here is painted, and
   * a pointer arrives before React can commit. A listener registration gated on a
   * state flag would therefore miss the very events that begin and end the
   * gesture — including the release, which used to leave the drag attached to the
   * pointer. The window listeners are registered once for the component's
   * lifetime and read the live record, so a release can never be missed.
   */
  const keyframeDragRef = useRef<KeyframeDrag | null>(null);
  const pendingKeyframePressRef = useRef<KeyframePressArm | null>(null);
  const scrubPointerRef = useRef<number | null>(null);
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

  /**
   * A keyframe press ARMS the timeline gesture: the moving set is resolved now
   * (the whole selection when the press lands on a keyframe the user already
   * selected — that is what makes a marquee/Shift selection movable as a set, and
   * just that keyframe otherwise), and the transaction and the drag begin once
   * the pointer crosses the drag threshold. The pressed element keeps the pointer
   * captured for the whole gesture, so the release is delivered to it wherever
   * the pointer goes — including outside the window.
   *
   * `expandFrameGroups` carries the unit that was grabbed: the layer row's
   * diamond stands for its whole frame group, a channel diamond for its own key.
   */
  const beginKeyframePress = (press: KeyframePress, expandFrameGroups: boolean) => {
    const templateId = activeTemplateId || 'Sequence';
    let anchorFrame: number | null = null;
    for (const track of tracks) {
      const located = locateKeyframe(track, press.keyframeId, templateId);
      if (located) {
        anchorFrame = located.frame;
        break;
      }
    }
    if (anchorFrame === null) return;
    pendingKeyframePressRef.current = {
      ids: press.additive || selectedKeyframeIds.includes(press.keyframeId)
        ? selectedKeyframeIds
        : [press.keyframeId],
      anchorFrame,
      expandFrameGroups,
      // A pointer event that carries no identity (a synthetic or fallback event)
      // owns the gesture unconditionally; -1 is that "no identity" sentinel.
      pointerId: Number.isFinite(press.pointerId) ? press.pointerId : -1,
      originClientX: press.clientX,
      captureTarget: press.captureTarget,
      trackId: press.trackId,
      altKey: press.altKey,
    };
  };

  /**
   * Timeline marquee (box) selection.
   *
   * The rectangle is a transient gesture, not a selection store. C5: it
   * hit-tests the lane LAYOUT (`timelineLaneLayout`), the data the lanes are
   * rendered from, not the diamonds that happen to be mounted — a long list
   * mounts only the rows near its viewport, and a marquee dragged (with edge
   * auto-scroll) over rows that were scrolled away must still cover their keys.
   * Only keys the user could see are selectable (a collapsed channel group
   * contributes none); a diamond's centre IS its frame position. The outcome
   * lands in the one keyframe-selection authority, `selectKeyframes`.
   *
   * Everything is measured in the grid's CONTENT space, so the drawn rectangle
   * and the hit test can never disagree: a key is selected exactly when its
   * centre falls inside the rectangle that is on screen, at any scroll offset.
   */
  const [marqueeRect, setMarqueeRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [isMarqueeActive, setIsMarqueeActive] = useState<boolean>(false);
  const marqueeGestureRef = useRef<{
    originX: number;
    originY: number;
    preGestureIds: string[];
    additive: boolean;
    candidates: Array<{ id: string; x: number; y: number }>;
    moved: boolean;
    /** The pointer's last client position (edge auto-scroll re-applies it). */
    pointer: { x: number; y: number };
  } | null>(null);

  const handleMarqueeStart = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const grid = timelineGridRef.current;
    if (!grid) return;
    const target = event.target as HTMLElement;
    if (target.closest(MARQUEE_BLOCKERS)) return;

    const box = grid.getBoundingClientRect();
    // A press on the native scrollbar belongs to the scrollbar: the client box
    // already excludes it, so the point lands outside the surface.
    if (event.clientX - box.left >= grid.clientWidth || event.clientY - box.top >= grid.clientHeight) return;

    const originX = event.clientX - box.left + grid.scrollLeft;
    const originY = event.clientY - box.top + grid.scrollTop;
    // The playhead line is pointer-transparent chrome, so it can only be
    // excluded geometrically: its column is the playhead's, not the marquee's.
    if (Math.abs(originX - currentFrame * FRAME_WIDTH) <= PLAYHEAD_POINTER_TOLERANCE_PX) return;

    // The lanes block is always mounted (its window spacers stand in for the
    // rows that are not), so its position is the origin of every track's top.
    const lanes = grid.querySelector<HTMLElement>('.ue-track-lanes');
    const lanesBox = lanes?.getBoundingClientRect();
    const lanesOrigin = lanesBox
      ? { x: lanesBox.left - box.left + grid.scrollLeft, y: lanesBox.top - box.top + grid.scrollTop }
      : { x: 0, y: 0 };
    const candidates = laneKeyframePositions(
      tracks,
      rowOffsets(tracks.length, trackHeightAt),
      lanesOrigin,
      FRAME_WIDTH,
      (track) => laneKeyframes(track, basePoseByPart.get(track.partId), activeTemplateId, isGroupExpanded, laneContextByPart.get(track.partId)),
    );

    marqueeGestureRef.current = {
      originX,
      originY,
      preGestureIds: selectedKeyframeIds,
      additive: event.shiftKey || event.ctrlKey || event.metaKey,
      candidates,
      moved: false,
      pointer: { x: event.clientX, y: event.clientY },
    };
    setMarqueeRect({ left: originX, top: originY, width: 0, height: 0 });
    setIsMarqueeActive(true);
    // The marquee is a selection gesture, never a text selection.
    event.preventDefault();
  };

  const updateMarquee = useCallback((clientX: number, clientY: number) => {
    const gesture = marqueeGestureRef.current;
    const grid = timelineGridRef.current;
    if (!gesture || !grid) return;
    gesture.pointer = { x: clientX, y: clientY };
    // Content space at the CURRENT scroll offset: the box keeps its origin in
    // content space while edge auto-scroll moves the view under the pointer.
    const box = grid.getBoundingClientRect();
    const currentX = clientX - box.left + grid.scrollLeft;
    const currentY = clientY - box.top + grid.scrollTop;
    const left = Math.min(gesture.originX, currentX);
    const top = Math.min(gesture.originY, currentY);
    const width = Math.abs(currentX - gesture.originX);
    const height = Math.abs(currentY - gesture.originY);
    if (Math.max(width, height) > MARQUEE_DRAG_THRESHOLD_PX) gesture.moved = true;
    setMarqueeRect({ left, top, width, height });

    const hits = gesture.candidates
      .filter((candidate) => (
        candidate.x >= left && candidate.x <= left + width
        && candidate.y >= top && candidate.y <= top + height
      ))
      .map((candidate) => candidate.id);
    selectKeyframes(gesture.additive ? [...gesture.preGestureIds, ...hits] : hits, 'replace');
  }, [selectKeyframes]);

  const endMarquee = useCallback((restore: boolean) => {
    const gesture = marqueeGestureRef.current;
    marqueeGestureRef.current = null;
    setIsMarqueeActive(false);
    setMarqueeRect(null);
    if (!gesture) return;
    if (restore) {
      selectKeyframes(gesture.preGestureIds, 'replace');
      return;
    }
    // A press on empty space without a drag clears the keyframe selection; with
    // the multi-select modifier held there was nothing to add, so it stands.
    if (!gesture.moved && !gesture.additive) selectKeyframes([], 'replace');
  }, [selectKeyframes]);

  useEffect(() => {
    if (!isMarqueeActive) return;
    const handleMove = (event: MouseEvent) => updateMarquee(event.clientX, event.clientY);
    const handleUp = () => endMarquee(false);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      endMarquee(true);
    };
    // C5 — edge auto-scroll: while the pointer rests at (or beyond) an edge of
    // the lane viewport, the grid scrolls on a gesture-scoped timer (a UI
    // gesture helper, not a playback clock) and the box grows with it.
    const autoScroll = window.setInterval(() => {
      const gesture = marqueeGestureRef.current;
      const grid = timelineGridRef.current;
      if (!gesture || !grid) return;
      const box = grid.getBoundingClientRect();
      const ruler = grid.querySelector<HTMLElement>('.time-ruler')?.offsetHeight ?? 0;
      const dy = edgeScrollStep(gesture.pointer.y, box.top + ruler, box.top + grid.clientHeight);
      const dx = edgeScrollStep(gesture.pointer.x, box.left, box.left + grid.clientWidth);
      if (!dx && !dy) return;
      const before = { left: grid.scrollLeft, top: grid.scrollTop };
      grid.scrollTop += dy;
      grid.scrollLeft += dx;
      if (grid.scrollTop !== before.top || grid.scrollLeft !== before.left) updateMarquee(gesture.pointer.x, gesture.pointer.y);
    }, MARQUEE_AUTOSCROLL_INTERVAL_MS);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearInterval(autoScroll);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMarqueeActive, updateMarquee, endMarquee]);

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

  /**
   * A press on the ruler starts the scrub. The ruler captures the pointer, so
   * the playhead keeps following it even when the pointer leaves the window, and
   * the gesture ends on the release (or on a cancelled capture) rather than on
   * the next click.
   */
  const handleRulerPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    scrubPointerRef.current = Number.isFinite(e.pointerId) ? e.pointerId : -1;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setCurrentFrame(getFrameFromMouse(e.clientX));
  };

  // Keyboard seek uses the same bounds as the pointer scrub: rounded frame,
  // clamped to [0, totalFrames].
  const handleRulerKeySeek = useCallback(
    (frame: number) => setCurrentFrame(Math.max(0, Math.min(totalFrames, Math.round(frame)))),
    [totalFrames, setCurrentFrame]
  );

  // K2 — duplicate-mode drop frame: RAW, no clamp. Clamping would turn a
  // drop past the timeline edge into a legal-looking frame; D1 demands a
  // refusal with one warning instead of a silent relocation.
  const getDuplicateDropFrame = useCallback(
    (clientX: number): number => {
      if (!timelineGridRef.current) return 0;
      const rect = timelineGridRef.current.getBoundingClientRect();
      const scrollLeft = timelineGridRef.current.scrollLeft;
      return Math.round((clientX - rect.left + scrollLeft) / FRAME_WIDTH);
    },
    [FRAME_WIDTH]
  );

  const setDuplicatePreview = useCallback((state: 'valid' | 'blocked' | null) => {
    const grid = timelineGridRef.current;
    if (!grid) return;
    if (state) grid.setAttribute('data-duplicate-target', state);
    else grid.removeAttribute('data-duplicate-target');
  }, []);

  const canDropDuplicate = useCallback(
    (trackId: string, sourceFrame: number, targetFrame: number): boolean => {
      if (targetFrame < 0 || targetFrame > totalFrames || targetFrame === sourceFrame) return false;
      const track = tracks.find((t) => t.id === trackId);
      if (!track) return false;
      return previewKeyframeDuplicate(track, sourceFrame, targetFrame - sourceFrame, totalFrames).duplicated;
    },
    [tracks, totalFrames]
  );

  /**
   * The pointer was released, cancelled, or its capture was lost: the gesture is
   * over AT ONCE. Moving the pointer afterwards must change nothing, and the
   * whole gesture stays one history entry (idempotent: the global mouseup also
   * ends a batch, and a second end has nothing left to commit).
   */
  const endTimelineGesture = useCallback(() => {
    const drag = keyframeDragRef.current;
    if (drag?.mode === 'duplicate') {
      setDuplicatePreview(null);
      // Re-validate against the CURRENT document (the same authority the
      // right-click duplicate uses), land the copy as ONE entry, and on
      // refusal emit the single D1 warning. A neutral drop says nothing.
      const target = drag.appliedFrame;
      if (target !== drag.anchorFrame) {
        if (!duplicateKeyframeGroupAt(drag.trackId, drag.anchorFrame, target)) {
          showToast(
            target < 0 || target > totalFrames
              ? 'Duplicate blocked: outside the timeline range'
              : 'Duplicate blocked: that frame already has keyframes',
            'error',
          );
        }
      }
    }
    keyframeDragRef.current = null;
    pendingKeyframePressRef.current = null;
    scrubPointerRef.current = null;
    endBatchInteraction();
  }, [setDuplicatePreview, duplicateKeyframeGroupAt, showToast, totalFrames, endBatchInteraction]);

  /**
   * The pointer moved. Three stages share this one handler: the scrub, the
   * keyframe drag in flight, and the press that is still only a click.
   *
   * A move that arrives with no button held proves the release was never
   * delivered (the pointer left the window, or the browser handed the gesture to
   * a native drag): the gesture ends where it stands instead of following a
   * pointer that was already lifted.
   */
  const handleGestureMove = useCallback((e: PointerEvent) => {
    const scrubPointer = scrubPointerRef.current;
    if (scrubPointer !== null) {
      // A second pointer is a different interaction: it may not scrub the frame.
      if (scrubPointer >= 0 && e.pointerId !== undefined && e.pointerId !== scrubPointer) return;
      if (e.buttons === 0) {
        endTimelineGesture();
        return;
      }
      setCurrentFrame(getFrameFromMouse(e.clientX));
      return;
    }

    const drag = keyframeDragRef.current;
    if (drag) {
      if (drag.mode === 'duplicate') {
        // A duplicate drag mutates nothing in flight: it only moves the
        // previewed drop target. The commit (or refusal) happens on release.
        const target = getDuplicateDropFrame(e.clientX);
        setDuplicatePreview(canDropDuplicate(drag.trackId, drag.anchorFrame, target) ? 'valid' : 'blocked');
        keyframeDragRef.current = { ...drag, appliedFrame: target };
        return;
      }
      // A second pointer is a different interaction: it may not move these keys.
      if (drag.pointerId >= 0 && e.pointerId !== undefined && e.pointerId !== drag.pointerId) return;
      if (e.buttons === 0) {
        endTimelineGesture();
        return;
      }
      // R3-04: ONE drag gesture moves the WHOLE captured set by the pointer's
      // frame delta. `getFrameFromMouse` clamps to [0, totalFrames], the
      // mutator clamps again and stops at the first frame it would overwrite,
      // and `appliedFrame` advances by what actually moved — so a clamped drag
      // stays pointer-exact instead of drifting.
      const step = getFrameFromMouse(e.clientX) - drag.appliedFrame;
      if (step === 0) return;
      const applied = moveSelectedKeyframes(drag.ids, step, drag.expandFrameGroups);
      if (applied !== 0) {
        keyframeDragRef.current = { ...drag, appliedFrame: drag.appliedFrame + applied };
      }
      return;
    }

    const press = pendingKeyframePressRef.current;
    if (!press) return;
    // A second pointer is a different interaction: it may not start this drag.
    if (press.pointerId >= 0 && e.pointerId !== undefined && e.pointerId !== press.pointerId) return;
    if (e.buttons === 0) {
      pendingKeyframePressRef.current = null;
      return;
    }
    // Below the threshold the press is still a click: no move, no transaction.
    if (Math.abs(e.clientX - press.originClientX) <= KEYFRAME_DRAG_THRESHOLD_PX) return;
    pendingKeyframePressRef.current = null;
    // The gesture is real now: it owns the pointer from here on, and its whole
    // travel commits as ONE history entry.
    startBatchInteraction();
    if (press.pointerId >= 0) press.captureTarget?.setPointerCapture?.(press.pointerId);
    if (press.altKey) {
      // K2: the travel arms a duplicate, never a move — the source stays.
      const target = getDuplicateDropFrame(e.clientX);
      setDuplicatePreview(canDropDuplicate(press.trackId, press.anchorFrame, target) ? 'valid' : 'blocked');
      keyframeDragRef.current = {
        ids: press.ids,
        anchorFrame: press.anchorFrame,
        appliedFrame: target,
        expandFrameGroups: false,
        pointerId: press.pointerId,
        mode: 'duplicate',
        trackId: press.trackId,
      };
      return;
    }
    const applied = moveSelectedKeyframes(
      press.ids,
      getFrameFromMouse(e.clientX) - press.anchorFrame,
      press.expandFrameGroups,
    );
    keyframeDragRef.current = {
      ids: press.ids,
      anchorFrame: press.anchorFrame,
      appliedFrame: press.anchorFrame + applied,
      expandFrameGroups: press.expandFrameGroups,
      pointerId: press.pointerId,
      mode: 'move',
      trackId: press.trackId,
    };
  }, [endTimelineGesture, getFrameFromMouse, getDuplicateDropFrame, canDropDuplicate, moveSelectedKeyframes, setCurrentFrame, setDuplicatePreview, startBatchInteraction]);

  const gestureMoveRef = useRef(handleGestureMove);
  const gestureEndRef = useRef(endTimelineGesture);
  // Latest-value mirrors: the window listeners are registered once, so they must
  // call the current handlers without re-registering on every render.
  // oxlint-disable-next-line react/refs
  gestureMoveRef.current = handleGestureMove;
  // oxlint-disable-next-line react/refs
  gestureEndRef.current = endTimelineGesture;

  useEffect(() => {
    const handleMove = (event: PointerEvent) => gestureMoveRef.current(event);
    const handleEnd = () => gestureEndRef.current();
    // Registered for the component's lifetime, and never gated on a state flag:
    // the release that ends a gesture is the one event that must not be missed.
    // `lostpointercapture` ends it safely when the browser takes the capture back.
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleEnd);
    window.addEventListener('pointercancel', handleEnd);
    window.addEventListener('lostpointercapture', handleEnd);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleEnd);
      window.removeEventListener('pointercancel', handleEnd);
      window.removeEventListener('lostpointercapture', handleEnd);
    };
  }, []);

  // K2/D1: Escape aborts an in-flight duplicate BEFORE any commit — no copy,
  // no toast, preview cleared. A plain move drag is deliberately untouched
  // (its semantics predate K2); neutralizing `appliedFrame` makes the
  // release path take the silent neutral-drop branch.
  useEffect(() => {
    const cancelDuplicateOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const drag = keyframeDragRef.current;
      if (drag?.mode !== 'duplicate') return;
      keyframeDragRef.current = { ...drag, appliedFrame: drag.anchorFrame };
      gestureEndRef.current();
    };
    window.addEventListener('keydown', cancelDuplicateOnEscape);
    return () => window.removeEventListener('keydown', cancelDuplicateOnEscape);
  }, []);

  /**
   * Timeline workspace sizing — ONE source of truth.
   *
   * `timelineHeight` is the authored (expanded) height: collapsing never
   * overwrites it, so expanding restores exactly the height the user left. The
   * outliner column width is its sibling. Both are in-memory UI state like every
   * other panel size in this editor, which keeps no layout persistence
   * authority of its own.
   *
   * R5-03: `edgeHeight` is where the panel's edge actually IS right now — the
   * authored height while expanded, the eased value while collapsing or
   * expanding, the collapsed strip while collapsed. Every write of the authored
   * height writes it too, so it can never disagree with what a drag or a window
   * clamp asked for.
   */
  // C4 — session UI memory: the opening policy (`resolveOpeningTimelineHeight`,
  // `shouldOpenTimelineCollapsed`) applies to the session's first mount only;
  // after that the user's height, collapse and column width win, also across
  // an Edit ⇄ Broadcast round trip (the panel unmounts in Broadcast).
  const [timelineHeight, setTimelineHeight] = useRetainedUiState<number>('timeline.height', () => resolveOpeningTimelineHeight(window.innerHeight));
  const [isTimelineCollapsed, setIsTimelineCollapsed] = useRetainedUiState<boolean>('timeline.collapsed', () => shouldOpenTimelineCollapsed(window.innerHeight));
  const [edgeHeight, setEdgeHeight] = useState<number>(() => (isTimelineCollapsed ? TIMELINE_COLLAPSED_HEIGHT : timelineHeight));
  const [outlinerWidth, setOutlinerWidth] = useRetainedUiState<number>('timeline.outlinerWidth', OUTLINER_DEFAULT_WIDTH);
  const [resizeAxis, setResizeAxis] = useState<'rows' | 'columns' | null>(null);
  const timelineRef = useRef<HTMLElement>(null);
  const edgeHeightRef = useRef(edgeHeight);
  // oxlint-disable-next-line react/refs
  edgeHeightRef.current = edgeHeight;
  const collapsedRef = useRef(isTimelineCollapsed);
  // oxlint-disable-next-line react/refs
  collapsedRef.current = isTimelineCollapsed;
  const resizeStartRef = useRef<{ x: number; y: number; height: number; width: number }>({
    x: 0,
    y: 0,
    height: TIMELINE_DEFAULT_HEIGHT,
    width: OUTLINER_DEFAULT_WIDTH,
  });
  const resizeFrameRef = useRef<number | null>(null);
  const pendingResizeRef = useRef<{ height?: number; width?: number }>({});

  /**
   * The tallest the panel may be right now: the authored bound, capped by the
   * room the window actually has, so the stage keeps `MIN_STAGE_HEIGHT`. The
   * measurement is live because a flex item that stops fitting is silently
   * shrunk — a height the layout cannot honour makes the drag feel dead, because
   * the panel stops growing while the pointer keeps travelling.
   */
  const timelineHeightCeiling = useCallback(() => {
    const stage = document.querySelector('.stage-canvas-container');
    return resolveTimelineHeightCeiling(window.innerHeight, stage?.getBoundingClientRect().top ?? 0);
  }, []);

  const timelineHeightRef = useRef(timelineHeight);
  // oxlint-disable-next-line react/refs
  timelineHeightRef.current = timelineHeight;

  // A window that got shorter re-clamps the authored height, so the panel never
  // sits at a size the layout silently refuses. Collapsed, only the authored
  // height moves: the strip stays the strip and expanding honours the new bound.
  useEffect(() => {
    const handleWindowResize = (): boolean => {
      const ceiling = timelineHeightCeiling();
      if (timelineHeightRef.current <= ceiling) return false;
      const collapsed = collapsedRef.current;
      commitWorkspaceLayout(() => {
        setTimelineHeight(ceiling);
        if (!collapsed) setEdgeHeight(ceiling);
      });
      return true;
    };
    window.addEventListener('resize', handleWindowResize);
    // C2 — the same clamp also applies to the window the editor OPENS in (a
    // short or 200 %-zoomed window), not only to later resizes; otherwise the
    // default height could leave the stage with almost no room. Deferred one
    // microtask so the synchronous layout commit does not run inside the effect.
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled || !handleWindowResize()) return;
      // The opening camera was fitted to the box BEFORE this correction.
      window.dispatchEvent(new CustomEvent(WORKSPACE_LAYOUT_COMMAND_EVENT, { detail: { type: REFIT_UNTOUCHED_CAMERA_COMMAND } }));
    });
    return () => {
      cancelled = true;
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [setTimelineHeight, timelineHeightCeiling]);

  /**
   * Applies at most one workspace size per frame: the pointer can move several
   * times between two frames, and the commit has to land inside an animation
   * frame (before that frame's layout and paint) for the stage to be corrected
   * before anything is drawn.
   */
  const flushPendingResize = useCallback(() => {
    if (resizeFrameRef.current !== null) {
      cancelAnimationFrame(resizeFrameRef.current);
      resizeFrameRef.current = null;
    }
    const pending = pendingResizeRef.current;
    if (pending.height === undefined && pending.width === undefined) return;
    pendingResizeRef.current = {};
    commitWorkspaceLayout(() => {
      if (pending.height !== undefined) {
        setTimelineHeight(pending.height);
        setEdgeHeight(pending.height);
      }
      if (pending.width !== undefined) setOutlinerWidth(pending.width);
    });
  }, [setOutlinerWidth, setTimelineHeight]);

  const beginResize = (axis: 'rows' | 'columns') => (e: React.MouseEvent) => {
    if (e.button !== 0 || isTimelineCollapsed) return;
    e.preventDefault();
    resizeStartRef.current = { x: e.clientX, y: e.clientY, height: timelineHeight, width: outlinerWidth };
    pendingResizeRef.current = {};
    setResizeAxis(axis);
  };

  /**
   * R5-03 — collapse and expand EASE the panel's edge, and the camera is
   * corrected in the SAME task as every frame's height write.
   *
   * The ease itself is the shared workspace authority's (`createFrameEase`), and
   * every frame commits through `commitWorkspaceLayout`: the size and the
   * stage's re-measure land in one task, inside the frame's callback, before
   * anything is painted. Nothing about the camera projection is animated — only
   * chrome geometry is. The curve is monotone (ease-in-out cubic), so the edge never
   * overshoots and never counter-moves, and the last frame writes the exact
   * target height.
   */
  const edgeEaseRef = useRef<FrameEase | null>(null);
  const writeEdgeHeight = useCallback((height: number) => {
    commitWorkspaceLayout(() => setEdgeHeight(height));
  }, []);

  const animateTimelineEdge = useCallback((to: number) => {
    const ease = edgeEaseRef.current ?? (edgeEaseRef.current = createFrameEase(writeEdgeHeight, writeEdgeHeight));
    // C8 — reduced motion moves the edge in one step, like the side docks.
    if (prefersReducedMotion()) {
      ease.cancel();
      writeEdgeHeight(to);
      return;
    }
    ease.start(edgeHeightRef.current, to, TIMELINE_EDGE_TRANSITION_MS);
  }, [writeEdgeHeight]);

  useEffect(() => () => {
    edgeEaseRef.current?.cancel();
  }, []);

  const toggleTimelineCollapsed = () => {
    const collapsing = !isTimelineCollapsed;
    // Collapsing changes the stage box too, so it commits through the same
    // authority as a drag: the world must not jolt for one frame.
    commitWorkspaceLayout(() => setIsTimelineCollapsed(collapsing));
    animateTimelineEdge(collapsing ? TIMELINE_COLLAPSED_HEIGHT : timelineHeight);
  };

  useEffect(() => {
    if (!resizeAxis) return;
    const handleResizeMove = (e: MouseEvent) => {
      const start = resizeStartRef.current;
      if (resizeAxis === 'rows') {
        pendingResizeRef.current.height = clampPanelSize(
          start.height + (start.y - e.clientY),
          TIMELINE_MIN_HEIGHT,
          timelineHeightCeiling(),
        );
      } else {
        pendingResizeRef.current.width = clampPanelSize(
          start.width + (e.clientX - start.x),
          OUTLINER_MIN_WIDTH,
          OUTLINER_MAX_WIDTH,
        );
      }
      if (resizeFrameRef.current === null) {
        resizeFrameRef.current = requestAnimationFrame(() => {
          resizeFrameRef.current = null;
          flushPendingResize();
        });
      }
    };
    const handleResizeEnd = () => {
      // Never lose the last pointer sample: the frame that has not run yet is
      // applied synchronously before the gesture closes.
      flushPendingResize();
      setResizeAxis(null);
    };
    window.addEventListener('mousemove', handleResizeMove);
    window.addEventListener('mouseup', handleResizeEnd);
    const resizeClass = resizeAxis === 'rows' ? 'kcs-resizing-rows' : 'kcs-resizing-columns';
    document.body.classList.add(resizeClass);
    return () => {
      window.removeEventListener('mousemove', handleResizeMove);
      window.removeEventListener('mouseup', handleResizeEnd);
      document.body.classList.remove(resizeClass);
      if (resizeFrameRef.current !== null) {
        cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = null;
      }
    };
  }, [resizeAxis, flushPendingResize, timelineHeightCeiling]);

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

  /**
   * K1 (D2) — the stopwatch press. Reading the state decides the flow:
   * unanimated arms directly; animated asks first, and only the confirmed
   * dialog mutates (cancel leaves even the state object identity untouched).
   */
  const handleToggleChannelAnimation = (trackId: string, channel: AnimationChannel) => {
    const track = tracks.find((candidate) => candidate.id === trackId);
    if (!track) return;
    const scope = activeTemplateId || 'Sequence';
    const state = resolveChannelAnimationState(track, channel, currentFrame, scope);
    if (state === 'off') {
      armChannel(trackId, channel);
      return;
    }
    // K3 — the count and the label come from the channel's OWN store and the
    // mask's OWN name, the same reads the row and the lane paint from.
    const store = (channel.includes(':')
      ? (channel.endsWith(':path') ? track.maskPathChannels : track.maskChannels)
      : track.channels) as Record<string, { templateId?: string }[]> | undefined;
    const keyCount = (store?.[channel] ?? []).filter((k) => (k.templateId || 'Sequence') === scope).length;
    const partName = characterParts.find((candidate) => candidate.id === track.partId)?.name ?? track.name;
    const label = channel.includes(':')
      ? (() => {
          const separator = channel.lastIndexOf(':');
          const maskId = channel.slice(0, separator);
          const mask = characterParts.find((candidate) => candidate.id === track.partId)?.masks?.find((m) => m.id === maskId);
          return `${mask?.name ?? maskId} ${channel.slice(separator + 1)}`;
        })()
      : CHANNEL_META[channel as TrackChannel].label;
    setPendingStopAnim({ trackId, channel, label, partName, keyCount });
  };

  // Add property keyframe at current frame for given channel
  const handleAddChannelKeyframe = (trackId: string, channel: AnimationChannel, partId: string) => {
    const transform = resolveAuthoredLocalTransform(partId, currentFrame, { parts: characterParts, worldOf: getComputedTransform });
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

  // State for sub-group collapsing (e.g., location, rotation, scale)
  const [subGroupState, setSubGroupState] = useState<Record<string, boolean>>({});

  // Inline Layer Renaming State
  const [editingPartId, setEditingPartId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState<string>('');

  // Changes identity only with the sub-group state, so the memoized rows
  // re-render exactly when a disclosure they show changes.
  const isGroupExpanded = useCallback((key: string, defaultVal: boolean = true) => {
    return subGroupState[key] !== undefined ? subGroupState[key] : defaultVal;
  }, [subGroupState]);

  const toggleSubGroup = (key: string, defaultVal: boolean = true) => {
    setSubGroupState((prev) => ({
      ...prev,
      [key]: !(prev[key] !== undefined ? prev[key] : defaultVal),
    }));
  };

  /**
   * C3 — the timeline rows and lanes are memoized: a playhead frame re-renders
   * neither a lane nor a collapsed layer row (measured as the largest per-frame
   * cost of playback and scrub on a heavy scene). Their actions are ONE stable
   * bag that reads the latest handlers at call time, so a row that skipped a
   * render never acts on a stale closure. The add-keyframe action resolves the
   * CURRENT frame itself for the same reason.
   */
  const rowLatest = useRef({
    handleSelectPart, renamePartAndTrack, toggleTrackExpanded, toggleTrackEditVisibility, toggleTrackVisibility,
    toggleTrackLock, addKeyframeToTrack, currentFrame, handleAddChannelKeyframe, handleToggleChannelAnimation,
    toggleSubGroup, setCurrentFrame, setSelectedKeyframeId, selectKeyframes, beginKeyframePress, deleteKeyframe,
    deletePropertyKeyframe, deleteKeyframeFrameGroup, updateMaskPathKeyframeFrame, deleteMaskPathKeyframe,
    duplicateKeyframeGroup, handleCopyKeyframes, handlePasteKeyframes, getFrameFromMouse,
  });
  useLayoutEffect(() => {
    rowLatest.current = {
      handleSelectPart, renamePartAndTrack, toggleTrackExpanded, toggleTrackEditVisibility, toggleTrackVisibility,
      toggleTrackLock, addKeyframeToTrack, currentFrame, handleAddChannelKeyframe, handleToggleChannelAnimation,
      toggleSubGroup, setCurrentFrame, setSelectedKeyframeId, selectKeyframes, beginKeyframePress, deleteKeyframe,
      deletePropertyKeyframe, deleteKeyframeFrameGroup, updateMaskPathKeyframeFrame, deleteMaskPathKeyframe,
      duplicateKeyframeGroup, handleCopyKeyframes, handlePasteKeyframes, getFrameFromMouse,
    };
  });
  const rowActions = useMemo(() => {
    const latest = () => rowLatest.current;
    return {
      onSelect: (partId: string, shiftKey: boolean) => latest().handleSelectPart(partId, shiftKey),
      onStartEdit: (partId: string, name: string) => { setEditingPartId(partId); setEditingNameValue(name); },
      onEnterCommit: (partId: string, name: string) => { if (name.trim()) latest().renamePartAndTrack(partId, name.trim()); setEditingPartId(null); },
      onCancelEdit: () => setEditingPartId(null),
      onToggleExpand: (trackId: string) => latest().toggleTrackExpanded(trackId),
      onToggleEditVisible: (trackId: string) => latest().toggleTrackEditVisibility(trackId),
      onToggleVisible: (trackId: string) => latest().toggleTrackVisibility(trackId),
      onToggleLock: (trackId: string) => latest().toggleTrackLock(trackId),
      onAddKeyframe: (trackId: string) => latest().addKeyframeToTrack(trackId, latest().currentFrame),
      onAddChannelKeyframe: (trackId: string, channel: AnimationChannel, partId: string) => latest().handleAddChannelKeyframe(trackId, channel, partId),
      onToggleChannelAnimation: (trackId: string, channel: AnimationChannel) => latest().handleToggleChannelAnimation(trackId, channel),
      onToggleSubGroup: (key: string, defaultVal?: boolean) => latest().toggleSubGroup(key, defaultVal),
      onJumpToFrame: (frame: number) => latest().setCurrentFrame(frame),
      onSelectKeyframe: (id: string | null) => latest().setSelectedKeyframeId(id),
      onToggleKeyframe: (id: string) => latest().selectKeyframes([id], 'toggle'),
      onSelectPart: (partId: string, shiftKey: boolean) => latest().handleSelectPart(partId, shiftKey),
      onSetFrame: (frame: number) => latest().setCurrentFrame(frame),
      onStartDragKf: (press: KeyframePress) => latest().beginKeyframePress(press, true),
      onStartDragPKf: (press: KeyframePress) => latest().beginKeyframePress(press, false),
      onHoverKf: (hover: { frame: number; label: string } | null) => setHoveredKf(hover),
      onDeleteKeyframe: (...args: Parameters<typeof deleteKeyframe>) => latest().deleteKeyframe(...args),
      onDeletePropertyKeyframe: (...args: Parameters<typeof deletePropertyKeyframe>) => latest().deletePropertyKeyframe(...args),
      onDeleteKeyframeGroup: (...args: Parameters<typeof deleteKeyframeFrameGroup>) => latest().deleteKeyframeFrameGroup(...args),
      onUpdateMaskPathKeyframeFrame: (...args: Parameters<typeof updateMaskPathKeyframeFrame>) => latest().updateMaskPathKeyframeFrame(...args),
      onDeleteMaskPathKeyframe: (...args: Parameters<typeof deleteMaskPathKeyframe>) => latest().deleteMaskPathKeyframe(...args),
      onDuplicateKeyframeGroup: (...args: Parameters<typeof duplicateKeyframeGroup>) => latest().duplicateKeyframeGroup(...args),
      onCopyKeyframes: (...args: Parameters<typeof handleCopyKeyframes>) => latest().handleCopyKeyframes(...args),
      onPasteKeyframes: (...args: Parameters<typeof handlePasteKeyframes>) => latest().handlePasteKeyframes(...args),
      onFrameFromClientX: (clientX: number) => latest().getFrameFromMouse(clientX),
    };
  }, []);
  const basePoseByPart = useMemo(
    () => new Map(tracks.map((track) => [track.partId, resolveAuthoredBasePose(characterParts, track.partId)])),
    [characterParts, tracks],
  );
  /** C7 — which property groups each layer has (masks, Trim Paths): one source for tree, lanes and marquee. */
  const laneContextByPart = useMemo(
    () => new Map<string, LaneContext>(characterParts.map((part) => [part.id, laneContextOf(part)])),
    [characterParts],
  );

  /*
   * C4 — a long layer list mounts only the tracks near its viewport, in BOTH
   * columns (layer rows and lanes share one window and one set of spacers, so
   * they stay aligned). A track's height is measured from its mounted layer row
   * (it grows when the track or a channel group expands); an unmeasured one is
   * the lane layout's own height (C5: `laneGroupHeight`, the rows the lanes
   * render), so the spacers stand for expanded tracks exactly. The selected,
   * renamed and focused tracks stay mounted.
   */
  const trackHeightsRef = useRef(new Map<string, number>());
  const [trackHeightsVersion, setTrackHeightsVersion] = useState(0);
  const trackHeightAt = useCallback(
    (index: number) => {
      const track = tracks[index];
      return track ? (trackHeightsRef.current.get(track.id) || laneGroupHeight(track, isGroupExpanded, laneContextByPart.get(track.partId))) : TRACK_ROW_HEIGHT;
    },
    // `trackHeightsVersion` is the cache key of the measured heights.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [tracks, trackHeightsVersion, isGroupExpanded, laneContextByPart],
  );
  const [focusedTrackPartId, setFocusedTrackPartId] = useState<string | null>(null);
  const pinnedTracks = useMemo(() => {
    const keep = new Set<string>([...(selectedPartIds ?? []), ...(editingPartId ? [editingPartId] : []), ...(focusedTrackPartId ? [focusedTrackPartId] : [])]);
    if (selectedPartId) keep.add(selectedPartId);
    const pinned: number[] = [];
    tracks.forEach((track, index) => {
      if (keep.has(track.partId)) pinned.push(index);
    });
    return pinned;
  }, [tracks, selectedPartIds, selectedPartId, editingPartId, focusedTrackPartId]);
  const trackViewport = useCallback((scrollElement: HTMLElement): RowViewport => ({ top: scrollElement.scrollTop, height: scrollElement.clientHeight }), []);
  // Kept across an Edit ⇄ Broadcast round trip; restored before the window reads it.
  useRetainedScrollTop('timeline.rows.scrollTop', outlinerRef);
  useRetainedScrollTop('timeline.grid.scrollTop', timelineGridRef);
  const trackWindow = useRowWindow({ count: tracks.length, heightAt: trackHeightAt, pinned: pinnedTracks, scrollRef: outlinerRef, viewportOf: trackViewport });
  useEffect(() => {
    const list = outlinerRef.current;
    if (!trackWindow.windowed || !list || typeof ResizeObserver !== 'function') return undefined;
    const observer = new ResizeObserver((entries) => {
      let changed = false;
      entries.forEach((entry) => {
        const element = entry.target as HTMLElement;
        const id = element.dataset.trackRowId;
        const height = element.offsetHeight;
        if (!id || height <= 0 || trackHeightsRef.current.get(id) === height) return;
        trackHeightsRef.current.set(id, height);
        changed = true;
      });
      if (changed) setTrackHeightsVersion((version) => version + 1);
    });
    list.querySelectorAll<HTMLElement>('[data-track-row-id]').forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [trackWindow.windowed, trackWindow.segments]);
  const handleTrackFocus = useCallback((event: React.FocusEvent<HTMLElement>) => {
    const owner = (event.target as HTMLElement).closest<HTMLElement>('[data-track-part-id], [data-owner-part-id]');
    setFocusedTrackPartId(owner?.dataset.trackPartId ?? owner?.dataset.ownerPartId ?? null);
  }, []);
  const renderTrackWindow = (renderTrack: (track: (typeof tracks)[number]) => React.ReactElement) => trackWindow.segments.flatMap((segment: RowWindowSegment): React.ReactElement[] => (
    segment.kind === 'gap'
      ? [<div key={`gap-${segment.start}`} className="row-window-spacer" aria-hidden="true" style={{ height: segment.height, flex: 'none' }} />]
      : tracks.slice(segment.start, segment.end).map(renderTrack)
  ));

  return (
    <footer
      ref={timelineRef}
      data-shortcut-scope="timeline"
      className={`sequencer-timeline ${isTimelineCollapsed ? 'is-collapsed' : ''} ${resizeAxis === 'rows' ? 'is-resizing-rows' : ''}`}
      style={{ height: `${edgeHeight}px` }}
      data-collapsed={isTimelineCollapsed ? 'true' : 'false'}
      data-testid="sequencer-timeline"
    >
      {/*
        R3-01 — the collapse control is an EDGE HANDLE, not a labelled button.
        It is attached to the panel's top edge (the boundary the resize drag
        owns), it speaks the same compact chevron handle language as the side
        panels' show/hide handles, and it stays reachable while collapsed — which
        is what makes the collapsed strip a restore affordance. The authored
        height is never touched, so expanding restores it exactly.
      */}
      <button
        type="button"
        className="sidebar-handle timeline-edge-toggle"
        data-testid="timeline-collapse-toggle"
        aria-expanded={!isTimelineCollapsed}
        aria-controls="timeline-workspace-body"
        aria-label={isTimelineCollapsed ? 'Expand timeline' : 'Collapse timeline'}
        title={isTimelineCollapsed ? 'Expand the timeline panel' : 'Collapse the timeline panel'}
        onClick={toggleTimelineCollapsed}
      >
        {isTimelineCollapsed ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
      </button>

      {/* Top Resizer Handle Bar (the expanded panel's own height authority) */}
      {!isTimelineCollapsed && (
        <div
          className="timeline-resizer-bar"
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize timeline height"
          data-testid="timeline-height-resizer"
          onMouseDown={beginResize('rows')}
          title="Drag to resize the timeline panel"
        >
          <div className="resizer-handle-pill" />
        </div>
      )}

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
                onContextMenu={(event) => event.preventDefault()}
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


      <ConfirmationDialog
        isOpen={pendingStopAnim !== null}
        title="Stop animating this property?"
        description={pendingStopAnim
          ? `“${pendingStopAnim.label}” of ${pendingStopAnim.partName} is animated. Stopping deletes its ${pendingStopAnim.keyCount} keyframe${pendingStopAnim.keyCount === 1 ? '' : 's'} in this sequence; the value the timeline shows at the playhead is kept as the static value.`
          : ''}
        onCancel={() => setPendingStopAnim(null)}
        onConfirm={() => {
          if (pendingStopAnim) disableChannelAnimation(pendingStopAnim.trackId, pendingStopAnim.channel);
          setPendingStopAnim(null);
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
                value={Number(frameToSeconds(activeSequenceDurationFrames, fps).toFixed(1))}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const sec = parseFloat(e.target.value);
                  if (!isNaN(sec) && sec > 0) {
                    const durationFrames = Math.round(secondsToFrame(sec, fps));
                    updateMotionTemplateDuration(activeTemplateId, durationFrames);
                    setTotalFrames(durationFrames);
                  }
                }}
              />
              <span className="duration-unit" aria-hidden="true">s</span>
            </span>
            <div className="duration-preset-group" role="group" aria-label="Sequence duration presets">
              {[1, 2, 3, 5, 10].map((sec) => (
                <button key={sec} className={`duration-preset-pill ${activeSequenceDurationFrames === secondsToFrame(sec, fps) ? 'active' : ''}`} onClick={() => {
                  const durationFrames = secondsToFrame(sec, fps);
                  updateMotionTemplateDuration(activeTemplateId, durationFrames);
                  setTotalFrames(durationFrames);
                }} title={`Set the sequence to ${sec} seconds`} aria-pressed={activeSequenceDurationFrames === secondsToFrame(sec, fps)}>{sec}s</button>
              ))}
            </div>
            <button className="fit-pill-btn crop-btn" onClick={handleCropToContent} title="Crop the sequence to the last keyframe">
              <Scissors size={12} aria-hidden="true" /><span>Crop</span>
            </button>
          </div>
        </div>

        <div className="timeline-header-center timeline-transport-band">
          {/* R3-09 — navigation only: the playhead moves, the document never does. */}
          <button
            className="btn-icon transport-btn"
            onClick={() => setCurrentFrame(0)}
            title="Go to frame 0"
            aria-label="Go to frame 0"
          >
            <ChevronsLeft size={16} aria-hidden="true" />
          </button>
          <button className="btn-icon transport-btn" onClick={() => setCurrentFrame((f) => Math.max(0, f - 1))} title="Step Back" aria-label="Step back one frame"><SkipBack size={16} aria-hidden="true" /></button>
          <button
            className={`play-main-btn-teal ${isPlaying ? 'playing' : ''}`}
            onClick={() => {
              if (!isPlaying && currentFrame >= totalFrames) {
                setCurrentFrame(0);
              }
              setIsPlaying(!isPlaying);
            }}
            title={isPlaying ? 'Pause' : 'Play'}
            aria-label={isPlaying ? 'Pause playback' : 'Play animation'}
            aria-pressed={isPlaying}
          >
            {isPlaying ? <Pause size={18} aria-hidden="true" /> : <Play size={18} className="translate-x-px" aria-hidden="true" />}
          </button>
          <button className="btn-icon transport-btn" onClick={() => setCurrentFrame((f) => Math.min(totalFrames, f + 1))} title="Step Forward" aria-label="Step forward one frame"><SkipForward size={16} aria-hidden="true" /></button>
          {/*
            R3-08 — the loop toggle reports its state twice: `aria-pressed` for
            assistive technology and the existing `.active` treatment for the eye.
            The wrap itself is the playback authority's (`usePlayback`), and the
            flag is view state — it is deliberately NOT serialized with the
            project.
          */}
          <button
            className={`btn-icon transport-btn ${isLooping ? 'active' : ''}`}
            onClick={() => setIsLooping(!isLooping)}
            title={isLooping ? 'Loop playback is on: the sequence wraps from the end to frame 0' : 'Loop playback is off: playback stops on the last frame'}
            aria-label="Loop playback"
            aria-pressed={isLooping}
          >
            <Repeat size={15} aria-hidden="true" />
          </button>
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
      <div className="timeline-body timeline-body-v3" id="timeline-workspace-body" ref={timelineBodyRef}>

        {/* ── LEFT OUTLINER ── */}
        <div className="track-outliner ue-outliner timeline-layer-pane" style={{ width: `${outlinerWidth}px` }}>
          {/* Sticky ruler-height spacer to align with grid ruler */}
          <div className="ue-outliner-ruler-spacer">
            <span>LAYERS ({tracks.length})</span>
          </div>

          <div className="ue-outliner-list" ref={outlinerRef} onScroll={handleOutlinerScroll} onFocus={handleTrackFocus}>
            {renderTrackWindow((track) => {
              const partItem = characterParts.find((p) => p.id === track.partId);
              const isChildLayer = Boolean(partItem?.parentId);

              return (
                <TrackOutlinerRow
                  key={track.id}
                  track={track}
                  ordinal={layerOrdinals.get(track.partId)}
                  layerCount={characterParts.length}
                  parts={characterParts}
                  isChildLayer={isChildLayer}
                  isSelected={selectedPartIds?.includes(track.partId)}
                  editingPartId={editingPartId}
                  editingNameValue={editingNameValue}
                  currentFrame={currentFrame}
                  activeTemplateId={activeTemplateId}
                  onSelect={rowActions.onSelect}
                  onStartEdit={rowActions.onStartEdit}
                  onEnterCommit={rowActions.onEnterCommit}
                  onCancelEdit={rowActions.onCancelEdit}
                  onToggleExpand={rowActions.onToggleExpand}
                  onToggleEditVisible={rowActions.onToggleEditVisible}
                  onToggleVisible={rowActions.onToggleVisible}
                  onToggleLock={rowActions.onToggleLock}
                  // M7/R3-10: the ONE canonical transform keyframe group action — it
                  // materializes every transform channel at the frame and migrates
                  // any legacy composite animation instead of hiding it.
                  onAddKeyframe={rowActions.onAddKeyframe}
                  onAddChannelKeyframe={rowActions.onAddChannelKeyframe}
                  // K1 (D2) — stopwatch: arms an unanimated channel, or asks
                  // before removing the animation of an animated one.
                  onToggleChannelAnimation={rowActions.onToggleChannelAnimation}
                  isGroupExpanded={isGroupExpanded}
                  onToggleSubGroup={rowActions.onToggleSubGroup}
                  // R3-07 — the layer row's keyframe navigation moves the playhead
                  // and nothing else: the callback writes the frame cursor only.
                  onJumpToFrame={rowActions.onJumpToFrame}
                />
              );
            })}
          </div>
        </div>

        {/* ── COLUMN DIVIDER: outliner width ── */}
        <div
          className={`timeline-column-resizer ${resizeAxis === 'columns' ? 'active' : ''}`}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize layer list width"
          data-testid="timeline-column-resizer"
          onMouseDown={beginResize('columns')}
          title="Drag to resize the layer list"
        />

        {/* ── RIGHT SCROLLABLE GRID ── */}
        <div className="timeline-grid-container timeline-graph-pane" ref={timelineGridRef} onScroll={handleGridScroll} onMouseDown={handleMarqueeStart}>
          {/* Time Ruler */}
          <TimeRuler
            frameNumbers={frameNumbers}
            frameWidth={FRAME_WIDTH}
            totalFrames={totalFrames}
            currentFrame={currentFrame}
            onPointerDown={handleRulerPointerDown}
            onSeekFrame={handleRulerKeySeek}
          />

          {/* Playhead */}
          <div className="playhead-line" data-frame={currentFrame} style={{ left: `${currentFrame * FRAME_WIDTH}px` }}>
            <div className="playhead-head">
              <span className="playhead-frame-label">{currentFrame}</span>
            </div>
          </div>

          {/* Track Lanes */}
          <div className="ue-track-lanes" onFocus={handleTrackFocus}>
            {renderTrackWindow((track) => (
              <TrackLane
                key={track.id}
                track={track}
                basePose={basePoseByPart.get(track.partId)}
                isSelected={selectedPartId === track.partId}
                selectedKeyframeIds={selectedKeyframeIds}
                frameWidth={FRAME_WIDTH}
                totalFrames={totalFrames}
                activeTemplateId={activeTemplateId}
                isGroupExpanded={isGroupExpanded}
                laneContext={laneContextByPart.get(track.partId)}
                onSelectKeyframe={rowActions.onSelectKeyframe}
                onToggleKeyframe={rowActions.onToggleKeyframe}
                onSelectPart={rowActions.onSelectPart}
                onSetFrame={rowActions.onSetFrame}
                onStartDragKf={rowActions.onStartDragKf}
                onStartDragPKf={rowActions.onStartDragPKf}
                onHoverKf={rowActions.onHoverKf}
                onDeleteKeyframe={rowActions.onDeleteKeyframe}
                onDeletePropertyKeyframe={rowActions.onDeletePropertyKeyframe}
                onDeleteKeyframeGroup={rowActions.onDeleteKeyframeGroup}
                onUpdateMaskPathKeyframeFrame={rowActions.onUpdateMaskPathKeyframeFrame}
                onDeleteMaskPathKeyframe={rowActions.onDeleteMaskPathKeyframe}
                onDuplicateKeyframeGroup={rowActions.onDuplicateKeyframeGroup}
                kfClipboard={kfClipboard}
                onCopyKeyframes={rowActions.onCopyKeyframes}
                onPasteKeyframes={rowActions.onPasteKeyframes}
                onFrameFromClientX={rowActions.onFrameFromClientX}
              />
            ))}
          </div>

          {/* Marquee selection rectangle (transient gesture chrome) */}
          {marqueeRect && (
            <div
              className="timeline-marquee"
              data-testid="timeline-marquee"
              aria-hidden="true"
              style={{
                left: `${marqueeRect.left}px`,
                top: `${marqueeRect.top}px`,
                width: `${marqueeRect.width}px`,
                height: `${marqueeRect.height}px`,
              }}
            />
          )}
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
            if (!curveSegment || !selectedTrack) return;
            // The segment's curve lives on the keyframe it starts at; the
            // mutator is dual (legacy + canonical + mask channels), and the
            // target is always the SELECTED track — never a fallback layer.
            updateKeyframeBezierPoints(selectedTrack.id, curveSegment.from.id, points);
          }}
          valueKeyframes={curveTarget?.channelKeyframes ?? []}
          onChangeKeyframeValue={(keyframeId, value) => {
            if (selectedTrack && graphChannel) updatePropertyKeyframeValue(selectedTrack.id, graphChannel as AnimationChannel, keyframeId, value);
          }}
          onChangeKeyframeHandles={(keyframeId, patch) => {
            if (selectedTrack && graphChannel) updatePropertyKeyframeTemporalHandles(selectedTrack.id, graphChannel as AnimationChannel, keyframeId, patch);
          }}
          onApplySegmentPreset={(keyframeId, outgoing, incoming) => {
            if (selectedTrack && graphChannel) applyTemporalHandlesToSegment(selectedTrack.id, graphChannel as AnimationChannel, keyframeId, outgoing, incoming);
          }}
          onBatchStart={startBatchInteraction}
          onBatchEnd={endBatchInteraction}
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

