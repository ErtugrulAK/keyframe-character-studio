/**
 * Layer crop: the part of a layer that stays visible, as a rectangle in the
 * layer's own (local, untransformed) units.
 *
 * Kept in local units so every renderer cuts the same area without measuring
 * the layer again: the stage, the static SVG and the OGraf graphic clip the
 * layer's transformed content with this rectangle, before its effects, so a
 * shadow or glow follows the cropped shape. The layer itself does not move or
 * scale; only what shows is trimmed. Self-contained: the OGraf runtime embeds
 * this exact source (`ograf/runtimeSnippets`).
 */
export interface LayerCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function createLayerCrop() {
  const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

  /** True for a crop the renderers can draw: four finite numbers and a positive size. */
  const isLayerCrop = (crop: unknown): crop is LayerCrop => {
    if (!crop || typeof crop !== 'object') return false;
    const value = crop as Record<string, unknown>;
    return finite(value.x) && finite(value.y) && finite(value.width) && finite(value.height) && (value.width as number) > 0 && (value.height as number) > 0;
  };

  /** The `<clipPath>` for a crop, in the layer's local space, or '' without one. */
  const cropClipMarkup = (crop: unknown, id: string): string => {
    if (!isLayerCrop(crop)) return '';
    const safeId = String(id).replace(/[^A-Za-z0-9_-]/g, '_');
    return '<clipPath id="' + safeId + '" clipPathUnits="userSpaceOnUse"><rect x="' + crop.x + '" y="' + crop.y + '" width="' + crop.width + '" height="' + crop.height + '"></rect></clipPath>';
  };

  return { isLayerCrop, cropClipMarkup };
}

export const { isLayerCrop, cropClipMarkup } = createLayerCrop();

/** The crop id a renderer uses for a layer (safe as an SVG id). */
export const layerCropId = (prefix: string, layerId: string): string => `${prefix}-${layerId}`.replace(/[^A-Za-z0-9_-]/g, '_');
