import { useState, useEffect, useCallback } from 'react';
import type { AnimationTrackData, CharacterPart, Track, MotionTemplate, PropertyKeyframe } from '../types/animator';
import type { PersistedTrackState, SceneCoordinateSystem, SceneData, SceneLayer } from '../types/composition';
import { initializeIdCounter } from '../utils/idGenerator';
import { makeEmptyChannels, DEFAULT_TRACKS, DEFAULT_CHARACTER_PARTS } from '../utils/defaults';
import { convertLegacyKeyframesToChannels } from '../utils/legacyKeyframeConversion';
import { AUTOSAVE_STORAGE_KEY, DEFAULT_MOTION_TEMPLATES } from '../utils/constants';
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
import { validateImportedDocument, type ImportResult } from '../utils/importValidation';
const noopSetCoordinateSystem: React.Dispatch<React.SetStateAction<SceneCoordinateSystem>> = () => undefined;

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
    booleanGroupId: p.booleanGroupId,
    booleanOperation: p.booleanOperation,
    booleanOperandIds: p.booleanOperandIds,
    booleanContours: p.booleanContours,
    visible: true,
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
    width: p.width,
    height: p.height,
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
  const animTracks: (AnimationTrackData & PersistedTrackState)[] = tracks.map(t => {
    const hasChannelData = !!t.channels && Object.values(t.channels).some((arr) => arr.length > 0);
    const channels = hasChannelData
      ? (t.channels || {})
      : convertLegacyKeyframesToChannels(t.keyframes || []);
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
    version: 2,
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
    matte: l.matte,
    masks: l.masks,
    trackMatte: l.trackMatte,
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
    width: l.width,
    height: l.height,
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
      channels: ((t.channels && Object.values(t.channels).some((arr) => arr.length > 0))
        ? t.channels
        : convertLegacyKeyframesToChannels(t.keyframes || [])) as Track['channels'],
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
}: UseSerializationOptions) => {
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // 1. Initial Load: Restore from LocalStorage (SceneData v1 or legacy AnimationProject)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(AUTOSAVE_STORAGE_KEY);
      if (saved) {
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
          fromSceneData(scene, scene.name || '', setCharacterParts, setTracks, setFps, setTotalFrames, setProjectResolution, setCoordinateSystem, setLastSavedAt, setSceneTitleState, setMotionTemplates, setActiveTemplateIdState);
          return;
        }

        // Legacy AnimationProject format (backward compat)
        const parsed = validation.document.project;
        const hasLegacyStickman = parsed.characterParts.some((part) => (part as { type?: unknown }).type === 'head' || (part as { type?: unknown }).type === 'torso');
        const legacyMotionTemplates = readMotionTemplates(parsed.motionTemplates);
        if (!hasLegacyStickman) {
          const savedResolution = readProjectResolution(parsed.projectResolution);
          if (savedResolution) setProjectResolution(savedResolution);
          setTracks(parsed.tracks.map(migrateTrack));
          setCharacterParts(parsed.characterParts);
          const savedFps = readOptionalNumber(parsed.fps);
          if (savedFps !== undefined) setFps(savedFps);
          const savedTotalFrames = readOptionalNumber(parsed.totalFrames);
          if (savedTotalFrames !== undefined) setTotalFrames(savedTotalFrames);
          const savedAt = readOptionalDate(parsed.lastSavedTime);
          setLastSavedAt(savedAt ?? new Date());

          const allIds: string[] = [];
          parsed.characterParts.forEach((p: any) => allIds.push(p.id));
          parsed.tracks.forEach((t: any) => {
            allIds.push(t.id);
            t.keyframes?.forEach((k: any) => allIds.push(k.id));
            if (t.channels) {
              Object.values(t.channels).forEach((ch: any) => (ch as any[])?.forEach((pk: any) => allIds.push(pk.id)));
            }
          });
          for (const template of legacyMotionTemplates ?? []) {
            allIds.push(template.id);
          }
          initializeIdCounter(allIds);
        } else {
          localStorage.removeItem(AUTOSAVE_STORAGE_KEY);
        }
      }
    } catch (e) {
      console.warn('[AutoSave] Failed to restore saved state', e);
    }
  }, [setTotalFrames, setProjectResolution, setTracks, setCharacterParts, setFps, setCoordinateSystem, setSceneTitleState, setMotionTemplates, setActiveTemplateIdState]);

  // 2. Auto-Save: SceneData format every 10 seconds
  const performSave = useCallback(() => {
    try {
      const scene = toSceneData(characterParts, tracks, fps, totalFrames, projectResolution, coordinateSystem, sceneTitle, motionTemplates, activeTemplateId);
      scene.name = sceneTitle || 'Untitled';
      localStorage.setItem(AUTOSAVE_STORAGE_KEY, JSON.stringify(scene));
      setLastSavedAt(new Date());
    } catch (e) {
      console.error('[AutoSave] Failed to save project to LocalStorage', e);
    }
  }, [characterParts, tracks, fps, totalFrames, projectResolution, coordinateSystem, sceneTitle, motionTemplates, activeTemplateId]);

  useEffect(() => {
    const timer = setInterval(() => {
      performSave();
    }, 10000);
    return () => clearInterval(timer);
  }, [performSave]);

  const triggerManualSave = useCallback(() => {
    performSave();
  }, [performSave]);

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

        return { ok: true, diagnostics: validation.diagnostics };
      }
    } catch {
      return { ok: false, diagnostics: [{ code: 'KCS_IMPORT_FAILED', severity: 'error', feature: 'project-import', path: '$', message: 'The document passed validation but could not be applied.', action: 'Re-export the project and import it again.' }] };
    }
  }, [activeProjectTemplateId, characterParts, tracks, motionTemplates, activeTemplateId, coordinateSystem, setProjectResolution, setCoordinateSystem, setTracks, setCharacterParts, setFps, setTotalFrames, setTemplateCanvasStore, setProjectTemplates, setMotionTemplates, setActiveTemplateIdState, setActiveProjectTemplateIdState, setSceneTitleState]);

  const resetProject = useCallback(() => {
    setTracks(DEFAULT_TRACKS);
    setCharacterParts(DEFAULT_CHARACTER_PARTS);
    setCurrentFrame(0);
    setIsPlaying(false);
    setCoordinateSystem('project-unit-center-v1');
    try {
      localStorage.removeItem(AUTOSAVE_STORAGE_KEY);
    } catch (e) {
      console.warn('[Storage] Could not clear autosave key:', e);
    }
    setLastSavedAt(null);
  }, [setTracks, setCharacterParts, setCurrentFrame, setIsPlaying, setCoordinateSystem]);

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

  return {
    lastSavedAt,
    triggerManualSave,
    exportProject,
    importProject,
    resetProject,
    migrateLegacyCoordinates,
  };
};
