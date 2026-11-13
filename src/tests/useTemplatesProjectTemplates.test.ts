import { renderHook, act } from '@testing-library/react';
import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { useTemplates } from '../hooks/useTemplates';
import type { CharacterPart, Track } from '../types/animator';
import type { SceneCoordinateSystem } from '../types/composition';

/**
 * Project templates (the header's template tabs) and sequence step markers.
 * The scene arrays are real state here, so switching a tab can be observed
 * putting each template's own layers back.
 */
const part = (id: string) => ({ id, name: id }) as unknown as CharacterPart;
const track = (partId: string) => ({ id: `t_${partId}`, partId, keyframes: [], channels: {} }) as unknown as Track;

const renderTemplates = () => renderHook(() => {
  const [characterParts, setCharacterParts] = useState<CharacterPart[]>([part('a1')]);
  const [tracks, setTracks] = useState<Track[]>([track('a1')]);
  const [coordinateSystem, setCoordinateSystem] = useState<SceneCoordinateSystem>('project-unit-center-v1');
  const setFps = vi.fn();
  const templates = useTemplates({
    characterParts,
    setCharacterParts,
    tracks,
    setTracks,
    setFps,
    setTotalFrames: vi.fn(),
    setCurrentFrame: vi.fn(),
    setIsPlaying: vi.fn(),
    appMode: 'edit',
    coordinateSystem,
    setCoordinateSystem,
  });
  return { ...templates, characterParts, tracks, setCharacterParts, setFps };
});

describe('useTemplates — project templates', () => {
  it('a new template starts empty, is active, and takes its trimmed name', () => {
    const { result } = renderTemplates();
    act(() => result.current.addProjectTemplate('  Lower Third  '));
    expect(result.current.projectTemplates.map((t) => t.name)).toEqual(['Template', 'Lower Third']);
    expect(result.current.activeProjectTemplateId).toBe(result.current.projectTemplates[1].id);
    expect(result.current.sceneTitle).toBe('Lower Third');
    expect(result.current.characterParts).toEqual([]);
    expect(result.current.tracks).toEqual([]);
    expect(result.current.activeTemplateId).toBe('Sequence');
  });

  it('a blank name falls back to "New Template"', () => {
    const { result } = renderTemplates();
    act(() => result.current.addProjectTemplate('   '));
    expect(result.current.projectTemplates[1].name).toBe('New Template');
  });

  it('switching tabs stores the current layers and restores the target template', () => {
    const { result } = renderTemplates();
    act(() => result.current.addProjectTemplate('B'));
    const bId = result.current.activeProjectTemplateId;
    act(() => result.current.setCharacterParts([part('b1'), part('b2')]));

    act(() => result.current.setActiveProjectTemplateId('tmpl_1'));
    expect(result.current.characterParts.map((p) => p.id)).toEqual(['a1']);
    expect(result.current.sceneTitle).toBe('Template');

    act(() => result.current.setActiveProjectTemplateId(bId));
    expect(result.current.characterParts.map((p) => p.id)).toEqual(['b1', 'b2']);
    expect(result.current.sceneTitle).toBe('B');
  });

  it('switching to the active template is a no-op', () => {
    const { result } = renderTemplates();
    const before = result.current.templateCanvasStore;
    act(() => result.current.setActiveProjectTemplateId('tmpl_1'));
    expect(result.current.templateCanvasStore).toBe(before);
  });

  it('renaming the active template also renames the scene title; a blank name is ignored', () => {
    const { result } = renderTemplates();
    act(() => result.current.renameProjectTemplate('tmpl_1', '  Score Bug '));
    expect(result.current.projectTemplates[0].name).toBe('Score Bug');
    expect(result.current.sceneTitle).toBe('Score Bug');
    act(() => result.current.renameProjectTemplate('tmpl_1', '  '));
    expect(result.current.projectTemplates[0].name).toBe('Score Bug');
  });

  it('setSceneTitle renames the active template tab', () => {
    const { result } = renderTemplates();
    act(() => result.current.setSceneTitle('Weather'));
    expect(result.current.projectTemplates[0].name).toBe('Weather');
  });

  it('the last template cannot be deleted', () => {
    const { result } = renderTemplates();
    act(() => result.current.deleteProjectTemplate('tmpl_1'));
    expect(result.current.projectTemplates).toHaveLength(1);
    expect(result.current.characterParts.map((p) => p.id)).toEqual(['a1']);
  });

  it('deleting the active template switches to the first remaining one and drops its stored canvas', () => {
    const { result } = renderTemplates();
    act(() => result.current.addProjectTemplate('B'));
    const bId = result.current.activeProjectTemplateId;
    act(() => result.current.deleteProjectTemplate(bId));
    expect(result.current.projectTemplates.map((t) => t.id)).toEqual(['tmpl_1']);
    expect(result.current.activeProjectTemplateId).toBe('tmpl_1');
    expect(result.current.characterParts.map((p) => p.id)).toEqual(['a1']);
    expect(result.current.sceneTitle).toBe('Template');
    expect(result.current.templateCanvasStore[bId]).toBeUndefined();
  });

  it('deleting an inactive template leaves the open one untouched', () => {
    const { result } = renderTemplates();
    act(() => result.current.addProjectTemplate('B'));
    const bId = result.current.activeProjectTemplateId;
    act(() => result.current.setActiveProjectTemplateId('tmpl_1'));
    act(() => result.current.deleteProjectTemplate(bId));
    expect(result.current.activeProjectTemplateId).toBe('tmpl_1');
    expect(result.current.characterParts.map((p) => p.id)).toEqual(['a1']);
  });
});

describe('useTemplates — step markers', () => {
  it('stores markers normalized: rounded, unique, sorted and strictly inside the sequence', () => {
    const { result } = renderTemplates();
    act(() => result.current.setMotionTemplateStepMarkers('Sequence', [40, 10.4, 10, 0, 60, 75, Number.NaN]));
    expect(result.current.motionTemplates[0].stepMarkers).toEqual([10, 40]);
  });

  it('clearing the markers removes the field instead of storing an empty list', () => {
    const { result } = renderTemplates();
    act(() => result.current.setMotionTemplateStepMarkers('Sequence', [20]));
    act(() => result.current.setMotionTemplateStepMarkers('Sequence', []));
    expect('stepMarkers' in result.current.motionTemplates[0]).toBe(false);
  });

  it('leaves other sequences alone', () => {
    const { result } = renderTemplates();
    act(() => result.current.addMotionTemplate('Out', 'out'));
    const outId = result.current.motionTemplates[1].id;
    act(() => result.current.setMotionTemplateStepMarkers(outId, [5]));
    expect(result.current.motionTemplates[0].stepMarkers).toBeUndefined();
  });
});
