import { normalizeStepMarkers } from '../utils/animation/stepMarkers';
import { useState, useCallback } from 'react';
import type { CharacterPart, Track, MotionTemplate, ProjectTemplate, AppMode } from '../types/animator';
import type { SceneCoordinateSystem } from '../types/composition';
import { DEFAULT_MOTION_TEMPLATES } from '../utils/editor/constants';
import { DEFAULT_CHARACTER_PARTS, DEFAULT_TRACKS } from '../utils/animation/defaults';
import { DEFAULT_SCENE_COORDINATE_SYSTEM } from '../utils/persistence/coordinateMigration';
import {
  createMotionTemplate,
  hasSequenceName,
  normalizeMotionTemplates,
  normalizeSequenceDuration,
} from '../utils/animation/motionTemplates';

interface TemplateCanvas {
  characterParts: CharacterPart[];
  tracks: Track[];
  motionTemplates: MotionTemplate[];
  activeTemplateId: string;
  coordinateSystem: SceneCoordinateSystem;
  /**
   * The template's frame rate. A scene's fps is its own (SceneData.fps), so a
   * tab keeps it: absent on entries written before tabs kept their rate.
   */
  fps?: number;
  /** The template's canvas size (SceneData.width/height), kept with it like its rate. */
  projectResolution?: { width: number; height: number };
}

/** The canvas size a new template opens at (the editor's initial size). */
const DEFAULT_TEMPLATE_RESOLUTION = { width: 1920, height: 1080 } as const;

/** The frame count a template opens at: its active sequence's duration. */
const activeSequenceDuration = (templates: MotionTemplate[], activeId: string): number | undefined =>
  (templates.find((template) => template.id === activeId) ?? templates[0])?.durationFrames;

interface UseTemplatesOptions {
  characterParts: CharacterPart[];
  setCharacterParts: React.Dispatch<React.SetStateAction<CharacterPart[]>>;
  tracks: Track[];
  setTracks: React.Dispatch<React.SetStateAction<Track[]>>;
  setFps: React.Dispatch<React.SetStateAction<number>>;
  /** The open template's frame rate, stored with it when another tab opens. */
  fps?: number;
  /** The open template's canvas size, stored and restored the same way. */
  projectResolution?: { width: number; height: number };
  setProjectResolution?: (resolution: { width: number; height: number }) => void;
  setTotalFrames?: React.Dispatch<React.SetStateAction<number>>;
  setCurrentFrame: (frame: number | ((prev: number) => number)) => void;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  /** BUGFIX (broadcast isolation): sequence selection in broadcast mode must
   *  NOT touch the edit-timeline playback state (currentFrame/isPlaying) —
   *  broadcast playback is driven by broadcastState only. */
  appMode: AppMode;
  coordinateSystem?: SceneCoordinateSystem;
  setCoordinateSystem?: React.Dispatch<React.SetStateAction<SceneCoordinateSystem>>;
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
  onSequenceDeleted?: (sequenceId: string) => void;
  onSequenceDurationChanged?: (sequenceId: string, durationFrames: number) => void;
  /**
   * Called whenever another template tab becomes the one on screen (switch,
   * new tab, deleting the open tab). The editor resets the undo baseline
   * there: one undo stack spans the scene arrays only, so without it Ctrl+Z
   * right after a switch wrote the previous tab's layers into this one.
   */
  onProjectTemplateSwitched?: () => void;
}

export const useTemplates = ({
  characterParts,
  setCharacterParts,
  tracks,
  setTracks,
  setFps,
  fps,
  projectResolution,
  setProjectResolution,
  setTotalFrames,
  setCurrentFrame,
  setIsPlaying,
  appMode,
  coordinateSystem = DEFAULT_SCENE_COORDINATE_SYSTEM,
  setCoordinateSystem = () => undefined,
  showToast,
  onSequenceDeleted,
  onSequenceDurationChanged,
  onProjectTemplateSwitched,
}: UseTemplatesOptions) => {
  const [templateCanvasStore, setTemplateCanvasStore] = useState<Record<string, TemplateCanvas>>({
    tmpl_1: {
      characterParts: DEFAULT_CHARACTER_PARTS,
      tracks: DEFAULT_TRACKS,
      motionTemplates: normalizeMotionTemplates(DEFAULT_MOTION_TEMPLATES),
      activeTemplateId: 'Sequence',
      coordinateSystem: 'project-unit-center-v1',
    },
  });

  const [projectTemplates, setProjectTemplates] = useState<ProjectTemplate[]>([
    { id: 'tmpl_1', name: 'Template' },
  ]);
  const [activeProjectTemplateId, setActiveProjectTemplateIdState] = useState<string>('tmpl_1');
  const [sceneTitle, setSceneTitleState] = useState<string>('Template');

  const setSceneTitle = useCallback((title: string) => {
    setSceneTitleState(title);
    setProjectTemplates((prev) =>
      prev.map((t) => (t.id === activeProjectTemplateId ? { ...t, name: title } : t))
    );
  }, [activeProjectTemplateId]);

  const [activeTemplateId, setActiveTemplateIdState] = useState<string>('Sequence');

  const [motionTemplates, setMotionTemplates] = useState<MotionTemplate[]>(() => normalizeMotionTemplates(DEFAULT_MOTION_TEMPLATES));
  const setActiveTemplateId = useCallback((id: string) => {
    setActiveTemplateIdState(id);
    // Keep edit playback bounds synchronized with the selected sequence.
    // Broadcast selection is intentionally isolated from edit playback.
    if (appMode !== 'broadcast') {
      const duration = motionTemplates.find((template) => template.id === id)?.durationFrames;
      if (duration !== undefined) setTotalFrames?.(duration);
      setCurrentFrame(0);
      setIsPlaying(false);
    }
  }, [appMode, motionTemplates, setTotalFrames, setCurrentFrame, setIsPlaying]);

  const addMotionTemplate = useCallback((name: string, type: 'in' | 'out' | 'stunt' = 'in') => {
    const newTmpl = createMotionTemplate(name, motionTemplates, type);
    setMotionTemplates((prev) => [...prev, newTmpl]);
    setActiveTemplateIdState(newTmpl.id);
    // The new sequence opens as a selected one does: its length, frame 0,
    // stopped (edit mode only — broadcast selection stays isolated).
    if (appMode !== 'broadcast') {
      setTotalFrames?.(newTmpl.durationFrames);
      setCurrentFrame(0);
      setIsPlaying(false);
    }
  }, [appMode, motionTemplates, setTotalFrames, setCurrentFrame, setIsPlaying]);

  const renameMotionTemplate = useCallback((oldId: string, newName: string) => {
    const cleanName = newName.trim();
    if (!cleanName || cleanName === motionTemplates.find((template) => template.id === oldId)?.name) return;
    if (hasSequenceName(motionTemplates, cleanName, oldId)) {
      showToast?.(`A sequence named "${cleanName}" already exists.`, 'error');
      return;
    }

    setMotionTemplates((prev) =>
      prev.map((t) => (t.id === oldId ? { ...t, name: cleanName } : t))
    );

    // Sequence identity is independent from display name. Existing channel
    // templateIds remain untouched so rename cannot disconnect animation.
  }, [motionTemplates, showToast]);

  const deleteMotionTemplate = useCallback((idToDelete: string) => {
    const template = motionTemplates.find((candidate) => candidate.id === idToDelete);
    if (!template || motionTemplates.length <= 1) return;

    setMotionTemplates((prev) => {
      if (prev.length <= 1) return prev;
      const filtered = prev.filter((t) => t.id !== idToDelete);
      if (activeTemplateId === idToDelete && filtered.length > 0) {
        setActiveTemplateIdState(filtered[0].id);
      }
      return filtered;
    });
    setTracks((prevTracks) =>
      prevTracks.map((tr) => {
        const filterMap = <T extends { templateId?: string }>(
          map: Record<string, T[]> | undefined,
        ): Record<string, T[]> =>
          Object.fromEntries(Object.entries(map ?? {}).map(([channel, keyframes]) => [
            channel,
            keyframes.filter((keyframe) => (keyframe.templateId || 'Sequence') !== idToDelete),
          ]));
        return {
          ...tr,
          keyframes: (tr.keyframes || []).filter((k) => (k.templateId || 'Sequence') !== idToDelete),
          channels: filterMap(tr.channels) as Track['channels'],
          maskChannels: filterMap(tr.maskChannels),
          maskPathChannels: filterMap(tr.maskPathChannels),
          ...(tr.sequencerTemplateId === idToDelete ? { sequencerTemplateId: undefined } : {}),
        };
      }),
    );
    if (activeTemplateId === idToDelete) {
      // The sequence that takes over sets the edit timeline, as selecting it
      // does: its length, frame 0, stopped. Without this the timeline kept the
      // deleted sequence's length and the playhead could sit past the end.
      // Broadcast selection stays isolated from edit playback.
      const next = motionTemplates.find((candidate) => candidate.id !== idToDelete);
      if (next && appMode !== 'broadcast') {
        setTotalFrames?.(next.durationFrames);
        setCurrentFrame(0);
        setIsPlaying(false);
      }
      onSequenceDeleted?.(idToDelete);
    }
  }, [activeTemplateId, appMode, motionTemplates, onSequenceDeleted, setTracks, setTotalFrames, setCurrentFrame, setIsPlaying]);


  /** The sequence's OGraf step markers (frames inside it), stored normalized. */
  const setMotionTemplateStepMarkers = useCallback((id: string, markers: number[]) => {
    setMotionTemplates((prev) => prev.map((template) => {
      if (template.id !== id) return template;
      const stepMarkers = normalizeStepMarkers(markers, template.durationFrames);
      const { stepMarkers: _previous, ...rest } = template;
      return stepMarkers.length > 0 ? { ...rest, stepMarkers } : rest;
    }));
  }, []);

  const updateMotionTemplateDuration = useCallback((id: string, durationFrames: number) => {
    const duration = normalizeSequenceDuration(durationFrames);
    setMotionTemplates((prev) => prev.map((template) => (
      template.id === id ? { ...template, durationFrames: duration } : template
    )));
    onSequenceDurationChanged?.(id, duration);
  }, [onSequenceDurationChanged]);

  const setActiveProjectTemplateId = useCallback((targetId: string) => {
    if (targetId === activeProjectTemplateId) return;

    // 1. Save current active template's state into store
    setTemplateCanvasStore((prev) => ({
      ...prev,
      [activeProjectTemplateId]: {
        characterParts,
        tracks,
        motionTemplates,
        activeTemplateId,
        coordinateSystem,
        ...(fps !== undefined ? { fps } : {}),
        ...(projectResolution ? { projectResolution } : {}),
      },
    }));

    // 2. Load target template's state from store or create empty default if missing
    const targetData = templateCanvasStore[targetId] || {
      characterParts: [],
      tracks: [],
      motionTemplates: DEFAULT_MOTION_TEMPLATES,
      activeTemplateId: 'Sequence',
      coordinateSystem: DEFAULT_SCENE_COORDINATE_SYSTEM,
    };

    const targetTemplates = normalizeMotionTemplates(targetData.motionTemplates);
    setCharacterParts(targetData.characterParts);
    setTracks(targetData.tracks);
    setMotionTemplates(targetTemplates);
    setActiveTemplateIdState(targetData.activeTemplateId);
    setCoordinateSystem(targetData.coordinateSystem ?? DEFAULT_SCENE_COORDINATE_SYSTEM);
    // The tab opens at its own rate and its active sequence's length: the
    // rate is the scene's time mapping, so carrying another tab's rate over
    // would change how fast this one plays.
    if (targetData.fps !== undefined) setFps(targetData.fps);
    if (targetData.projectResolution) setProjectResolution?.(targetData.projectResolution);
    const duration = activeSequenceDuration(targetTemplates, targetData.activeTemplateId);
    if (duration !== undefined) setTotalFrames?.(duration);
    setActiveProjectTemplateIdState(targetId);
    onProjectTemplateSwitched?.();

    const tmpl = projectTemplates.find((t) => t.id === targetId);
    if (tmpl) setSceneTitleState(tmpl.name);
  }, [onProjectTemplateSwitched, fps, setFps, projectResolution, setProjectResolution, setTotalFrames, activeProjectTemplateId, characterParts, tracks, motionTemplates, activeTemplateId, coordinateSystem, templateCanvasStore, projectTemplates, setCharacterParts, setTracks, setMotionTemplates, setActiveTemplateIdState, setActiveProjectTemplateIdState, setSceneTitleState, setCoordinateSystem]);

  const addProjectTemplate = useCallback((name: string) => {
    const cleanName = name.trim() || 'New Template';
    const newId = `tmpl_${Date.now()}`;
    const newTmpl: ProjectTemplate = {
      id: newId,
      name: cleanName,
    };

    // Save current template state & set up fresh clean template
    setTemplateCanvasStore((prev) => ({
      ...prev,
      [activeProjectTemplateId]: {
        characterParts,
        tracks,
        motionTemplates,
        activeTemplateId,
        coordinateSystem,
        ...(fps !== undefined ? { fps } : {}),
        ...(projectResolution ? { projectResolution } : {}),
      },
      [newId]: {
        characterParts: [],
        tracks: [],
      motionTemplates: normalizeMotionTemplates(DEFAULT_MOTION_TEMPLATES),
        activeTemplateId: 'Sequence',
        coordinateSystem: 'project-unit-center-v1',
      },
    }));

    setProjectTemplates((prev) => [...prev, newTmpl]);
    setCharacterParts([]); // Clean fresh canvas for new template
    setTracks([]);
    setMotionTemplates(normalizeMotionTemplates(DEFAULT_MOTION_TEMPLATES));
    setActiveTemplateIdState('Sequence');
    setCoordinateSystem('project-unit-center-v1');
    setActiveProjectTemplateIdState(newId);
    setSceneTitleState(cleanName);
    setFps(60); // Strictly default to 60 FPS for new templates
    // A new template opens at the default canvas size as it opens at the
    // default rate: it used to keep the size of the tab it was made from.
    setProjectResolution?.(DEFAULT_TEMPLATE_RESOLUTION);
    const freshDuration = activeSequenceDuration(normalizeMotionTemplates(DEFAULT_MOTION_TEMPLATES), 'Sequence');
    if (freshDuration !== undefined) setTotalFrames?.(freshDuration);
    onProjectTemplateSwitched?.();
  }, [onProjectTemplateSwitched, fps, projectResolution, setProjectResolution, setTotalFrames, activeProjectTemplateId, characterParts, tracks, motionTemplates, activeTemplateId, coordinateSystem, setTemplateCanvasStore, setProjectTemplates, setCharacterParts, setTracks, setMotionTemplates, setActiveTemplateIdState, setActiveProjectTemplateIdState, setSceneTitleState, setFps, setCoordinateSystem]);

  const renameProjectTemplate = useCallback((id: string, newName: string) => {
    const cleanName = newName.trim();
    if (!cleanName) return;

    setProjectTemplates((prev) =>
      prev.map((t) => (t.id === id ? { ...t, name: cleanName } : t))
    );

    if (activeProjectTemplateId === id) {
      setSceneTitleState(cleanName);
    }
  }, [activeProjectTemplateId]);

  const deleteProjectTemplate = useCallback((idToDelete: string) => {
    if (activeProjectTemplateId === idToDelete && projectTemplates.length > 1) onProjectTemplateSwitched?.();
    setProjectTemplates((prev) => {
      if (prev.length <= 1) return prev;
      const filtered = prev.filter((t) => t.id !== idToDelete);
      if (activeProjectTemplateId === idToDelete && filtered.length > 0) {
        const nextId = filtered[0].id;
        setActiveProjectTemplateIdState(nextId);
        const targetData = templateCanvasStore[nextId] || {
          characterParts: [],
          tracks: [],
          motionTemplates: normalizeMotionTemplates(DEFAULT_MOTION_TEMPLATES),
          activeTemplateId: 'Sequence',
          coordinateSystem: DEFAULT_SCENE_COORDINATE_SYSTEM,
        };
        const nextTemplates = normalizeMotionTemplates(targetData.motionTemplates);
        setCharacterParts(targetData.characterParts);
        setTracks(targetData.tracks);
        setMotionTemplates(nextTemplates);
        setActiveTemplateIdState(targetData.activeTemplateId);
        setCoordinateSystem(targetData.coordinateSystem ?? DEFAULT_SCENE_COORDINATE_SYSTEM);
        if (targetData.fps !== undefined) setFps(targetData.fps);
        if (targetData.projectResolution) setProjectResolution?.(targetData.projectResolution);
        const duration = activeSequenceDuration(nextTemplates, targetData.activeTemplateId);
        if (duration !== undefined) setTotalFrames?.(duration);
        setSceneTitleState(filtered[0].name);
      }
      return filtered;
    });

    setTemplateCanvasStore((prev) => {
      const nextStore = { ...prev };
      delete nextStore[idToDelete];
      return nextStore;
    });
  }, [onProjectTemplateSwitched, setFps, setProjectResolution, setTotalFrames, projectTemplates, activeProjectTemplateId, templateCanvasStore, setProjectTemplates, setActiveProjectTemplateIdState, setCharacterParts, setTracks, setMotionTemplates, setActiveTemplateIdState, setSceneTitleState, setTemplateCanvasStore, setCoordinateSystem]);

  return {
    templateCanvasStore,
    setTemplateCanvasStore,
    projectTemplates,
    setProjectTemplates,
    activeProjectTemplateId,
    setActiveProjectTemplateIdState,
    sceneTitle,
    setSceneTitle,
    setSceneTitleState,
    activeTemplateId,
    setActiveTemplateIdState,
    motionTemplates,
    setMotionTemplates,
    setActiveTemplateId,
    addMotionTemplate,
    renameMotionTemplate,
    deleteMotionTemplate,
    updateMotionTemplateDuration,
    setMotionTemplateStepMarkers,
    setActiveProjectTemplateId,
    addProjectTemplate,
    renameProjectTemplate,
    deleteProjectTemplate,
  };
};
