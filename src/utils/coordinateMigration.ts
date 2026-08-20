import type { AnimationTrackData, Keyframe, PropertyKeyframe } from '../types/animator';
import type { SceneCoordinateSystem, SceneData } from '../types/composition';

/** Current writer state: authoring paths still have mixed provenance. */
export const DEFAULT_SCENE_COORDINATE_SYSTEM: SceneCoordinateSystem = 'legacy-unknown';

const KNOWN_COORDINATE_SYSTEMS: readonly SceneCoordinateSystem[] = [
  'legacy-unknown',
  'legacy-centi-unit',
  'project-unit-center-v1',
];

export const isSceneCoordinateSystem = (value: unknown): value is SceneCoordinateSystem =>
  typeof value === 'string' && KNOWN_COORDINATE_SYSTEMS.includes(value as SceneCoordinateSystem);

/**
 * Detect persisted coordinate semantics without using numeric magnitude.
 * Missing or unknown metadata is intentionally treated as compatibility data.
 */
export const detectSceneCoordinateSystem = (
  scene: Pick<SceneData, 'coordinateSystem'>,
): SceneCoordinateSystem => (
  isSceneCoordinateSystem(scene.coordinateSystem)
    ? scene.coordinateSystem
    : DEFAULT_SCENE_COORDINATE_SYSTEM
);

const migrateValue = (value: number): number => value * 0.01;

const migratePropertyKeyframe = (keyframe: PropertyKeyframe): PropertyKeyframe => ({
  ...keyframe,
  value: migrateValue(keyframe.value),
});

const migrateLegacyKeyframe = (keyframe: Keyframe): Keyframe => ({
  ...keyframe,
  transform: {
    ...keyframe.transform,
    x: migrateValue(keyframe.transform.x),
    y: migrateValue(keyframe.transform.y),
  },
});

const migrateTrack = (track: AnimationTrackData): AnimationTrackData => ({
  ...track,
  channels: {
    ...track.channels,
    x: (track.channels.x || []).map(migratePropertyKeyframe),
    y: (track.channels.y || []).map(migratePropertyKeyframe),
  },
  keyframes: track.keyframes?.map(migrateLegacyKeyframe),
});

/**
 * Convert an explicitly tagged legacy scene to raw project-unit semantics.
 *
 * This function is pure, deterministic, non-heuristic, and idempotent. It
 * intentionally leaves geometry, matte fields, procedural data, and all
 * non-position animation channels untouched.
 */
export const migrateSceneCoordinates = (
  scene: SceneData,
  target: SceneCoordinateSystem = 'project-unit-center-v1',
): SceneData => {
  const source = detectSceneCoordinateSystem(scene);

  if (source !== 'legacy-centi-unit' || target !== 'project-unit-center-v1') {
    return { ...scene };
  }

  return {
    ...scene,
    coordinateSystem: target,
    layers: scene.layers.map((layer) => ({
      ...layer,
      x: migrateValue(layer.x),
      y: migrateValue(layer.y),
    })),
    tracks: scene.tracks.map(migrateTrack),
  };
};
