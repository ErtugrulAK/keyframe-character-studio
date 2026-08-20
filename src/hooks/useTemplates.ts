import { useState, useCallback } from 'react';
import type { CharacterPart, Track, MotionTemplate, ProjectTemplate, TrackChannel } from '../types/animator';
import { DEFAULT_MOTION_TEMPLATES } from '../utils/constants';
import { DEFAULT_CHARACTER_PARTS, DEFAULT_TRACKS } from '../utils/defaults';

interface TemplateCanvas {
  characterParts: CharacterPart[];
  tracks: Track[];
  motionTemplates: MotionTemplate[];
  activeTemplateId: string;
}

interface UseTemplatesOptions {
  characterParts: CharacterPart[];
  setCharacterParts: React.Dispatch<React.SetStateAction<CharacterPart[]>>;
  tracks: Track[];
  setTracks: React.Dispatch<React.SetStateAction<Track[]>>;
  setFps: React.Dispatch<React.SetStateAction<number>>;
  setCurrentFrame: (frame: number | ((prev: number) => number)) => void;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
}

export const useTemplates = ({
  characterParts,
  setCharacterParts,
  tracks,
  setTracks,
  setFps,
  setCurrentFrame,
  setIsPlaying,
}: UseTemplatesOptions) => {
  const [templateCanvasStore, setTemplateCanvasStore] = useState<Record<string, TemplateCanvas>>({
    tmpl_1: {
      characterParts: DEFAULT_CHARACTER_PARTS,
      tracks: DEFAULT_TRACKS,
      motionTemplates: [{ id: 'Sequence', name: 'Sequence', type: 'in', durationFrames: 60, description: 'Default Sequence Timeline' }],
      activeTemplateId: 'Sequence',
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

  const [motionTemplates, setMotionTemplates] = useState<MotionTemplate[]>(DEFAULT_MOTION_TEMPLATES);

  const setActiveTemplateId = useCallback((id: string) => {
    setActiveTemplateIdState(id);
    setCurrentFrame(0);
    setIsPlaying(false);
  }, []);

  const addMotionTemplate = useCallback((name: string, type: 'in' | 'out' | 'stunt' = 'in') => {
    const cleanName = name.trim() || 'New Sequence';
    const newTmpl: MotionTemplate = {
      id: cleanName,
      name: cleanName,
      type,
      durationFrames: 60,
      description: 'Custom Sequence Timeline',
    };
    setMotionTemplates((prev) => [...prev, newTmpl]);
    setActiveTemplateIdState(cleanName);
  }, [motionTemplates]);

  const renameMotionTemplate = useCallback((oldId: string, newName: string) => {
    const cleanName = newName.trim();
    if (!cleanName || cleanName === oldId) return;

    setMotionTemplates((prev) =>
      prev.map((t) => (t.id === oldId ? { ...t, id: cleanName, name: cleanName } : t))
    );

    setTracks((prevTracks) =>
      prevTracks.map((tr) => {
        const updatedKfs = tr.keyframes.map((k) =>
          (k.templateId || 'Sequence') === oldId ? { ...k, templateId: cleanName } : k
        );

        let updatedChannels = { ...tr.channels };
        if (tr.channels) {
          Object.keys(tr.channels).forEach((chKey) => {
            const ch = chKey as TrackChannel;
            if (updatedChannels[ch]) {
              updatedChannels[ch] = updatedChannels[ch]!.map((pk) =>
                (pk.templateId || 'Sequence') === oldId ? { ...pk, templateId: cleanName } : pk
              );
            }
          });
        }

        return { ...tr, keyframes: updatedKfs, channels: updatedChannels };
      })
    );

    if (activeTemplateId === oldId) {
      setActiveTemplateIdState(cleanName);
    }
  }, [activeTemplateId]);

  const deleteMotionTemplate = useCallback((idToDelete: string) => {
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
        const updatedKfs = tr.keyframes.filter((k) => (k.templateId || 'Sequence') !== idToDelete);
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
        return { ...tr, keyframes: updatedKfs, channels: updatedChannels };
      })
    );
  }, [activeTemplateId]);

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
      },
    }));

    // 2. Load target template's state from store or create empty default if missing
    const targetData = templateCanvasStore[targetId] || {
      characterParts: [],
      tracks: [],
      motionTemplates: DEFAULT_MOTION_TEMPLATES,
      activeTemplateId: 'Sequence',
    };

    setCharacterParts(targetData.characterParts);
    setTracks(targetData.tracks);
    setMotionTemplates(targetData.motionTemplates);
    setActiveTemplateIdState(targetData.activeTemplateId);
    setActiveProjectTemplateIdState(targetId);

    const tmpl = projectTemplates.find((t) => t.id === targetId);
    if (tmpl) setSceneTitleState(tmpl.name);
  }, [activeProjectTemplateId, characterParts, tracks, motionTemplates, activeTemplateId, templateCanvasStore, projectTemplates, setCharacterParts, setTracks, setMotionTemplates, setActiveTemplateIdState, setActiveProjectTemplateIdState, setSceneTitleState]);

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
      },
      [newId]: {
        characterParts: [],
        tracks: [],
        motionTemplates: DEFAULT_MOTION_TEMPLATES,
        activeTemplateId: 'Sequence',
      },
    }));

    setProjectTemplates((prev) => [...prev, newTmpl]);
    setCharacterParts([]); // Clean fresh canvas for new template
    setTracks([]);
    setMotionTemplates(DEFAULT_MOTION_TEMPLATES);
    setActiveTemplateIdState('Sequence');
    setActiveProjectTemplateIdState(newId);
    setSceneTitleState(cleanName);
    setFps(60); // Strictly default to 60 FPS for new templates
  }, [activeProjectTemplateId, characterParts, tracks, motionTemplates, activeTemplateId, projectTemplates.length, setTemplateCanvasStore, setProjectTemplates, setCharacterParts, setTracks, setMotionTemplates, setActiveTemplateIdState, setActiveProjectTemplateIdState, setSceneTitleState, setFps]);

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
          motionTemplates: DEFAULT_MOTION_TEMPLATES,
          activeTemplateId: 'Sequence',
        };
        setCharacterParts(targetData.characterParts);
        setTracks(targetData.tracks);
        setMotionTemplates(targetData.motionTemplates);
        setActiveTemplateIdState(targetData.activeTemplateId);
        setSceneTitleState(filtered[0].name);
      }
      return filtered;
    });

    setTemplateCanvasStore((prev) => {
      const nextStore = { ...prev };
      delete nextStore[idToDelete];
      return nextStore;
    });
  }, [activeProjectTemplateId, templateCanvasStore, setProjectTemplates, setActiveProjectTemplateIdState, setCharacterParts, setTracks, setMotionTemplates, setActiveTemplateIdState, setSceneTitleState, setTemplateCanvasStore]);

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
    setActiveProjectTemplateId,
    addProjectTemplate,
    renameProjectTemplate,
    deleteProjectTemplate,
  };
};
