import { useState, useEffect, useCallback } from 'react';
import type { AnimationTrackData, CharacterPart, Track, MotionTemplate, PropertyKeyframe } from '../types/animator';
import type { SceneData, SceneLayer } from '../types/composition';
import { initializeIdCounter } from '../utils/idGenerator';
import { makeEmptyChannels, DEFAULT_TRACKS, DEFAULT_CHARACTER_PARTS } from '../utils/defaults';
import { convertLegacyKeyframesToChannels } from '../utils/legacyKeyframeConversion';
import { AUTOSAVE_STORAGE_KEY, DEFAULT_MOTION_TEMPLATES } from '../utils/constants';

/** Ensure legacy tracks (without channels) get empty channels injected */
function migrateTrack(t: Track): Track {
  return {
    ...t,
    channels: t.channels ?? makeEmptyChannels(),
    expanded: t.expanded ?? false,
    editVisible: t.editVisible ?? true,
  };
}

// ─── Phase 3: SceneData ↔ AnimationProject conversion ───────────────

/**
 * Export current state to canonical SceneData format (version 1).
 */
function toSceneData(
  characterParts: CharacterPart[],
  tracks: Track[],
  fps: number,
  totalFrames: number,
  projectResolution: { width: number; height: number },
  _sceneTitle: string,
): SceneData {
  const layers: SceneLayer[] = characterParts.map(p => ({
    id: p.id,
    name: p.name,
    type: p.type,
    x: p.baseTransform.x,
    y: p.baseTransform.y,
    rotation: p.baseTransform.rotation,
    scaleX: p.baseTransform.scaleX,
    scaleY: p.baseTransform.scaleY,
    opacity: p.baseTransform.opacity,
    parentId: p.parentId,
    visible: true,
    zIndex: p.zIndex,
    fillColor: p.fillColor,
    strokeColor: p.strokeColor,
    strokeWidth: p.strokeWidth,
    borderRadius: p.borderRadius,
    width: p.width,
    height: p.height,
    points: p.points,
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
  const animTracks: AnimationTrackData[] = tracks.map(t => {
    const hasChannelData = !!t.channels && Object.values(t.channels).some((arr) => arr.length > 0);
    const channels = hasChannelData
      ? (t.channels || {})
      : convertLegacyKeyframesToChannels(t.keyframes || []);
    return {
      partId: t.partId,
      channels: channels as Record<string, PropertyKeyframe[]>,
      sequencerTemplateId: t.sequencerTemplateId,
    };
  });

  return {
    version: 1,
    width: projectResolution.width,
    height: projectResolution.height,
    fps,
    totalFrames,
    layers,
    tracks: animTracks,
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
  setLastSavedAt: React.Dispatch<React.SetStateAction<Date | null>>,
  setSceneTitle: React.Dispatch<React.SetStateAction<string>>,
  setMotionTemplates: React.Dispatch<React.SetStateAction<MotionTemplate[]>>,
): boolean {
  const parts: CharacterPart[] = scene.layers.map(l => ({
    id: l.id,
    name: l.name,
    type: l.type as any,
    zIndex: l.zIndex,
    fillColor: l.fillColor,
    strokeColor: l.strokeColor,
    pivot: { x: 0, y: 0 },
    parentId: l.parentId,
    baseTransform: {
      x: l.x,
      y: l.y,
      rotation: l.rotation,
      scaleX: l.scaleX,
      scaleY: l.scaleY,
      opacity: l.opacity,
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
    points: l.points,
    strokeWidth: l.strokeWidth,
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
          x: k.transform.x, y: k.transform.y,
          rotation: k.transform.rotation,
          scaleX: k.transform.scaleX, scaleY: k.transform.scaleY,
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
      visible: true,
      locked: false,
    };
  });

  setCharacterParts(parts);
  setTracks(trks);
  if (scene.fps) setFps(scene.fps);
  if (scene.totalFrames) setTotalFrames(scene.totalFrames);
  if (scene.width && scene.height) setProjectResolution({ width: scene.width, height: scene.height });
  // BUG #2 fix: restore the exported scene name as editor sceneTitle.
  // Empty/missing name keeps the current/default title (no-op).
  const trimmedName = (defaultName || '').trim();
  if (trimmedName) {
    setSceneTitle(trimmedName);
  }
  // BUG #5 fix: restore exported motion templates (legacy path already does this).
  // Missing motionTemplates keeps current templates untouched.
  if (scene.motionTemplates && scene.motionTemplates.length > 0) {
    setMotionTemplates(scene.motionTemplates as MotionTemplate[]);
  }
  setLastSavedAt(new Date());

  // Initialize ID counter from all IDs
  const allIds: string[] = [];
  parts.forEach(p => allIds.push(p.id));
  trks.forEach(t => {
    allIds.push(t.id);
    t.keyframes?.forEach(k => allIds.push(k.id));
  });
  initializeIdCounter(allIds);

  return true;
}

/**
 * Detect if a parsed JSON object is SceneData (has version field) or legacy.
 */
function isSceneData(parsed: any): parsed is SceneData {
  return parsed && typeof parsed.version === 'number' && parsed.version >= 1;
}

// ─── Hook ─────────────────────────────────────────────────────────────

interface UseSerializationOptions {
  fps: number;
  setFps: React.Dispatch<React.SetStateAction<number>>;
  totalFrames: number;
  setTotalFrames: React.Dispatch<React.SetStateAction<number>>;
  projectResolution: { width: number; height: number };
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
        const parsed: any = JSON.parse(saved);

        // Phase 3: Try SceneData format first
        if (isSceneData(parsed)) {
          fromSceneData(parsed, parsed.name || '', setCharacterParts, setTracks, setFps, setTotalFrames, setProjectResolution, setLastSavedAt, setSceneTitleState, setMotionTemplates);
          return;
        }

        // Legacy AnimationProject format (backward compat)
        const hasLegacyStickman = parsed.characterParts?.some((p: any) => (p.type as string) === 'head' || (p.type as string) === 'torso');
        if (parsed.tracks && parsed.characterParts && !hasLegacyStickman) {
          if (parsed.projectResolution) setProjectResolution(parsed.projectResolution);
          setTracks(parsed.tracks.map(migrateTrack));
          setCharacterParts(parsed.characterParts);
          if (parsed.fps) setFps(parsed.fps);
          if (parsed.totalFrames) setTotalFrames(parsed.totalFrames);
          setLastSavedAt(parsed.lastSavedTime ? new Date(parsed.lastSavedTime) : new Date());

          const allIds: string[] = [];
          parsed.characterParts.forEach((p: any) => allIds.push(p.id));
          parsed.tracks.forEach((t: any) => {
            allIds.push(t.id);
            t.keyframes?.forEach((k: any) => allIds.push(k.id));
            if (t.channels) {
              Object.values(t.channels).forEach((ch: any) => (ch as any[])?.forEach((pk: any) => allIds.push(pk.id)));
            }
          });
          initializeIdCounter(allIds);
        } else {
          localStorage.removeItem(AUTOSAVE_STORAGE_KEY);
        }
      }
    } catch (e) {
      console.warn('[AutoSave] Failed to restore saved state', e);
    }
  }, [setTotalFrames, setProjectResolution, setTracks, setCharacterParts, setFps]);

  // 2. Auto-Save: SceneData format every 10 seconds
  const performSave = useCallback(() => {
    try {
      const scene = toSceneData(characterParts, tracks, fps, totalFrames, projectResolution, sceneTitle);
      scene.name = sceneTitle || 'Untitled';
      localStorage.setItem(AUTOSAVE_STORAGE_KEY, JSON.stringify(scene));
      setLastSavedAt(new Date());
    } catch (e) {
      console.error('[AutoSave] Failed to save project to LocalStorage', e);
    }
  }, [characterParts, tracks, fps, totalFrames, projectResolution, sceneTitle]);

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
    const scene = toSceneData(characterParts, tracks, fps, totalFrames, projectResolution, sceneTitle);
    scene.name = sceneTitle || 'Template';
    scene.motionTemplates = motionTemplates;
    return JSON.stringify(scene, null, 2);
  }, [characterParts, tracks, fps, totalFrames, projectResolution, sceneTitle, motionTemplates]);

  // 4. Import: SceneData or legacy AnimationProject
  const importProject = useCallback((jsonStr: string, defaultName?: string): boolean => {
    try {
      const parsed: any = JSON.parse(jsonStr);
      if (!parsed) return false;

      // Phase 3: SceneData format
      // BUG #2: empty/missing name → '' so fromSceneData keeps the current title (no-op)
      if (isSceneData(parsed)) {
        return fromSceneData(parsed, defaultName || parsed.name || '', setCharacterParts, setTracks, setFps, setTotalFrames, setProjectResolution, setLastSavedAt, setSceneTitleState, setMotionTemplates);
      }

      // Legacy AnimationProject format (backward compat)
      if (parsed.tracks && parsed.characterParts) {
        const rawName = defaultName || parsed.sceneTitle || parsed.name || 'Imported Template';
        const templateName = rawName.replace(/\.json$/i, '').trim() || 'Imported Template';
        const newId = `tmpl_${Date.now()}`;

        const importedMotionTemplates = (parsed.motionTemplates && parsed.motionTemplates.length > 0)
          ? parsed.motionTemplates
          : DEFAULT_MOTION_TEMPLATES;

        const initialSeqId = importedMotionTemplates[0].id;
        const importedTracks = parsed.tracks.map(migrateTrack);
        const importedParts = parsed.characterParts;

        setTemplateCanvasStore((prev: any) => ({
          ...prev,
          [activeProjectTemplateId]: { characterParts, tracks, motionTemplates, activeTemplateId },
          [newId]: { characterParts: importedParts, tracks: importedTracks, motionTemplates: importedMotionTemplates, activeTemplateId: initialSeqId },
        }));

        setProjectTemplates((prev: any) => [...prev, { id: newId, name: templateName }]);
        setCharacterParts(importedParts);
        setTracks(importedTracks);
        setMotionTemplates(importedMotionTemplates);
        setActiveTemplateIdState(initialSeqId);
        setActiveProjectTemplateIdState(newId);
        setSceneTitleState(templateName);

        if (parsed.projectResolution) setProjectResolution(parsed.projectResolution);
        if (parsed.fps) setFps(parsed.fps);
        if (parsed.totalFrames) setTotalFrames(parsed.totalFrames);

        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [activeProjectTemplateId, characterParts, tracks, motionTemplates, activeTemplateId, setProjectResolution, setTracks, setCharacterParts, setFps, setTotalFrames, setTemplateCanvasStore, setProjectTemplates, setMotionTemplates, setActiveTemplateIdState, setActiveProjectTemplateIdState, setSceneTitleState]);

  const resetProject = useCallback(() => {
    setTracks(DEFAULT_TRACKS);
    setCharacterParts(DEFAULT_CHARACTER_PARTS);
    setCurrentFrame(0);
    setIsPlaying(false);
    try {
      localStorage.removeItem(AUTOSAVE_STORAGE_KEY);
    } catch (e) {
      console.warn('[Storage] Could not clear autosave key:', e);
    }
    setLastSavedAt(null);
  }, [setTracks, setCharacterParts, setCurrentFrame, setIsPlaying]);

  return {
    lastSavedAt,
    triggerManualSave,
    exportProject,
    importProject,
    resetProject,
  };
};
