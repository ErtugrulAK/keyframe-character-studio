import { useState, useCallback } from 'react';
import type { CharacterPart, Track, MotionTemplate, ProjectTemplate, TrackChannel, AppMode } from '../types/animator';
import type { SceneCoordinateSystem } from '../types/composition';
import { DEFAULT_MOTION_TEMPLATES } from '../utils/constants';
import { DEFAULT_CHARACTER_PARTS, DEFAULT_TRACKS } from '../utils/defaults';
import { DEFAULT_SCENE_COORDINATE_SYSTEM } from '../utils/coordinateMigration';
import {
  createMotionTemplate,
  hasSequenceName,
  normalizeMotionTemplates,
  normalizeSequenceDuration,
} from '../utils/motionTemplates';

interface TemplateCanvas {
  characterParts: CharacterPart[];
  tracks: Track[];
  motionTemplates: MotionTemplate[];
  activeTemplateId: string;
  coordinateSystem: SceneCoordinateSystem;
}

interface UseTemplatesOptions {
  characterParts: CharacterPart[];
  setCharacterParts: React.Dispatch<React.SetStateAction<CharacterPart[]>>;
  tracks: Track[];
  setTracks: React.Dispatch<React.SetStateAction<Track[]>>;
  setFps: React.Dispatch<React.SetStateAction<number>>;
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
}

export const useTemplates = ({
  characterParts,
  setCharacterParts,
  tracks,
  setTracks,
  setFps,
  setCurrentFrame,
  setIsPlaying,
  appMode,
  coordinateSystem = DEFAULT_SCENE_COORDINATE_SYSTEM,
  setCoordinateSystem = () => undefined,
  showToast,
  onSequenceDeleted,
  onSequenceDurationChanged,
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
    // BUGFIX (broadcast isolation): in broadcast mode the sequence selection
    // must not reset the EDIT timeline (currentFrame/isPlaying) — broadcast
    // playback is driven by broadcastState, not by the edit timeline.
    if (appMode !== 'broadcast') {
      setCurrentFrame(0);
      setIsPlaying(false);
    }
  }, [appMode, setCurrentFrame, setIsPlaying]);

  const addMotionTemplate = useCallback((name: string, type: 'in' | 'out' | 'stunt' = 'in') => {
    const newTmpl = createMotionTemplate(name, motionTemplates, type);
    setMotionTemplates((prev) => [...prev, newTmpl]);
    setActiveTemplateIdState(newTmpl.id);
  }, [motionTemplates]);

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
        const updatedKfs = (tr.keyframes || []).filter((k) => (k.templateId || 'Sequence') !== idToDelete);
        let updatedChannels = { ...tr.channels };
        if (tr.channels) {
          Object.keys(tr.channels).forEach((chKey) => {
            const ch = chKey as TrackChannel;
            if (updatedChannels[ch]) {
              updatedChannels[ch] = updatedChannels[ch]!.filter(
                (pk) => (pk.templateId || 'Sequence') !== idToDelete
              );
            }
          });
        }
        return {
          ...tr,
          keyframes: updatedKfs,
          channels: updatedChannels,
          ...(tr.sequencerTemplateId === idToDelete ? { sequencerTemplateId: undefined } : {}),
        };
      })
    );
    if (activeTemplateId === idToDelete) {
      onSequenceDeleted?.(idToDelete);
    }
  }, [activeTemplateId, motionTemplates, onSequenceDeleted, setTracks]);


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

    setCharacterParts(targetData.characterParts);
    setTracks(targetData.tracks);
    setMotionTemplates(normalizeMotionTemplates(targetData.motionTemplates));
    setActiveTemplateIdState(targetData.activeTemplateId);
    setCoordinateSystem(targetData.coordinateSystem ?? DEFAULT_SCENE_COORDINATE_SYSTEM);
    setActiveProjectTemplateIdState(targetId);

    const tmpl = projectTemplates.find((t) => t.id === targetId);
    if (tmpl) setSceneTitleState(tmpl.name);
  }, [activeProjectTemplateId, characterParts, tracks, motionTemplates, activeTemplateId, coordinateSystem, templateCanvasStore, projectTemplates, setCharacterParts, setTracks, setMotionTemplates, setActiveTemplateIdState, setActiveProjectTemplateIdState, setSceneTitleState, setCoordinateSystem]);

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
  }, [activeProjectTemplateId, characterParts, tracks, motionTemplates, activeTemplateId, coordinateSystem, setTemplateCanvasStore, setProjectTemplates, setCharacterParts, setTracks, setMotionTemplates, setActiveTemplateIdState, setActiveProjectTemplateIdState, setSceneTitleState, setFps, setCoordinateSystem]);

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
        setCharacterParts(targetData.characterParts);
        setTracks(targetData.tracks);
        setMotionTemplates(normalizeMotionTemplates(targetData.motionTemplates));
        setActiveTemplateIdState(targetData.activeTemplateId);
        setCoordinateSystem(targetData.coordinateSystem ?? DEFAULT_SCENE_COORDINATE_SYSTEM);
        setSceneTitleState(filtered[0].name);
      }
      return filtered;
    });

    setTemplateCanvasStore((prev) => {
      const nextStore = { ...prev };
      delete nextStore[idToDelete];
      return nextStore;
    });
  }, [activeProjectTemplateId, templateCanvasStore, setProjectTemplates, setActiveProjectTemplateIdState, setCharacterParts, setTracks, setMotionTemplates, setActiveTemplateIdState, setSceneTitleState, setTemplateCanvasStore, setCoordinateSystem]);

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
    setActiveProjectTemplateId,
    addProjectTemplate,
    renameProjectTemplate,
    deleteProjectTemplate,
  };
};
