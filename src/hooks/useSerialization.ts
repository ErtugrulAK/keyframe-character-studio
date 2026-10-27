import { useState, useEffect, useCallback, useRef } from 'react';
import type { AnimationTrackData, CharacterPart, Track, MotionTemplate, PropertyKeyframe } from '../types/animator';
import type { PersistedTrackState, SceneCoordinateSystem, SceneData, SceneLayer } from '../types/composition';
import { initializeIdCounter } from '../utils/idGenerator';
import { makeEmptyChannels, DEFAULT_TRACKS, DEFAULT_CHARACTER_PARTS } from '../utils/defaults';
import { convertLegacyKeyframesToChannels, fillChannelsFromLegacyKeyframes } from '../utils/legacyKeyframeConversion';
import { resolveAuthoredBasePose } from '../utils/channelKeyframeGroups';
import { AUTOSAVE_LOCK_NAME, AUTOSAVE_STORAGE_KEY, DEFAULT_MOTION_TEMPLATES } from '../utils/constants';
import { DEFAULT_SCENE_COORDINATE_SYSTEM, isSceneCoordinateSystem, migrateSceneCoordinates } from '../utils/coordinateMigration';
import { normalizeMotionTemplates } from '../utils/motionTemplates';
import { migrateSceneLayerV6 } from '../utils/v6Migration';

/**
 * Narrowing helpers for the legacy document's optional fields. The import
 * boundary types them `unknown` on purpose, so every consumer checks the
 * shape before handing a value to state — truthiness alone would let a
 * string or an object through.
 */
const readOptionalNumber = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);
const readOptionalString = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);
/** A saved ISO timestamp, only when it actually parses to a valid date. */
const readOptionalDate = (value: unknown): Date | undefined => {
  const text = readOptionalString(value);
  if (text === undefined) return undefined;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};
const readProjectResolution = (value: unknown): { width: number; height: number } | undefined => {
  if (typeof value !== 'object' || value === null) return undefined;
  const candidate = value as { width?: unknown; height?: unknown };
  const width = readOptionalNumber(candidate.width);
  const height = readOptionalNumber(candidate.height);
  return width !== undefined && height !== undefined && width > 0 && height > 0 ? { width, height } : undefined;
};
const readMotionTemplates = (value: unknown): MotionTemplate[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const templates = value.filter((entry): entry is MotionTemplate =>
    typeof entry === 'object' && entry !== null && typeof (entry as { id?: unknown }).id === 'string' && typeof (entry as { name?: unknown }).name === 'string');
  return templates.length > 0 ? templates : undefined;
};
import { normalizeBezierPath } from '../utils/bezierPath';
import { SCENE_VERSION_WITH_EFFECTS, sceneUsesEffectFeatures } from '../utils/colorCorrection';
import { validateImportedDocument, type ImportResult } from '../utils/importValidation';
const noopSetCoordinateSystem: React.Dispatch<React.SetStateAction<SceneCoordinateSystem>> = () => undefined;
// A module-level stable default: a per-render inline default would join the
// restore effect's dependencies and re-arm the one-shot sync on every render.
const noopRequestHistoryBaseline = () => undefined;

/** Ensure legacy tracks (without channels) get empty channels injected */
function migrateTrack(t: Track): Track {
  return {
    ...t,
    channels: t.channels ?? makeEmptyChannels(),
    expanded: t.expanded ?? false,
    editVisible: t.editVisible ?? true,
  };
}

function migrateMaskPathChannels(
  channels: AnimationTrackData['maskPathChannels'],
): AnimationTrackData['maskPathChannels'] {
  if (!channels) return undefined;
  const migrated: NonNullable<AnimationTrackData['maskPathChannels']> = {};
  for (const [channel, keyframes] of Object.entries(channels)) {
    const valid = keyframes
      .map((keyframe) => {
        const path = normalizeBezierPath(keyframe.value, 'normalized');
        return path ? { ...keyframe, value: path } : undefined;
      })
      .filter((keyframe): keyframe is NonNullable<typeof keyframe> => Boolean(keyframe));
    if (valid.length > 0) migrated[channel as keyof typeof migrated] = valid;
  }
  return Object.keys(migrated).length > 0 ? migrated : undefined;
}

// ─── Phase 3: SceneData ↔ AnimationProject conversion ───────────────

/**
 * Export current state to canonical SceneData format (version 2).
 */
function toSceneData(
  characterParts: CharacterPart[],
  tracks: Track[],
  fps: number,
  totalFrames: number,
  projectResolution: { width: number; height: number },
  coordinateSystem: SceneCoordinateSystem,
  _sceneTitle: string,
  motionTemplates: MotionTemplate[] = DEFAULT_MOTION_TEMPLATES,
  activeTemplateId = 'Sequence',
): SceneData {
  const layers: SceneLayer[] = characterParts.map(p => ({
    id: p.id,
    parentId: p.parentId,
    ...(p.isGroup ? { isGroup: true } : {}),
    ...(p.boundPartIds?.length ? { boundPartIds: p.boundPartIds } : {}),
    name: p.name,
    type: p.type,
    x: p.baseTransform.x,
    y: p.baseTransform.y,
    rotation: p.baseTransform.rotation,
    scaleX: p.baseTransform.scaleX,
    scaleY: p.baseTransform.scaleY,
    opacity: p.baseTransform.opacity,
    matte: p.matte,
    masks: p.masks,
    trackMatte: p.trackMatte,
    ...(p.effects?.length ? { effects: p.effects } : {}),
    booleanGroupId: p.booleanGroupId,
    booleanOperation: p.booleanOperation,
    booleanOperandIds: p.booleanOperandIds,
    booleanContours: p.booleanContours,
    // A layer-group container is a structural layer with no geometry: it is
    // saved as not visible so neither the OGraf SVG renderer nor the generated
    // runtime tries to paint it, while its transform still composes into the
    // children. Every other layer stays visible.
    visible: !p.isGroup,
    zIndex: p.zIndex,
    fillColor: p.fillColor,
    strokeColor: p.strokeColor,
    ...(p.fillEnabled !== undefined ? { fillEnabled: p.fillEnabled } : {}),
    ...(p.fillOpacity !== undefined ? { fillOpacity: p.fillOpacity } : {}),
    ...(p.strokeEnabled !== undefined ? { strokeEnabled: p.strokeEnabled } : {}),
    ...(p.strokeWidth !== undefined ? { strokeWidth: p.strokeWidth } : {}),
    ...(p.strokeOpacity !== undefined ? { strokeOpacity: p.strokeOpacity } : {}),
    ...(p.strokeAlignment !== undefined ? { strokeAlignment: p.strokeAlignment } : {}),
    ...(p.trimPathEnabled !== undefined ? { trimPathEnabled: p.trimPathEnabled } : {}),
    ...(p.trimPathStart !== undefined ? { trimPathStart: p.trimPathStart } : {}),
    ...(p.trimPathEnd !== undefined ? { trimPathEnd: p.trimPathEnd } : {}),
    ...(p.trimPathOffset !== undefined ? { trimPathOffset: p.trimPathOffset } : {}),
    borderRadius: p.borderRadius,
    ...(p.strokeLinejoin !== undefined ? { strokeLinejoin: p.strokeLinejoin } : {}),
    width: p.width,
    height: p.height,
    ...(p.imageContentBounds !== undefined ? { imageContentBounds: p.imageContentBounds } : {}),
    points: p.points,
    path: p.path,
    textValue: p.textValue,
    fontSize: p.fontSize,
    fontFamily: p.fontFamily,
    imageUrl: p.imageUrl,
    videoUrl: p.videoUrl,
    shadowColor: p.shadowColor,
    shadowBlur: p.shadowBlur,
    shadowOffsetX: p.shadowOffsetX,
    shadowOffsetY: p.shadowOffsetY,
    inAnimPreset: p.inAnimPreset,
    outAnimPreset: p.outAnimPreset,
    inAnimDuration: p.inAnimDuration,
    outAnimDuration: p.outAnimDuration,
    // BUG #6 fix: serialize cloner/particle config so save/load preserves them.
    clonerConfig: p.clonerConfig,
    particleConfig: p.particleConfig,
  }));

  // P4-S3: Track → AnimationTrackData — same domain types, direct field mapping (partId canonical).
  // M8e: channels-only export policy. keyframes[] is NOT exported anymore —
  // legacy-only tracks (empty channels + populated keyframes[]) are converted
  // to canonical channels at export time so no animation data is lost.
  // F-01: a track with *partly* populated channels still resolves its remaining
  // channels from the legacy composite at evaluation time, so those channels are
  // filled here. Writing only the populated ones dropped that fallback and
  // changed the animation the next load produced.
  const animTracks: (AnimationTrackData & PersistedTrackState)[] = tracks.map(t => {
    const hasChannelData = !!t.channels && Object.values(t.channels).some((arr) => arr.length > 0);
    // The layer's own authored pose is the proof the legacy → canonical
    // resolution needs before it may leave a composite property that only
    // re-states the layer's pose out of the exported channels (see
    // `convertLegacyKeyframesToChannels`).
    const basePose = resolveAuthoredBasePose(characterParts, t.partId);
    const channels = hasChannelData
      ? fillChannelsFromLegacyKeyframes(t.channels, t.keyframes || [], basePose)
      : convertLegacyKeyframesToChannels(t.keyframes || [], basePose);
    return {
      partId: t.partId,
      channels: channels as Record<string, PropertyKeyframe[]>,
      maskChannels: t.maskChannels,
      maskPathChannels: t.maskPathChannels,
      sequencerTemplateId: t.sequencerTemplateId,
      // Authoring state the editor and the evaluator read back: without these a
      // muted, canvas-hidden or locked track silently returns visible.
      visible: t.visible,
      locked: t.locked,
      ...(t.editVisible !== undefined ? { editVisible: t.editVisible } : {}),
    };
  });

  return {
    // WP-08 option B: version 3 ONLY when the scene uses an effect or an
    // effect-only mask; every other scene keeps writing 2, exactly as before.
    version: sceneUsesEffectFeatures(layers) ? SCENE_VERSION_WITH_EFFECTS : 2,
    // Persist the active authoring contract; legacy-unknown is retained for
    // historical/mixed scenes until an explicit contract is selected.
    coordinateSystem,
    width: projectResolution.width,
    height: projectResolution.height,
    fps,
    totalFrames,
    layers,
    tracks: animTracks,
    motionTemplates: normalizeMotionTemplates(motionTemplates),
    activeTemplateId,
  };
}

/**
 * Import SceneData into current editor state.
 * Returns true on success.
 */
function fromSceneData(
  scene: SceneData,
  defaultName: string,
  setCharacterParts: React.Dispatch<React.SetStateAction<CharacterPart[]>>,
  setTracks: React.Dispatch<React.SetStateAction<Track[]>>,
  setFps: React.Dispatch<React.SetStateAction<number>>,
  setTotalFrames: React.Dispatch<React.SetStateAction<number>>,
  setProjectResolution: React.Dispatch<React.SetStateAction<{ width: number; height: number }>>,
  setCoordinateSystem: React.Dispatch<React.SetStateAction<SceneCoordinateSystem>>,
  setLastSavedAt: React.Dispatch<React.SetStateAction<Date | null>>,
  setSceneTitle: React.Dispatch<React.SetStateAction<string>>,
  setMotionTemplates: React.Dispatch<React.SetStateAction<MotionTemplate[]>>,
  setActiveTemplateId: React.Dispatch<React.SetStateAction<string>>,
): boolean {
  const parts: CharacterPart[] = scene.layers.map(l => migrateSceneLayerV6(l)).map(l => ({
    id: l.id,
    name: l.name,
    type: l.type as any,
    zIndex: l.zIndex,
    fillColor: l.fillColor,
    strokeColor: l.strokeColor,
    ...(l.fillEnabled !== undefined ? { fillEnabled: l.fillEnabled } : {}),
    ...(l.fillOpacity !== undefined ? { fillOpacity: l.fillOpacity } : {}),
    ...(l.strokeEnabled !== undefined ? { strokeEnabled: l.strokeEnabled } : {}),
    pivot: { x: 0, y: 0 },
    parentId: l.parentId,
    ...(l.isGroup ? { isGroup: true } : {}),
    ...(l.boundPartIds && l.boundPartIds.length > 0 ? { boundPartIds: l.boundPartIds } : {}),
    matte: l.matte,
    masks: l.masks,
    trackMatte: l.trackMatte,
    ...(l.effects?.length ? { effects: l.effects.map((effect) => ({ ...effect })) } : {}),
    booleanGroupId: l.booleanGroupId,
    booleanOperation: l.booleanOperation,
    booleanOperandIds: l.booleanOperandIds,
    booleanContours: l.booleanContours,
    baseTransform: {
      x: l.x ?? 0,
      y: l.y ?? 0,
      rotation: l.rotation ?? 0,
      scaleX: l.scaleX ?? 1,
      scaleY: l.scaleY ?? 1,
      opacity: l.opacity ?? 1,
    },
    textValue: l.textValue,
    fontSize: l.fontSize,
    imageUrl: l.imageUrl,
    videoUrl: l.videoUrl,
    shadowColor: l.shadowColor,
    shadowBlur: l.shadowBlur,
    shadowOffsetX: l.shadowOffsetX,
    shadowOffsetY: l.shadowOffsetY,
    borderRadius: l.borderRadius,
    ...(l.strokeLinejoin === 'miter' || l.strokeLinejoin === 'round' ? { strokeLinejoin: l.strokeLinejoin } : {}),
    width: l.width,
    height: l.height,
    ...(l.imageContentBounds !== undefined ? { imageContentBounds: l.imageContentBounds } : {}),
    ...(l.strokeWidth !== undefined ? { strokeWidth: l.strokeWidth } : {}),
    points: l.points,
    path: l.path,
    ...(l.strokeOpacity !== undefined ? { strokeOpacity: l.strokeOpacity } : {}),
    ...(l.strokeAlignment !== undefined ? { strokeAlignment: l.strokeAlignment } : {}),
    ...(l.trimPathEnabled !== undefined ? { trimPathEnabled: l.trimPathEnabled } : {}),
    ...(l.trimPathStart !== undefined ? { trimPathStart: l.trimPathStart } : {}),
    ...(l.trimPathEnd !== undefined ? { trimPathEnd: l.trimPathEnd } : {}),
    ...(l.trimPathOffset !== undefined ? { trimPathOffset: l.trimPathOffset } : {}),
    fontFamily: l.fontFamily,
    // BUG #3 fix: restore exported procedural animation config
    // (SceneLayer defines these; computeProceduralDelta consumes them).
    inAnimPreset: l.inAnimPreset,
    outAnimPreset: l.outAnimPreset,
    inAnimDuration: l.inAnimDuration,
    outAnimDuration: l.outAnimDuration,
    // BUG #6 fix: restore cloner/particle config set via Inspector UI.
    clonerConfig: l.clonerConfig,
    particleConfig: l.particleConfig,
    } as CharacterPart));

  // P4-S3: partId is canonical. Legacy v1 files wrote `layerId` — read both.
  const trks: Track[] = scene.tracks.map(t => {
    const layerId = (t as AnimationTrackData & { layerId?: string }).layerId ?? t.partId;
    return {
      id: `track_${layerId}`,
      partId: layerId,
      name: `Track ${layerId.slice(0, 6)}`,
      color: '#3b82f6',
      keyframes: (t.keyframes || []).map(k => ({
        id: k.id,
        frame: k.frame,
        transform: {
          x: k.transform.x,
          y: k.transform.y,
          rotation: k.transform.rotation ?? 0,
          scaleX: k.transform.scaleX ?? 1,
          scaleY: k.transform.scaleY ?? 1,
          // BUG #4 fix: `??` so opacity 0 (invisible keyframe) is preserved;
          // only undefined/missing opacity falls back to 1.
          opacity: k.transform.opacity ?? 1,
        },
        easing: k.easing as any,
      })),
      // BUG #1 fix: import the canonical channels written by toSceneData
      // instead of resetting to empty. Legacy files without channels fall back.
      // M2: if the file has NO channels but HAS legacy keyframes, convert them
      // into canonical channels at import time. Existing channels always win.
      // M8e-prepB: "channels exist" now means they carry ACTUAL keyframe data —
      // an all-empty channel structure (e.g. 10 empty arrays) falls back to the
      // legacy conversion instead of silently dropping populated keyframes[].
      // R3-11: the resolution is the EVALUATOR's own (`fillChannelsFromLegacyKeyframes`),
      // so a file with partially populated channels plus a legacy keyframe list
      // imports what it plays — nothing can be hidden from the timeline, and a
      // channel the legacy list still drives becomes canonical at import. The
      // imported layer's own pose is the proof a composite property that only
      // re-states that pose is not authored animation.
      channels: fillChannelsFromLegacyKeyframes(t.channels, t.keyframes || [], resolveAuthoredBasePose(parts, layerId)) as Track['channels'],
      maskChannels: t.maskChannels,
      maskPathChannels: migrateMaskPathChannels(t.maskPathChannels),
      // H-04: the authoring state exported with the track has to come back, or a
      // muted / canvas-hidden / locked track silently returns visible.
      sequencerTemplateId: t.sequencerTemplateId,
      visible: t.visible ?? true,
      editVisible: t.editVisible ?? true,
      locked: t.locked ?? false,
    };
  });

  // Everything the scene can make this function throw is derived BEFORE the first
  // state update: an import that cannot be applied is refused by the caller
  // (`importProject`) without having replaced part of the current project.
  // BUG #5 fix: restore exported motion templates (legacy path already does this).
  // Missing motionTemplates keeps current templates untouched.
  const templates = scene.motionTemplates && scene.motionTemplates.length > 0
    ? normalizeMotionTemplates(scene.motionTemplates)
    : undefined;
  const nextActiveTemplateId = templates
    ? (scene.activeTemplateId && templates.some((template) => template.id === scene.activeTemplateId)
        ? scene.activeTemplateId
        : templates[0]?.id || 'Sequence')
    : undefined;
  const nextFps = scene.fps;
  const nextTotalFrames = scene.totalFrames;
  const nextResolution = scene.width && scene.height ? { width: scene.width, height: scene.height } : undefined;
  const nextName = (defaultName || '').trim();
  // Initialize ID counter from all IDs
  const allIds: string[] = [];
  parts.forEach(p => allIds.push(p.id));
  trks.forEach(t => {
    allIds.push(t.id);
    t.keyframes?.forEach(k => allIds.push(k.id));
    Object.values(t.channels || {}).forEach((channel) => channel.forEach((keyframe) => allIds.push(keyframe.id)));
  });
  (scene.motionTemplates || []).forEach((template) => allIds.push(template.id));
  initializeIdCounter(allIds);

  setCharacterParts(parts);
  setTracks(trks);
  if (nextFps) setFps(nextFps);
  if (nextTotalFrames) setTotalFrames(nextTotalFrames);
  if (nextResolution) setProjectResolution(nextResolution);
  setCoordinateSystem(scene.coordinateSystem ?? DEFAULT_SCENE_COORDINATE_SYSTEM);
  // BUG #2 fix: restore the exported scene name as editor sceneTitle.
  // Empty/missing name keeps the current/default title (no-op).
  if (nextName) {
    setSceneTitle(nextName);
  }
  if (templates) {
    setMotionTemplates(templates);
    if (nextActiveTemplateId) setActiveTemplateId(nextActiveTemplateId);
  }
  setLastSavedAt(new Date());

  return true;
}

// ─── Hook ─────────────────────────────────────────────────────────────

interface UseSerializationOptions {
  fps: number;
  setFps: React.Dispatch<React.SetStateAction<number>>;
  totalFrames: number;
  setTotalFrames: React.Dispatch<React.SetStateAction<number>>;
  projectResolution: { width: number; height: number };
  coordinateSystem?: SceneCoordinateSystem;
  setCoordinateSystem?: React.Dispatch<React.SetStateAction<SceneCoordinateSystem>>;
  setProjectResolution: React.Dispatch<React.SetStateAction<{ width: number; height: number }>>;
  tracks: Track[];
  setTracks: React.Dispatch<React.SetStateAction<Track[]>>;
  characterParts: CharacterPart[];
  setCharacterParts: React.Dispatch<React.SetStateAction<CharacterPart[]>>;
  activeProjectTemplateId: string;
  setActiveProjectTemplateIdState: React.Dispatch<React.SetStateAction<string>>;
  motionTemplates: MotionTemplate[];
  setMotionTemplates: React.Dispatch<React.SetStateAction<MotionTemplate[]>>;
  activeTemplateId: string;
  setActiveTemplateIdState: React.Dispatch<React.SetStateAction<string>>;
  sceneTitle: string;
  setSceneTitleState: React.Dispatch<React.SetStateAction<string>>;
  setProjectTemplates: React.Dispatch<React.SetStateAction<any[]>>;
  setTemplateCanvasStore: React.Dispatch<React.SetStateAction<any>>;
  setCurrentFrame: (frame: number | ((prev: number) => number)) => void;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  /**
   * Called once after a SUCCESSFUL startup autosave restore, when its setters are
   * already in the same batch. The history authority makes the restored document
   * the new S0: the restore is initialization, never a user-undoable change.
   */
  requestHistoryBaseline?: () => void;
}

/**
 * SAFE-02: bounded wait a manual save gives the shared autosave lock before
 * its intent is reported as not completed. Interval ticks never wait.
 */
const MANUAL_SAVE_LOCK_WAIT_MS = 1_000;

/**
 * Autosave writes unsaved changes at most this long after the FIRST change
 * that is not yet saved. Further edits never push the deadline back, so
 * continuous editing cannot postpone the save indefinitely; a failed or
 * deferred attempt is retried this long after it.
 */
export const AUTOSAVE_DELAY_MS = 10_000;
/** How often the autosave deadline is checked (cheap: refs only). */
const AUTOSAVE_CHECK_INTERVAL_MS = 1_000;

/** D2: the last persistence failure, exposed so the badge can speak instead
 *  of showing a stale success. Cleared by the first write that lands. */
export type AutosavePersistenceError = { kind: 'quota' | 'unavailable'; at: number };

export type PersistenceSafety =
  | { safe: true; reason: 'clean' }
  | { safe: false; reason: 'unsaved-changes' | 'save-in-flight' | 'write-failed' | 'conflict-paused' };

const isQuotaError = (error: unknown): boolean => {
  const candidate = error as { name?: string; code?: number };
  return candidate?.name === 'QuotaExceededError'
    || candidate?.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    || candidate?.code === 22;
};

/** The part of the Web Locks API this module uses, declared structurally:
 *  environments without navigator.locks (and jsdom) fall through the guard
 *  to the documented SAFE-01 synchronous window instead. */
interface AutosaveLockLike {
  request<T>(name: string, options: { ifAvailable?: boolean; signal?: AbortSignal }, callback: (lock: { name: string } | null) => T | Promise<T>): Promise<T>;
}

const autosaveLockManager = (): AutosaveLockLike | null => {
  const locks = (navigator as unknown as { locks?: { request?: unknown } }).locks;
  return typeof locks?.request === 'function' ? (locks as unknown as AutosaveLockLike) : null;
};

/**
 * The serialization hook's public surface. Exported so consumers (and tests that
 * have to hold a rendered hook's value) name the contract instead of deriving it
 * from the implementation.
 */
export interface UseSerializationApi {
  lastSavedAt: Date | null;
  /**
   * True while the project currently on screen is the autosave this browser
   * restored at startup. It is cleared by anything that replaces the document
   * (an import or a reset), so the header can tell a restored local cache
   * apart from a freshly authored or imported project.
   */
  restoredFromLocalStorage: boolean;
  /**
   * SAFE-01: true once another writer is detected to have changed the shared
   * autosave storage outside this tab. Unsafe background and manual writes
   * are then paused until reload, so a foreign document is never silently
   * overwritten; the header surfaces the pause and the user can export or
   * reload to adopt the external document.
   */
  autosaveConflict: boolean;
  /**
   * SAFE-02: wall-clock timestamp of the last manual save whose bounded Web
   * Lock wait expired, or null when none needs attention. A deferred save is
   * NOT a conflict pause: the edits are kept and the next autosave tick
   * retries; the header surfaces exactly one notice per event.
   */
  manualSaveRejectedAt: number | null;
  autosaveError: AutosavePersistenceError | null;
  /**
   * True while the document on screen differs from the last document this tab
   * saved (or settled to at boot / import / reset). Cleared only by a write
   * that actually succeeded, or when the document returns to that state.
   */
  hasUnsavedChanges: boolean;
  /** True while a save is in flight (waiting for or holding the write lock). */
  isSaving: boolean;
  triggerManualSave: () => void;
  /**
   * Point-in-time persistence verdict for destructive navigation decisions
   * (the GIF chunk-reload recovery). Computed from refs and the current
   * serialization, never a boolean guess: `safe` is true only when nothing
   * is in flight, no conflict pause is latched, no write has failed and the
   * screen document is exactly what the last landed write covered.
   */
  getPersistenceSafety: () => PersistenceSafety;
  /**
   * One forced durable write through the existing SAFE-01/02 critical section,
   * for callers that must know the outcome before a destructive action.
   * Resolves true only when the shared key actually advanced.
   */
  forceSaveNow: () => Promise<boolean>;
  exportProject: () => string;
  importProject: (jsonStr: string, defaultName?: string) => ImportResult;
  resetProject: () => void;
  migrateLegacyCoordinates: () => boolean;
}

export const useSerialization = ({
  fps,
  setFps,
  totalFrames,
  setTotalFrames,
  projectResolution,
  coordinateSystem = DEFAULT_SCENE_COORDINATE_SYSTEM,
  setCoordinateSystem = noopSetCoordinateSystem,
  setProjectResolution,
  tracks,
  setTracks,
  characterParts,
  setCharacterParts,
  activeProjectTemplateId,
  setActiveProjectTemplateIdState,
  motionTemplates,
  setMotionTemplates,
  activeTemplateId,
  setActiveTemplateIdState,
  sceneTitle,
  setSceneTitleState,
  setProjectTemplates,
  setTemplateCanvasStore,
  setCurrentFrame,
  setIsPlaying,
  requestHistoryBaseline = noopRequestHistoryBaseline,
}: UseSerializationOptions): UseSerializationApi => {
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const [restoredFromLocalStorage, setRestoredFromLocalStorage] = useState<boolean>(false);

  // SAFE-02: bumped when a queued reset finalizes outside a render
  // commit, so the settle effect re-runs for the post-reset document exactly
  // like the synchronous fallback does (adopted ownership must not wait for
  // the next unrelated state change to capture its baseline).
  const [settleEpoch, setSettleEpoch] = useState(0);

  // SAFE-01 — cross-tab write discipline. storageKnownRef holds the exact
  // string this tab last READ at boot (a refused/corrupted value included:
  // "whatever was there") or last WROTE itself: every attempted save compares
  // the live key against it — optimistic concurrency, because localStorage
  // offers no atomic compare-and-swap (the one-synchronous-block getItem →
  // setItem window is the documented residual race). settledSaveRef is the
   // serialized document this tab's state settled to at boot or after its last
  // save: equality with the next candidate means the session is idle and is
  // granted NO write (K1 empty-tab / K2 stale-tab / K3 idle churn). A
  // detected conflict latches autosavePausedRef: nothing writes until reload.
  const [autosaveConflict, setAutosaveConflict] = useState<boolean>(false);
  const storageKnownRef = useRef<string | null>(null);
  const settledSaveRef = useRef<string | null>(null);
  const autosavePausedRef = useRef<boolean>(false);
  const restoreDecidedRef = useRef<boolean>(false);
  const restoreAppliedRef = useRef<boolean>(false);

  // SAFE-02 — the SAFE-01 read-compare-write runs as one critical section
  // inside the Web Lock named after the guarded key. manualPendingRef keeps a
  // single queued manual intent (the grant re-reads state, so the pending
  // save always writes the LATEST document — extra clicks add nothing);
  // manualAbortRef can cancel a queued wait; unmountedRef stops any late
  // continuation from touching state or notifications.
  const [manualSaveRejectedAt, setManualSaveRejectedAt] = useState<number | null>(null);
  const [autosaveError, setAutosaveError] = useState<AutosavePersistenceError | null>(null);
  const manualPendingRef = useRef<boolean>(false);
  /** When the first not-yet-saved change happened (null = nothing unsaved). */
  const unsavedSinceRef = useRef<number | null>(null);
  /** When the next autosave attempt is due. */
  const nextAttemptAtRef = useRef<number>(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const clearUnsaved = useCallback(() => {
    unsavedSinceRef.current = null;
    setHasUnsavedChanges(false);
  }, []);
  const manualAbortRef = useRef<AbortController | null>(null);
  const unmountedRef = useRef<boolean>(false);

  // 1. Initial Load: Restore from LocalStorage (SceneData v1 or legacy AnimationProject)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(AUTOSAVE_STORAGE_KEY);
      // Whatever is in the key at boot — applied, refused, or absent — is what
      // this tab last observed; every later write compares against it (SAFE-01).
      storageKnownRef.current = saved;
      restoreDecidedRef.current = true;
      if (!saved) return;
      // The autosave payload goes through the same boundary as an imported
      // document: a corrupted or tampered entry is reported and skipped
      // instead of being applied, and the defaults stay in place.
      const validation = validateImportedDocument(saved);
      if (!validation.ok) {
        console.warn('[Storage] Autosave restore refused:', validation.diagnostics[0]?.code, validation.diagnostics[0]?.message);
        return;
      }

      if (validation.document.kind === 'scene') {
        const scene = validation.document.scene;
        const applied = fromSceneData(scene, scene.name || '', setCharacterParts, setTracks, setFps, setTotalFrames, setProjectResolution, setCoordinateSystem, setLastSavedAt, setSceneTitleState, setMotionTemplates, setActiveTemplateIdState);
        if (applied) {
          // oxlint-disable-next-line react/set-state-in-effect -- startup restore is a one-shot sync with storage
          setRestoredFromLocalStorage(true);
          // N1: the restored scene is the baseline, not an undoable edit.
          requestHistoryBaseline();
          restoreAppliedRef.current = true;
        }
        return;
      }

      // Legacy AnimationProject format (backward compat)
      const parsed = validation.document.project;
      const hasLegacyStickman = parsed.characterParts.some((part) => (part as { type?: unknown }).type === 'head' || (part as { type?: unknown }).type === 'torso');
      const legacyMotionTemplates = readMotionTemplates(parsed.motionTemplates);
      if (hasLegacyStickman) {
        localStorage.removeItem(AUTOSAVE_STORAGE_KEY);
        // This tab legitimately deleted the key; that deletion is its own last-known write.
        storageKnownRef.current = null;
        return;
      }
      const savedResolution = readProjectResolution(parsed.projectResolution);
      const migratedTracks = parsed.tracks.map(migrateTrack);
      const savedFps = readOptionalNumber(parsed.fps);
      const savedTotalFrames = readOptionalNumber(parsed.totalFrames);
      const savedAt = readOptionalDate(parsed.lastSavedTime);
      // The id sweep and the counter init read the same boundary fields the
      // setters below queue. They run FIRST, mirroring `fromSceneData`: every
      // derivable throw happens while the live document is still untouched,
      // so a failed restore mutates nothing and never requests a baseline.
      const allIds: string[] = [];
      parsed.characterParts.forEach((p) => allIds.push(p.id));
      parsed.tracks.forEach((t) => {
        allIds.push(t.id);
        t.keyframes?.forEach((k) => allIds.push(k.id));
        if (t.channels) {
          Object.values(t.channels).forEach((channel) => channel?.forEach((pk) => allIds.push(pk.id)));
        }
      });
      for (const template of legacyMotionTemplates ?? []) {
        allIds.push(template.id);
      }
      initializeIdCounter(allIds);
      // From here to the baseline request the block is pure setter dispatch:
      // a successful legacy startup restore is all-or-nothing (N1), and the
      // baseline request is the final statement of the success path.
      if (savedResolution) setProjectResolution(savedResolution);
      setTracks(migratedTracks);
      setCharacterParts(parsed.characterParts);
      if (savedFps !== undefined) setFps(savedFps);
      if (savedTotalFrames !== undefined) setTotalFrames(savedTotalFrames);
      // Autosave restoration synchronizes React state with persisted storage.
      // oxlint-disable-next-line react/set-state-in-effect
      setLastSavedAt(savedAt ?? new Date());
      // oxlint-disable-next-line react/set-state-in-effect -- startup restore is a one-shot sync with storage
      setRestoredFromLocalStorage(true);
      // N1: the restored legacy scene is the baseline, not an undoable edit.
      requestHistoryBaseline();
      restoreAppliedRef.current = true;
    } catch (e) {
      console.warn('[AutoSave] Failed to restore saved state', e);
    }
  }, [setTotalFrames, setProjectResolution, setTracks, setCharacterParts, setFps, setCoordinateSystem, setSceneTitleState, setMotionTemplates, setActiveTemplateIdState, requestHistoryBaseline]);

  // 2. Auto-Save: SceneData format, at most AUTOSAVE_DELAY_MS after the first unsaved change (SAFE-01 write discipline).
  const buildSceneJson = useCallback((): string => {
    const scene = toSceneData(characterParts, tracks, fps, totalFrames, projectResolution, coordinateSystem, sceneTitle, motionTemplates, activeTemplateId);
    scene.name = sceneTitle || 'Untitled';
    return JSON.stringify(scene);
  }, [characterParts, tracks, fps, totalFrames, projectResolution, coordinateSystem, sceneTitle, motionTemplates, activeTemplateId]);

  /**
   * SAFE-01: capture the document THIS TAB WAS GIVEN as its idle baseline.
   * Runs after the mount effect and, when a restore was applied, after that
   * restore's state commit (signalled by restoredFromLocalStorage) — always
   * before any user edit is possible, so an edit made in the first seconds of
   * a session is correctly dirty and earns its next save (unlike a
   * first-tick capture, which absorbed early edits into the baseline).
   */
  useEffect(() => {
    if (settledSaveRef.current !== null || !restoreDecidedRef.current) return;
    if (restoreAppliedRef.current && !restoredFromLocalStorage) return;
    settledSaveRef.current = buildSceneJson();
    clearUnsaved();
  }, [restoredFromLocalStorage, buildSceneJson, settleEpoch, clearUnsaved]);

  /**
   * The first change after a save (or after the boot document settled) starts
   * the autosave deadline. Later changes leave it alone, so the document is
   * serialized here once per save cycle, not on every edit of a drag.
   */
  useEffect(() => {
    if (settledSaveRef.current === null || unsavedSinceRef.current !== null) return;
    // A document that cannot be serialized right now is treated as changed: the
    // save attempt reports it, and a render effect must never throw.
    let same = false;
    try {
      same = buildSceneJson() === settledSaveRef.current;
    } catch {
      same = false;
    }
    if (same) return;
    const now = Date.now();
    unsavedSinceRef.current = now;
    nextAttemptAtRef.current = now + AUTOSAVE_DELAY_MS;
    // The document changed: the header must say so (an external, committed edit).
    // oxlint-disable-next-line react/set-state-in-effect
    setHasUnsavedChanges(true);
  }, [buildSceneJson]);

  /**
   * SAFE-01 read-compare-write as one callable so SAFE-02 can run the whole
   * critical section — candidate serialization, conflict pause and write —
   * inside a single lock grant (or synchronously, as the documented fallback,
   * where Web Locks are unavailable). Returns true only when this call wrote
   * the key; every refusal is already reported by the side it belongs to.
   */
  const casWrite = useCallback((force: boolean): boolean => {
    const nextJson = buildSceneJson();
    if (!force && nextJson === settledSaveRef.current) return false;
    let currentStored: string | null;
    try {
      currentStored = localStorage.getItem(AUTOSAVE_STORAGE_KEY);
    } catch (e) {
      // Storage unreadable: honest no-op. Tokens untouched, retried next tick.
      setAutosaveError((previous) => previous ?? { kind: 'unavailable', at: Date.now() });
      console.error('[AutoSave] Storage unreadable; the save is deferred', e);
      return false;
    }
    if (currentStored !== storageKnownRef.current) {
      // The shared key changed outside this tab since its last read or write:
      // PAUSE rather than silently overwriting the other session's document.
      autosavePausedRef.current = true;
      setAutosaveConflict(true);
      console.warn('[AutoSave] Paused: the shared project was changed outside this tab. Reload to adopt it, or export this tab to keep its work.');
      return false;
    }
    try {
      localStorage.setItem(AUTOSAVE_STORAGE_KEY, nextJson);
      storageKnownRef.current = nextJson;
      settledSaveRef.current = nextJson;
      setLastSavedAt(new Date());
      setAutosaveError(null);
      clearUnsaved();
      return true;
    } catch (e) {
      // Honest failure: neither lastSavedAt nor the write tokens advance, and
      // the badge reports the failure instead of a stale success.
      setAutosaveError((previous) => previous ?? { kind: isQuotaError(e) ? 'quota' : 'unavailable', at: Date.now() });
      console.error('[AutoSave] Failed to save project to LocalStorage', e);
      return false;
    }
  }, [buildSceneJson, clearUnsaved]);

  type LockRunOutcome<T> = { ran: boolean; value?: T };

  /** Run `task` with the autosave lock held, in exactly one grant. 'try' gives
   *  up immediately while another writer holds the lock (the interval tick
   *  defers; nothing advances); 'queue' waits FIFO for the grant and honors
   *  `signal`. Without Web Locks support the task runs directly — the same
   *  single synchronous block SAFE-01 documented as the residual race. */
  const runWithAutosaveLock = useCallback(async <T>(task: () => T, mode: 'try' | 'queue', signal?: AbortSignal): Promise<LockRunOutcome<T>> => {
    const manager = autosaveLockManager();
    if (!manager) return { ran: true, value: task() };
    if (mode === 'try') {
      return manager.request(AUTOSAVE_LOCK_NAME, { ifAvailable: true }, (lock) => (
        lock ? { ran: true, value: task() } : { ran: false }
      ));
    }
    return { ran: true, value: await manager.request(AUTOSAVE_LOCK_NAME, { signal }, () => task()) };
  }, []);

  const performSave = useCallback((): void => {
    if (autosavePausedRef.current) return;
    // The settle effect has not captured the boot document yet (same-commit
    // window): nothing is dirty yet either, so no write is owed.
    if (settledSaveRef.current === null) return;
    // The document went back to what is saved (an undo): nothing is owed.
    // Cheap pre-check outside the grant; the authoritative comparison re-runs
    // inside it.
    if (buildSceneJson() === settledSaveRef.current) {
      clearUnsaved();
      return;
    }
    // Whatever the outcome, the next attempt is one delay away: a success
    // clears the unsaved state; a failure, a busy lock (SAFE-02: never a queue
    // behind another writer) or a rejected lock call keeps it and retries.
    nextAttemptAtRef.current = Date.now() + AUTOSAVE_DELAY_MS;
    setIsSaving(true);
    void runWithAutosaveLock(() => casWrite(false), 'try')
      .catch(() => undefined)
      .finally(() => {
        if (!unmountedRef.current) setIsSaving(false);
      });
  }, [buildSceneJson, casWrite, clearUnsaved, runWithAutosaveLock]);

  // One stable clock (it is never re-created by edits, which used to restart a
  // 10 s interval on every change and postpone the save while the user kept
  // editing). It only reads refs; the save runs when the deadline is due.
  const performSaveRef = useRef(performSave);
  useEffect(() => {
    performSaveRef.current = performSave;
  }, [performSave]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (unsavedSinceRef.current === null || Date.now() < nextAttemptAtRef.current) return;
      performSaveRef.current();
    }, AUTOSAVE_CHECK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  const triggerManualSave = useCallback((): void => {
    // Explicit intent: writes an unchanged document too, but never across a
    // conflict pause or before the boot document has settled (SAFE-01).
    if (autosavePausedRef.current) return;
    if (settledSaveRef.current === null) return;
    // One queued intent at a time: the grant re-serializes the state, so the
    // pending save already carries the latest document (SAFE-02).
    if (manualPendingRef.current) return;
    const controller = new AbortController();
    manualPendingRef.current = true;
    manualAbortRef.current = controller;
    setIsSaving(true);
    void (async () => {
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, MANUAL_SAVE_LOCK_WAIT_MS);
      const outcome = await runWithAutosaveLock(() => casWrite(true), 'queue', controller.signal).catch(() => null);
      clearTimeout(timer);
      if (manualAbortRef.current === controller) manualPendingRef.current = false;
      if (unmountedRef.current) return;
      setIsSaving(false);
      if (timedOut && outcome === null) setManualSaveRejectedAt(Date.now());
    })();
  }, [casWrite, runWithAutosaveLock]);

  // SAFE-02: a late continuation after unmount must not touch state, notify,
  // or (worse) write: drop the queued manual intent at the boundary.
  useEffect(() => {
    // StrictMode remounts effects in dev: the flag must be re-armed at setup,
    // or a cleanup from the discarded first mount poisons the live session.
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      manualAbortRef.current?.abort();
      manualPendingRef.current = false;
    };
  }, []);

  /**
   * SAFE-01: import and reset are EXPLICIT document replacements — the user's
   * intent is to own whatever the shared key holds. Re-observe the key right
   * now (so the next save compares against reality, not the boot value), lift
   * any previous conflict pause, and hand the fresh document to the settle
   * capture. Passing the known value explicitly covers reset's own removal.
   */
  const adoptOwnershipAfterReplacement = useCallback((adoptedKnown?: string | null) => {
    if (adoptedKnown === undefined) {
      try {
        storageKnownRef.current = localStorage.getItem(AUTOSAVE_STORAGE_KEY);
      } catch {
        storageKnownRef.current = null;
      }
    } else {
      storageKnownRef.current = adoptedKnown;
    }
    settledSaveRef.current = null;
    clearUnsaved();
    restoreAppliedRef.current = false;
    autosavePausedRef.current = false;
    setAutosaveConflict(false);
  }, [clearUnsaved]);

  // 3. Export: SceneData format (canonical, version 1)
  const exportProject = useCallback((): string => {
    const scene = toSceneData(characterParts, tracks, fps, totalFrames, projectResolution, coordinateSystem, sceneTitle, motionTemplates, activeTemplateId);
    scene.name = sceneTitle || 'Template';
    return JSON.stringify(scene, null, 2);
  }, [characterParts, tracks, fps, totalFrames, projectResolution, coordinateSystem, sceneTitle, motionTemplates, activeTemplateId]);

  // 4. Import: one validated boundary for both document kinds
  const importProject = useCallback((jsonStr: string, defaultName?: string): ImportResult => {
    const validation = validateImportedDocument(jsonStr);
    if (!validation.ok) return { ok: false, diagnostics: validation.diagnostics };

    try {
      if (validation.document.kind === 'scene') {
        const scene = validation.document.scene;
        const imported = fromSceneData(scene, defaultName || scene.name || '', setCharacterParts, setTracks, setFps, setTotalFrames, setProjectResolution, setCoordinateSystem, setLastSavedAt, setSceneTitleState, setMotionTemplates, setActiveTemplateIdState);
        // A document the user imported is no longer "the autosave this browser
        // restored at startup", whatever the apply outcome was.
        setRestoredFromLocalStorage(false);
        adoptOwnershipAfterReplacement();
        return { ok: imported, diagnostics: validation.diagnostics };
      }

      // Legacy AnimationProject format (backward compat)
      const parsed = validation.document.project;
      {
        const rawName = defaultName || readOptionalString(parsed.sceneTitle) || readOptionalString(parsed.name) || 'Imported Template';
        const templateName = rawName.replace(/\.json$/i, '').trim() || 'Imported Template';
        const newId = `tmpl_${Date.now()}`;

        const declaredCoordinateSystem = isSceneCoordinateSystem(parsed.coordinateSystem) ? parsed.coordinateSystem : DEFAULT_SCENE_COORDINATE_SYSTEM;
        const declaredTemplates = readMotionTemplates(parsed.motionTemplates);
        const importedMotionTemplates = normalizeMotionTemplates(declaredTemplates ?? DEFAULT_MOTION_TEMPLATES);

        const initialSeqId = importedMotionTemplates[0].id;
        const importedTracks = parsed.tracks.map(migrateTrack);
        const importedParts = parsed.characterParts;

        setTemplateCanvasStore((prev: any) => ({
          ...prev,
          [activeProjectTemplateId]: { characterParts, tracks, motionTemplates, activeTemplateId, coordinateSystem },
          [newId]: { characterParts: importedParts, tracks: importedTracks, motionTemplates: importedMotionTemplates, activeTemplateId: initialSeqId, coordinateSystem: declaredCoordinateSystem },
        }));

        setProjectTemplates((prev: any) => [...prev, { id: newId, name: templateName }]);
        setCharacterParts(importedParts);
        setTracks(importedTracks);
        setMotionTemplates(importedMotionTemplates);
        const declaredActiveTemplateId = readOptionalString(parsed.activeTemplateId);
        setActiveTemplateIdState(declaredActiveTemplateId && importedMotionTemplates.some((template) => template.id === declaredActiveTemplateId)
          ? declaredActiveTemplateId
          : initialSeqId);
        setActiveProjectTemplateIdState(newId);
        setSceneTitleState(templateName);

        const declaredResolution = readProjectResolution(parsed.projectResolution);
        if (declaredResolution) setProjectResolution(declaredResolution);
        setCoordinateSystem(DEFAULT_SCENE_COORDINATE_SYSTEM);
        const declaredFps = readOptionalNumber(parsed.fps);
        if (declaredFps !== undefined) setFps(declaredFps);
        const declaredTotalFrames = readOptionalNumber(parsed.totalFrames);
        if (declaredTotalFrames !== undefined) setTotalFrames(declaredTotalFrames);

        setRestoredFromLocalStorage(false);
        adoptOwnershipAfterReplacement();
        return { ok: true, diagnostics: validation.diagnostics };
      }
    } catch {
      return { ok: false, diagnostics: [{ code: 'KCS_IMPORT_FAILED', severity: 'error', feature: 'project-import', path: '$', message: 'The document passed validation but could not be applied.', action: 'Re-export the project and import it again.' }] };
    }
  }, [activeProjectTemplateId, characterParts, tracks, motionTemplates, activeTemplateId, coordinateSystem, setProjectResolution, setCoordinateSystem, setTracks, setCharacterParts, setFps, setTotalFrames, setTemplateCanvasStore, setProjectTemplates, setMotionTemplates, setActiveTemplateIdState, setActiveProjectTemplateIdState, setSceneTitleState, adoptOwnershipAfterReplacement]);

  const resetProject = useCallback(() => {
    setTracks(DEFAULT_TRACKS);
    setCharacterParts(DEFAULT_CHARACTER_PARTS);
    setCurrentFrame(0);
    setIsPlaying(false);
    setCoordinateSystem('project-unit-center-v1');
    // SAFE-02: removal of the key joins the same critical section as saves,
    // so a concurrent tab's write can neither slip between the reset tabs
    // intent and the deletion, nor be clobbered by a reset-time snapshot.
    // Synchronous fallback where Web Locks are unavailable (SAFE-01).
    const manager = autosaveLockManager();
    const removeAutosaveKey = (): boolean => {
      try {
        localStorage.removeItem(AUTOSAVE_STORAGE_KEY);
        return true;
      } catch (e) {
        console.warn('[Storage] Could not clear autosave key:', e);
        // The reset tab is the legitimate deleter that tried: with removal
        // refused, ownership still re-observes reality below (SAFE-01 parity).
        return false;
      }
    };
    const finalizeReset = (): void => {
      // The reset tab is the legitimate deleter of the key: the cleared state
      // is its own last-known value, and the default document it now shows
      // settles without an idle write until the next user action earns one
      // (SAFE-01). An earlier conflict pause is lifted — the user deliberately
      // replaced it.
      adoptOwnershipAfterReplacement(null);
      setLastSavedAt(null);
      setRestoredFromLocalStorage(false);
      setSettleEpoch((epoch) => epoch + 1);
    };
    if (!manager) {
      removeAutosaveKey();
      finalizeReset();
      return;
    }
    manualAbortRef.current?.abort();
    manualPendingRef.current = false;
    const controller = new AbortController();
    manualAbortRef.current = controller;
    void (async () => {
      // No bounded wait: reset queues its removal without a deadline (a
      // replaced document must never be resurrected by a skipped removal).
      // Finalization is idempotent, so a superseded reset still lands safe.
      await runWithAutosaveLock(() => removeAutosaveKey(), 'queue', controller.signal).catch(() => undefined);
      if (unmountedRef.current) return;
      finalizeReset();
    })();
  }, [setTracks, setCharacterParts, setCurrentFrame, setIsPlaying, setCoordinateSystem, adoptOwnershipAfterReplacement, runWithAutosaveLock]);

  /**
   * Explicitly opt a legacy-centi scene into the project-unit contract.
   * Unknown legacy data is deliberately not guessed or rewritten.
   */
  const migrateLegacyCoordinates = useCallback((): boolean => {
    if (coordinateSystem !== 'legacy-centi-unit') return false;
    const source = toSceneData(characterParts, tracks, fps, totalFrames, projectResolution, coordinateSystem, sceneTitle, motionTemplates, activeTemplateId);
    const migrated = migrateSceneCoordinates(source, 'project-unit-center-v1');
    const layersById = new Map(migrated.layers.map(layer => [layer.id, layer]));
    const nextParts = characterParts.map(part => {
      const layer = layersById.get(part.id);
      return layer ? { ...part, baseTransform: { ...part.baseTransform, x: layer.x, y: layer.y } } : part;
    });
    const nextTracks = tracks.map(track => {
      const migratedTrack = migrated.tracks.find(candidate => candidate.partId === track.partId);
      if (!migratedTrack) return track;
      const channels = { ...track.channels };
      for (const channel of ['x', 'y'] as const) {
        const values = migratedTrack.channels[channel];
        if (values) channels[channel] = values;
      }
      const keyframes = (track.keyframes || []).map(keyframe => {
        const legacy = keyframe.transform;
        return { ...keyframe, transform: { ...legacy, x: legacy.x * 100, y: legacy.y * 100 } };
      });
      return { ...track, channels, keyframes };
    });
    setCharacterParts(nextParts);
    setTracks(nextTracks);
    setTemplateCanvasStore((prev: any) => ({
      ...prev,
      [activeProjectTemplateId]: {
        characterParts: nextParts,
        tracks: nextTracks,
        motionTemplates,
        activeTemplateId,
        coordinateSystem: 'project-unit-center-v1',
      },
    }));
    setCoordinateSystem('project-unit-center-v1');
    return true;
  }, [activeProjectTemplateId, activeTemplateId, characterParts, coordinateSystem, fps, motionTemplates, projectResolution, sceneTitle, setCharacterParts, setCoordinateSystem, setTemplateCanvasStore, setTracks, totalFrames, tracks]);

  // A1: single synchronous verdict for destructive-navigation callers. All
  // state lives in refs set synchronously by the write path, so this is a
  // point-in-time fact, not a render-time approximation.
  const getPersistenceSafety = useCallback((): PersistenceSafety => {
    if (autosavePausedRef.current) return { safe: false, reason: 'conflict-paused' };
    if (manualPendingRef.current) return { safe: false, reason: 'save-in-flight' };
    if (autosaveError !== null) return { safe: false, reason: 'write-failed' };
    try {
      if (buildSceneJson() !== settledSaveRef.current) return { safe: false, reason: 'unsaved-changes' };
    } catch {
      return { safe: false, reason: 'write-failed' };
    }
    return { safe: true, reason: 'clean' };
  }, [buildSceneJson, autosaveError]);

  // A1: one forced durable write through the existing SAFE-01/02 critical
  // section; resolves true only when the key actually advanced (casWrite's
  // own honest contract).
  const forceSaveNow = useCallback(async (): Promise<boolean> => {
    if (autosavePausedRef.current) return false;
    const outcome = await runWithAutosaveLock(() => casWrite(true), 'queue').catch(() => null);
    return Boolean(outcome?.ran && outcome.value === true);
  }, [casWrite, runWithAutosaveLock]);

  return {
    lastSavedAt,
    restoredFromLocalStorage,
    autosaveConflict,
    manualSaveRejectedAt,
    autosaveError,
    hasUnsavedChanges,
    isSaving,
    triggerManualSave,
    getPersistenceSafety,
    forceSaveNow,
    exportProject,
    importProject,
    resetProject,
    migrateLegacyCoordinates,
  };
};
