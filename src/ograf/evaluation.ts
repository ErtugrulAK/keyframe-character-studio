import type { CharacterPart, Transform } from '../types/animator';
import type { EvaluatedFrame, EvaluatedLayer, RuntimeData, RuntimeTrackState, SceneData, SceneLayer } from '../types/composition';
import { evaluateFrame } from '../utils/evaluateFrame';
import { validateSceneForOGraf } from './validation';
import type { OGrafExportOptions } from './types';

export interface OGrafEvaluatedScene {
  frame: number;
  width: number;
  height: number;
  fps: number;
  layers: EvaluatedLayer[];
}

function toTransform(layer: SceneLayer): Transform {
  return {
    x: layer.x,
    y: layer.y,
    rotation: layer.rotation,
    scaleX: layer.scaleX,
    scaleY: layer.scaleY,
    opacity: layer.opacity,
  };
}

function toCharacterPart(layer: SceneLayer): CharacterPart {
  return {
    id: layer.id,
    name: layer.name,
    type: layer.type as CharacterPart['type'],
    zIndex: layer.zIndex,
    fillColor: layer.fillColor,
    strokeColor: layer.strokeColor,
    fillEnabled: layer.fillEnabled,
    fillOpacity: layer.fillOpacity,
    strokeEnabled: layer.strokeEnabled,
    strokeOpacity: layer.strokeOpacity,
    strokeWidth: layer.strokeWidth,
    strokeAlignment: layer.strokeAlignment,
    pivot: { x: 0, y: 0 },
    parentId: layer.parentId,
    baseTransform: toTransform(layer),
    matte: layer.matte,
    textValue: layer.textValue,
    fontSize: layer.fontSize,
    fontFamily: layer.fontFamily,
    imageUrl: layer.imageUrl,
    videoUrl: layer.videoUrl,
    points: layer.points,
    borderRadius: layer.borderRadius,
    width: layer.width,
    height: layer.height,
    trimPathEnabled: layer.trimPathEnabled,
    trimPathStart: layer.trimPathStart,
    trimPathEnd: layer.trimPathEnd,
    trimPathOffset: layer.trimPathOffset,
    inAnimPreset: layer.inAnimPreset,
    outAnimPreset: layer.outAnimPreset,
  };
}

function toRuntimeTracks(sceneData: SceneData): (typeof sceneData.tracks[number] & RuntimeTrackState)[] {
  return sceneData.tracks.map((track) => ({
    ...track,
    visible: sceneData.layers.find((layer) => layer.id === track.partId)?.visible !== false,
    editVisible: true,
  }));
}

function createRuntime(): RuntimeData {
  return {
    appMode: 'edit',
    broadcast: {},
    liveStunts: {},
  };
}

function assertExportable(sceneData: SceneData, options: OGrafExportOptions): void {
  const validation = validateSceneForOGraf(sceneData, options);
  const errors = validation.diagnostics.filter((diagnostic) => diagnostic.severity === 'ERROR');
  if (errors.length > 0) {
    throw new Error(`SceneData is not exportable: ${errors.map((diagnostic) => diagnostic.code).join(', ')}`);
  }
}

export function evaluateOGrafScene(
  sceneData: SceneData,
  frame: number,
  options: OGrafExportOptions = {},
): OGrafEvaluatedScene {
  assertExportable(sceneData, options);
  const layers = sceneData.layers.map(toCharacterPart);
  const evaluated: EvaluatedFrame = evaluateFrame(
    layers,
    toRuntimeTracks(sceneData),
    sceneData.totalFrames,
    frame,
    createRuntime(),
    [],
    undefined,
    options.sequenceId || 'Sequence',
  );
  const evaluatedLayers = evaluated.layers.map((layer) => {
    const source = sceneData.layers.find((candidate) => candidate.id === layer.id);
    const visible = source?.visible !== false && layer.visible;
    return {
      ...layer,
      visible,
      opacity: visible ? layer.opacity : 0,
    };
  });

  return {
    frame: evaluated.frame,
    width: sceneData.width,
    height: sceneData.height,
    fps: sceneData.fps,
    layers: evaluatedLayers,
  };
}
