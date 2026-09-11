import type { SceneData, SceneLayer } from '../types/composition';
import type {
  OGrafAssetPlan,
  OGrafExportOptions,
  OGrafPublicColorField,
  OGrafPublicImageField,
  OGrafPublicTextField,
} from './types';

export interface OGrafPublicControls {
  textFields: OGrafPublicTextField[];
  imageFields: OGrafPublicImageField[];
  colorFields: OGrafPublicColorField[];
}

function safeName(value: string): string {
  const normalized = value
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]+/gu, '_')
    .replace(/^_+|_+$/gu, '')
    .toLowerCase();
  return normalized || 'layer';
}

function uniqueId(prefix: string, layer: SceneLayer, used: Set<string>): string {
  const preferred = prefix === 'text' && safeName(layer.name) === 'headline'
    ? 'headline'
    : `${prefix}_${safeName(layer.id || layer.name)}`;
  let id = preferred;
  let suffix = 2;
  while (used.has(id)) id = `${preferred}_${suffix++}`;
  used.add(id);
  return id;
}

function isPublicLayer(layer: SceneLayer, matteSourceIds: Set<string>): boolean {
  return layer.visible !== false && !matteSourceIds.has(layer.id);
}

function normalizeColor(value: string): string | undefined {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/iu.exec(value);
  if (!match) return undefined;
  const hex = match[1].toLowerCase();
  return hex.length === 3 ? `#${hex.split('').map((channel) => channel + channel).join('')}` : `#${hex}`;
}
function getImagePath(source: string | undefined, assets: OGrafAssetPlan[]): string | undefined {
  if (!source) return undefined;
  return assets.find((asset) => asset.kind === 'image' && asset.source === source)?.packagedPath;
}

function imageOptions(assets: OGrafAssetPlan[]): string[] {
  return assets.filter((asset) => asset.kind === 'image').map((asset) => asset.packagedPath);
}

export function resolveOGrafPublicControls(
  sceneData: SceneData,
  options: OGrafExportOptions,
  assets: OGrafAssetPlan[],
): OGrafPublicControls {
  const layers = sceneData.layers || [];
  const matteSourceIds = new Set(
    layers.flatMap((layer) => [
      layer.trackMatte?.enabled === false ? undefined : layer.trackMatte?.sourceLayerId,
      layer.matte?.enabled === false ? undefined : layer.matte?.sourcePartId,
    ].filter((id): id is string => Boolean(id))),
  );
  const used = new Set<string>();
  const textFields: OGrafPublicTextField[] = [];
  const imageFields: OGrafPublicImageField[] = [];
  const colorFields: OGrafPublicColorField[] = [];
  const packagedImageOptions = imageOptions(assets);

  for (const field of options.publicTextFields || []) {
    used.add(field.id);
    textFields.push({ ...field });
  }
  for (const field of options.publicImageFields || []) {
    used.add(field.id);
    const layer = layers.find((candidate) => candidate.id === field.layerId);
    const candidate = getImagePath(layer?.imageUrl, assets) || field.defaultValue;
    const defaultValue = candidate && packagedImageOptions.includes(candidate) ? candidate : undefined;
    imageFields.push({ ...field, options: packagedImageOptions, ...(defaultValue ? { defaultValue } : {}) });
  }
  for (const field of options.publicColorFields || []) {
    used.add(field.id);
    colorFields.push({ ...field });
  }

  for (const layer of layers) {
    if (!isPublicLayer(layer, matteSourceIds)) continue;
    if (layer.type === 'custom_text' && !textFields.some((field) => field.layerId === layer.id)) {
      textFields.push({
        id: uniqueId('text', layer, used),
        title: layer.name || 'Text',
        defaultValue: layer.textValue || '',
        layerId: layer.id,
      });
    }
    if (layer.type === 'custom_image' && layer.imageUrl && !imageFields.some((field) => field.layerId === layer.id)) {
      const defaultValue = getImagePath(layer.imageUrl, assets);
      if (defaultValue) {
        imageFields.push({
          id: uniqueId('image', layer, used),
          title: layer.name || 'Image',
          defaultValue,
          options: packagedImageOptions,
          layerId: layer.id,
        });
      }
    }
    if (layer.type === 'custom_image') continue;
    const fillDefault = normalizeColor(layer.fillColor);
    if (layer.type.startsWith('custom_') && layer.fillEnabled !== false && fillDefault && !colorFields.some((field) => field.layerId === layer.id && field.property === 'fillColor')) {
      colorFields.push({
        id: uniqueId('fill', layer, used),
        title: `${layer.name || 'Shape'} Fill Color`,
        defaultValue: fillDefault,
        layerId: layer.id,
        property: 'fillColor',
      });
    }
    const strokeDefault = normalizeColor(layer.strokeColor);
    if (layer.type.startsWith('custom_') && layer.strokeEnabled !== false && strokeDefault && !colorFields.some((field) => field.layerId === layer.id && field.property === 'strokeColor')) {
      colorFields.push({
        id: uniqueId('stroke', layer, used),
        title: `${layer.name || 'Shape'} Stroke Color`,
        defaultValue: strokeDefault,
        layerId: layer.id,
        property: 'strokeColor',
      });
    }
  }

  return { textFields, imageFields, colorFields };
}
