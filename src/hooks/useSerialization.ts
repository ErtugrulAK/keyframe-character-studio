import { useState, useEffect, useCallback } from 'react';
import type { AnimationProject, CharacterPart, Track, MotionTemplate } from '../types/animator';
import { initializeIdCounter } from '../utils/idGenerator';
import { makeEmptyChannels, DEFAULT_TRACKS, DEFAULT_CHARACTER_PARTS } from '../utils/defaults';
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

  // 1. Initial Load: Restore from LocalStorage if available (filtering legacy stickman)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(AUTOSAVE_STORAGE_KEY);
      if (saved) {
        const parsed: AnimationProject & { lastSavedTime?: string } = JSON.parse(saved);
        const hasLegacyStickman = parsed.characterParts?.some((p) => (p.type as string) === 'head' || (p.type as string) === 'torso');
        if (parsed.tracks && parsed.characterParts && !hasLegacyStickman) {
          if (parsed.projectResolution) setProjectResolution(parsed.projectResolution);
          setTracks(parsed.tracks.map(migrateTrack));
          setCharacterParts(parsed.characterParts);
          if (parsed.fps) setFps(parsed.fps);
          if (parsed.totalFrames) setTotalFrames(parsed.totalFrames);
          setLastSavedAt(parsed.lastSavedTime ? new Date(parsed.lastSavedTime) : new Date());

          // Initialize sequential ID counter from existing IDs
          const allIds: string[] = [];
          parsed.characterParts.forEach(p => allIds.push(p.id));
          parsed.tracks.forEach(t => {
            allIds.push(t.id);
            t.keyframes?.forEach(k => allIds.push(k.id));
            if (t.channels) {
              Object.values(t.channels).forEach((ch: any[]) => ch?.forEach(pk => allIds.push(pk.id)));
            }
          });
          initializeIdCounter(allIds);
        } else {
          // Clear legacy stickman data
          localStorage.removeItem(AUTOSAVE_STORAGE_KEY);
        }
      }
    } catch (e) {
      console.warn('[AutoSave] Failed to restore saved state', e);
    }
  }, [setTotalFrames, setProjectResolution, setTracks, setCharacterParts, setFps]);

  // 2. Auto-Save System: Every 10 Seconds
  const performSave = useCallback(() => {
    try {
      const projectData = {
        name: sceneTitle || 'Unreal 2D Character Sequence',
        fps,
        totalFrames,
        projectResolution,
        tracks,
        characterParts,
        lastSavedTime: new Date().toISOString(),
      };
      localStorage.setItem(AUTOSAVE_STORAGE_KEY, JSON.stringify(projectData));
      setLastSavedAt(new Date());
    } catch (e) {
      console.error('[AutoSave] Failed to save project to LocalStorage', e);
    }
  }, [sceneTitle, fps, totalFrames, projectResolution, tracks, characterParts]);

  useEffect(() => {
    const timer = setInterval(() => {
      performSave();
    }, 10000); // 10 seconds auto-save interval

    return () => clearInterval(timer);
  }, [performSave]);

  const triggerManualSave = useCallback(() => {
    performSave();
  }, [performSave]);

  const exportProject = useCallback((): string => {
    const activeTemplateName = sceneTitle || 'Template';
    const project: AnimationProject = {
      name: activeTemplateName,
      templateId: activeProjectTemplateId,
      fps,
      totalFrames,
      projectResolution,
      motionTemplates, // Includes all inner sequences (In, Out, Stunts, custom sequences) for this template!
      tracks, // Includes all tracks & keyframes across all sequences for this template!
      characterParts, // Includes all elements (shapes, text, cards, media) in this template!
    };
    return JSON.stringify(project, null, 2);
  }, [sceneTitle, activeProjectTemplateId, fps, totalFrames, projectResolution, motionTemplates, tracks, characterParts]);

  const importProject = useCallback((jsonStr: string, defaultName?: string): boolean => {
    try {
      const parsed: AnimationProject & { sceneTitle?: string } = JSON.parse(jsonStr);
      if (!parsed) return false;
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

        // 1. Save current active template state & add new template to store
        setTemplateCanvasStore((prev: any) => ({
          ...prev,
          [activeProjectTemplateId]: {
            characterParts,
            tracks,
            motionTemplates,
            activeTemplateId,
          },
          [newId]: {
            characterParts: importedParts,
            tracks: importedTracks,
            motionTemplates: importedMotionTemplates,
            activeTemplateId: initialSeqId,
          },
        }));

        // 2. Add new Template tab and switch to it as active tab
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
