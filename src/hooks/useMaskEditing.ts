import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppMode, BezierPath, CharacterPart, LayerMask, Track } from '../types/animator';
import { layerMaskIdsReferencedByTrack, nextLayerMaskId } from '../utils/layerMasks';
import { deleteMaskVertex, maskPathTopologyLockReason } from '../utils/maskPathCreation';
import { applyPathOrderEditEverywhere, planPathOrderEdit, type PathOrderCommand } from '../utils/maskPathOrder';
import { layerMaskPathChannel } from '../types/animator';

/**
 * WP-02 — the canvas mask-editing target. Transient editor state only: it is
 * never part of scene JSON, history snapshots or the preset library.
 */
export interface MaskEditTarget {
  ownerPartId: string;
  maskId: string;
}

/** WP-03 — the shape a new mask is being drawn as on the canvas. */
export type MaskDrawShape = 'rectangle' | 'ellipse' | 'pen';

/** WP-03 — a transient mask-drawing session on one owner layer. */
export interface MaskDrawSession {
  ownerPartId: string;
  shape: MaskDrawShape;
  /**
   * WP-08 — 'effect': the drawn mask is EFFECT-ONLY (it does not cut the
   * layer) and becomes the scope of the layer's colour correction, in the
   * same single write. Absent / 'alpha': a normal mask.
   */
  purpose?: 'alpha' | 'effect';
}

/** What one canvas mask gesture may need to put back when it is cancelled. */
export interface MaskGestureSnapshot {
  ownerPartId: string;
  masks: CharacterPart['masks'];
  maskPathChannels: Track['maskPathChannels'];
}

interface UseMaskEditingOptions {
  characterParts: CharacterPart[];
  tracks: Track[];
  setCharacterParts: React.Dispatch<React.SetStateAction<CharacterPart[]>>;
  setTracks: React.Dispatch<React.SetStateAction<Track[]>>;
  selectedPartId: string | null;
  appMode: AppMode;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  /** Closes the open history batch of a cancelled gesture. */
  endBatchInteraction: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

/** The target, while the document and the selection still honour it. */
const resolveMaskEditTarget = (
  target: MaskEditTarget | null,
  characterParts: CharacterPart[],
  selectedPartId: string | null,
  appMode: AppMode,
): MaskEditTarget | null => {
  if (!target || appMode !== 'edit' || selectedPartId !== target.ownerPartId) return null;
  const owner = characterParts.find((part) => part.id === target.ownerPartId);
  return owner?.masks?.some((mask) => mask.id === target.maskId) ? target : null;
};

/** The drawing session, while its owner exists and stays the selection. */
const resolveMaskDrawSession = (
  session: MaskDrawSession | null,
  characterParts: CharacterPart[],
  selectedPartId: string | null,
  appMode: AppMode,
): MaskDrawSession | null => {
  if (!session || appMode !== 'edit' || selectedPartId !== session.ownerPartId) return null;
  return characterParts.some((part) => part.id === session.ownerPartId && !part.isGroup) ? session : null;
};

export const useMaskEditing = ({
  characterParts,
  tracks,
  setCharacterParts,
  setTracks,
  selectedPartId,
  appMode,
  setIsPlaying,
  endBatchInteraction,
  showToast,
}: UseMaskEditingOptions) => {
  const [storedTarget, setStoredTarget] = useState<MaskEditTarget | null>(null);
  const [storedDraw, setStoredDraw] = useState<MaskDrawSession | null>(null);
  const [maskVertexIndex, setMaskVertexIndex] = useState<number | null>(null);
  // A target whose owner or mask disappeared, whose owner is no longer the
  // selection, or that outlived Edit mode is gone — never silently moved onto
  // another object. The same holds for a drawing session.
  const maskEditTarget = resolveMaskEditTarget(storedTarget, characterParts, selectedPartId, appMode);
  const maskDrawSession = resolveMaskDrawSession(storedDraw, characterParts, selectedPartId, appMode);
  useEffect(() => {
    // Invalidated sessions are dropped so a later selection cannot revive them.
    // oxlint-disable-next-line react/set-state-in-effect
    if (storedTarget && !maskEditTarget) setStoredTarget(null);
    // oxlint-disable-next-line react/set-state-in-effect
    if (storedDraw && !maskDrawSession) setStoredDraw(null);
  }, [storedTarget, maskEditTarget, storedDraw, maskDrawSession]);

  // The vertex selection belongs to one mask.
  const targetKey = maskEditTarget ? `${maskEditTarget.ownerPartId}:${maskEditTarget.maskId}` : '';
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    setMaskVertexIndex(null);
  }, [targetKey]);

  /** The cancel of the canvas gesture in flight (registered by the overlay). */
  const gestureCancelRef = useRef<(() => void) | null>(null);
  const registerMaskGestureCancel = useCallback((cancel: (() => void) | null) => {
    gestureCancelRef.current = cancel;
  }, []);

  /**
   * Enters canvas editing for one mask. Playback pauses (D-03: a gesture is
   * authored at one frozen frame). Returns why entry was refused, or null.
   */
  const enterMaskEditing = useCallback((ownerPartId: string, maskId: string): string | null => {
    if (appMode !== 'edit') return 'Mask editing is available in Edit mode.';
    const mask = characterParts.find((part) => part.id === ownerPartId)?.masks?.find((candidate) => candidate.id === maskId);
    if (!mask) return 'This mask no longer exists.';
    if (mask.locked) return 'This mask is locked. Unlock it to edit its path.';
    setIsPlaying(false);
    setStoredDraw(null);
    setStoredTarget({ ownerPartId, maskId });
    return null;
  }, [appMode, characterParts, setIsPlaying]);

  const exitMaskEditing = useCallback(() => {
    gestureCancelRef.current?.();
    setStoredTarget(null);
  }, []);

  /**
   * WP-03 — arms drawing a NEW mask on the owner (Rectangle, Ellipse or Pen).
   * Nothing is written until the drawing is committed.
   */
  const startMaskDraw = useCallback((ownerPartId: string, shape: MaskDrawShape, purpose: 'alpha' | 'effect' = 'alpha'): string | null => {
    if (appMode !== 'edit') return 'Masks are drawn in Edit mode.';
    const owner = characterParts.find((part) => part.id === ownerPartId);
    if (!owner || owner.isGroup) return 'Select a layer to draw a mask on.';
    gestureCancelRef.current?.();
    setIsPlaying(false);
    setStoredTarget(null);
    setStoredDraw({ ownerPartId, shape, ...(purpose === 'effect' ? { purpose } : {}) });
    return null;
  }, [appMode, characterParts, setIsPlaying]);

  const cancelMaskDraw = useCallback(() => setStoredDraw(null), []);

  /**
   * Commits a drawn path as ONE new mask on the owner (one document write, so
   * one undo entry) with a collision-safe ID, then edits it on the canvas.
   */
  const commitMaskDraw = useCallback((path: BezierPath): string | null => {
    if (!maskDrawSession) return null;
    const owner = characterParts.find((part) => part.id === maskDrawSession.ownerPartId);
    if (!owner) return null;
    const masks = owner.masks ?? [];
    const reserved = layerMaskIdsReferencedByTrack(tracks.find((track) => track.partId === owner.id));
    const id = nextLayerMaskId(masks, reserved);
    const shapeName = maskDrawSession.shape === 'pen' ? 'Pen' : maskDrawSession.shape === 'ellipse' ? 'Ellipse' : 'Rectangle';
    const effectMask = maskDrawSession.purpose === 'effect';
    const mask: LayerMask = {
      id,
      name: effectMask ? `Effect Mask ${masks.length + 1}` : `${shapeName} Mask ${masks.length + 1}`,
      path,
      mode: 'add',
      enabled: true,
      opacity: 1,
      feather: 0,
      expansion: 0,
      ...(effectMask ? { affectsAlpha: false } : {}),
    };
    // One write (one undo step): the mask, and for an effect mask the colour
    // correction re-scoped to it.
    setCharacterParts((prev) => prev.map((part) => {
      if (part.id !== owner.id) return part;
      const effects = effectMask
        ? part.effects?.map((effect) => (effect.type === 'colorCorrection' ? { ...effect, scope: 'mask' as const, maskId: id } : effect))
        : part.effects;
      return { ...part, masks: [...(part.masks ?? []), mask], ...(effects ? { effects } : {}) };
    }));
    setStoredDraw(null);
    setStoredTarget({ ownerPartId: owner.id, maskId: id });
    return id;
  }, [characterParts, maskDrawSession, setCharacterParts, tracks]);

  /**
   * One Escape, one level: a drawing session is cancelled first, then an
   * in-flight gesture, then the mask editing mode itself is left. Returns
   * whether Escape was consumed.
   */
  const escapeMaskEditing = useCallback((): boolean => {
    if (maskDrawSession) {
      setStoredDraw(null);
      return true;
    }
    if (gestureCancelRef.current) {
      gestureCancelRef.current();
      return true;
    }
    if (!maskEditTarget) return false;
    setStoredTarget(null);
    return true;
  }, [maskDrawSession, maskEditTarget]);

  /**
   * WP-03 — writes a topology change (a vertex added or removed) to the BASE
   * mask path. A path keyed in any sequence refuses with a visible reason
   * (D-08), and a refused or impossible edit writes nothing.
   */
  const applyMaskTopologyEdit = useCallback((
    ownerPartId: string,
    maskId: string,
    edit: (path: BezierPath) => BezierPath | null,
    refusal: string,
  ): boolean => {
    const owner = characterParts.find((part) => part.id === ownerPartId);
    const mask = owner?.masks?.find((candidate) => candidate.id === maskId);
    if (!owner || !mask) return false;
    const locked = maskPathTopologyLockReason(tracks.find((track) => track.partId === ownerPartId), maskId);
    if (locked) {
      showToast(locked, 'info');
      return false;
    }
    const next = edit(mask.path);
    if (!next) {
      showToast(refusal, 'info');
      return false;
    }
    setCharacterParts((prev) => prev.map((part) => (part.id === ownerPartId
      ? { ...part, masks: part.masks?.map((candidate) => (candidate.id === maskId ? { ...candidate, path: next } : candidate)) }
      : part)));
    return true;
  }, [characterParts, setCharacterParts, showToast, tracks]);

  /**
   * C4 — a mask path structure command (close/open, reverse direction, first
   * point, move a point earlier/later in the path order) as ONE undo step. The
   * same id-level edit is applied to the static path and to every keyframe of
   * an animated path, so the animation keeps one point identity order; when a
   * keyframe does not share the points, nothing changes and the reason is
   * shown. Returns where the selected point ended up (or null when refused).
   */
  const applyMaskPathOrder = useCallback((
    ownerPartId: string,
    maskId: string,
    command: PathOrderCommand,
    selectedIndex: number | null,
  ): { applied: boolean; selectedIndex: number | null } => {
    const owner = characterParts.find((part) => part.id === ownerPartId);
    const mask = owner?.masks?.find((candidate) => candidate.id === maskId);
    if (!owner || !mask) return { applied: false, selectedIndex };
    if (mask.locked) {
      showToast('This mask is locked. Unlock it to edit its path.', 'error');
      return { applied: false, selectedIndex };
    }
    const plan = planPathOrderEdit(mask.path, command, selectedIndex);
    if (!plan.ok) {
      showToast(plan.reason, 'info');
      return { applied: false, selectedIndex };
    }
    const channel = layerMaskPathChannel(maskId);
    const track = tracks.find((candidate) => candidate.partId === ownerPartId);
    const keys = track?.maskPathChannels?.[channel] ?? [];
    const outcome = applyPathOrderEditEverywhere(mask.path, keys.map((key) => key.value), plan.edit);
    if (!outcome.ok) {
      showToast(outcome.reason, 'error');
      return { applied: false, selectedIndex };
    }
    setCharacterParts((prev) => prev.map((part) => (part.id === ownerPartId
      ? { ...part, masks: part.masks?.map((candidate) => (candidate.id === maskId ? { ...candidate, path: outcome.base } : candidate)) }
      : part)));
    if (track && keys.length > 0) {
      setTracks((prev) => prev.map((candidate) => (candidate.id === track.id
        ? { ...candidate, maskPathChannels: { ...candidate.maskPathChannels, [channel]: keys.map((key, index) => ({ ...key, value: outcome.keyframePaths[index] })) } }
        : candidate)));
    }
    return { applied: true, selectedIndex: plan.selectedIndex };
  }, [characterParts, setCharacterParts, setTracks, showToast, tracks]);

  /**
   * Delete while a mask is edited: removes the selected vertex (static path
   * only). Always consumed, so Delete never falls through to the owner layer.
   */
  const deleteMaskSelection = useCallback((): boolean => {
    if (!maskEditTarget) return false;
    if (maskVertexIndex === null) return true;
    const index = maskVertexIndex;
    const removed = applyMaskTopologyEdit(
      maskEditTarget.ownerPartId,
      maskEditTarget.maskId,
      (path) => deleteMaskVertex(path, index),
      'A mask path keeps at least three points.',
    );
    if (removed) setMaskVertexIndex(null);
    return true;
  }, [applyMaskTopologyEdit, maskEditTarget, maskVertexIndex]);

  /** The owner's masks and path channels before a gesture writes anything. */
  const captureMaskGestureSnapshot = useCallback((ownerPartId: string): MaskGestureSnapshot => ({
    ownerPartId,
    masks: characterParts.find((part) => part.id === ownerPartId)?.masks,
    maskPathChannels: tracks.find((track) => track.partId === ownerPartId)?.maskPathChannels,
  }), [characterParts, tracks]);

  /**
   * The narrow cancellation seam: puts back exactly what a mask gesture may
   * have written (the owner's masks and its mask path channels — a between-key
   * drag inserts a key) INSIDE the gesture's open history batch, then closes
   * the batch once the restore has rendered. The batch therefore ends on a
   * document identical to its start and records nothing; the redo stack is
   * untouched. It lives here, not in the overlay, so leaving the mode (which
   * unmounts the overlay) can never strand an open batch.
   */
  const [pendingBatchClose, setPendingBatchClose] = useState(0);
  useEffect(() => {
    if (pendingBatchClose === 0) return;
    endBatchInteraction();
  }, [pendingBatchClose, endBatchInteraction]);

  const cancelMaskGesture = useCallback((snapshot: MaskGestureSnapshot) => {
    setCharacterParts((prev) => prev.map((part) => (part.id === snapshot.ownerPartId ? { ...part, masks: snapshot.masks } : part)));
    setTracks((prev) => prev.map((track) => {
      if (track.partId !== snapshot.ownerPartId) return track;
      if (snapshot.maskPathChannels) return { ...track, maskPathChannels: snapshot.maskPathChannels };
      const restored = { ...track };
      delete restored.maskPathChannels;
      return restored;
    }));
    setPendingBatchClose((count) => count + 1);
  }, [setCharacterParts, setTracks]);

  return {
    maskEditTarget,
    enterMaskEditing,
    exitMaskEditing,
    escapeMaskEditing,
    registerMaskGestureCancel,
    captureMaskGestureSnapshot,
    cancelMaskGesture,
    maskVertexIndex,
    setMaskVertexIndex,
    deleteMaskSelection,
    applyMaskTopologyEdit,
    applyMaskPathOrder,
    maskDrawSession,
    startMaskDraw,
    cancelMaskDraw,
    commitMaskDraw,
  };
};
