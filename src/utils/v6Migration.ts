import type { SceneLayer } from '../types/composition';
import type { LayerMask } from '../types/animator';
import {
  legacyFreeformPointsToPath,
  normalizeBezierPath,
} from './bezierPath';

/**
 * Additive V6 normalization for imported scene layers.
 * Legacy fields remain untouched so old render and re-save behavior survives.
 */
export const migrateSceneLayerV6 = (layer: SceneLayer): SceneLayer => {
  const path = layer.path
    ? normalizeBezierPath(layer.path, layer.path.coordinateSpace)
    : layer.type === 'custom_freeform' && layer.points?.length
      ? legacyFreeformPointsToPath(layer.points)
      : undefined;

  const masks = layer.masks?.map((mask: LayerMask) => {
    const path = normalizeBezierPath(mask.path, mask.path.coordinateSpace);
    return path ? { ...mask, path } : mask;
  });

  return {
    ...layer,
    ...(path ? { path } : {}),
    ...(masks ? { masks } : {}),
  };
};
