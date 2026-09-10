import type { SceneData, SceneLayer } from '../types/composition';
import {
  type OGrafAssetPlan,
  type OGrafDiagnosticCode,
  type OGrafExportDiagnostic,
  type OGrafExportOptions,
  type OGrafPublicStateSchema,
  type ValidatedOGrafScene,
} from './types';

const SUPPORTED_LAYER_TYPES: Record<string, true> = {
  custom_box: true,
  custom_rect: true,
  custom_circle: true,
  custom_triangle: true,
  custom_star: true,
  custom_diamond: true,
  custom_parallelogram: true,
  custom_capsule: true,
  custom_freeform: true,
  custom_text: true,
  custom_image: true,
};

const LOCAL_ASSET_PATTERN = /^(?:[a-zA-Z]:[\\/]|[./\\]|[^:?#]+$)/;

function diagnostic(
  code: OGrafDiagnosticCode,
  severity: 'ERROR' | 'WARNING',
  message: string,
  layer?: SceneLayer,
  feature?: string,
): OGrafExportDiagnostic {
  return {
    code,
    severity,
    message,
    ...(layer ? { layerId: layer.id, layerName: layer.name } : {}),
    ...(feature ? { feature } : {}),
  };
}

function isExternalAsset(value: string): boolean {
  return /^(?:https?:)?\/\//i.test(value) || /^data:/i.test(value);
}

function isLikelyLocalAsset(value: string): boolean {
  return LOCAL_ASSET_PATTERN.test(value) && !isExternalAsset(value);
}

function normalizePackagedPath(source: string, kind: 'image' | 'font', configuredPath?: string): string {
  const extension = source.split(/[?#]/u)[0].split('.').pop()?.toLowerCase() || (kind === 'image' ? 'asset' : 'font');
  const fallback = `assets/${kind}s/${source.split(/[\\/]/u).pop()?.split(/[?#]/u)[0] || `asset.${extension}`}`;
  const base = configuredPath?.replace(/\\/gu, '/') || fallback;
  return base.replace(/^\.\//u, '');
}
function validatePublicFields(options: OGrafExportOptions, layers: SceneLayer[], diagnostics: OGrafExportDiagnostic[]): void {
  const ids = new Set<string>();
  const layerIds = new Set(layers.map((layer) => layer.id));
  for (const field of [...(options.publicTextFields || []), ...(options.publicImageFields || [])]) {
    if (!field.id || ids.has(field.id) || !field.layerId || !layerIds.has(field.layerId)) {
      diagnostics.push({
        code: 'OGRAF_INVALID_PUBLIC_FIELD',
        severity: 'ERROR',
        message: `Public field "${field.id || '<empty>'}" must have a unique id and a valid layerId.`,
        ...(field.layerId ? { layerId: field.layerId } : {}),
        feature: 'public-state',
      });
    }
    ids.add(field.id);
  }
}

function validateAsset(
  source: string,
  kind: 'image' | 'font',
  options: OGrafExportOptions,
  diagnostics: OGrafExportDiagnostic[],
  layer?: SceneLayer,
): OGrafAssetPlan | undefined {
  if (isExternalAsset(source)) {
    if (!options.allowExternalResources) {
      diagnostics.push(diagnostic(
        'OGRAF_EXTERNAL_ASSET_REJECTED',
        'ERROR',
        `External ${kind} asset "${source}" is rejected by the default portable export policy.`,
        layer,
        kind,
      ));
      return undefined;
    }
    diagnostics.push(diagnostic(
      'OGRAF_ASSET_UNVERIFIED',
      'WARNING',
      `External ${kind} asset "${source}" is allowed explicitly but is not portable without network access.`,
      layer,
      kind,
    ));
    return undefined;
  }

  if (!isLikelyLocalAsset(source)) {
    diagnostics.push(diagnostic('OGRAF_MISSING_ASSET', 'ERROR', `Asset "${source}" is not a supported local asset reference.`, layer, kind));
    return undefined;
  }
  if (/^(?:[a-z]:[\\/]|[\\/])/iu.test(source)) {
    diagnostics.push(diagnostic('OGRAF_MISSING_ASSET', 'ERROR', `Asset "${source}" uses a machine-absolute path and cannot be packaged portably.`, layer, kind));
    return undefined;
  }

  const catalogEntry = options.assetCatalog?.[source];
  if (catalogEntry?.kind === 'missing') {
    diagnostics.push(diagnostic('OGRAF_MISSING_ASSET', 'ERROR', `Local ${kind} asset "${source}" is marked missing.`, layer, kind));
    return undefined;
  }
  if (catalogEntry?.kind === 'external' && !options.allowExternalResources) {
    diagnostics.push(diagnostic('OGRAF_EXTERNAL_ASSET_REJECTED', 'ERROR', `Asset "${source}" is marked external and external resources are disabled.`, layer, kind));
    return undefined;
  }
  if (!catalogEntry) {
    diagnostics.push(diagnostic('OGRAF_ASSET_UNVERIFIED', 'WARNING', `Local ${kind} asset "${source}" has no supplied asset catalog entry; packaging must verify it later.`, layer, kind));
  }

  return {
    source,
    packagedPath: normalizePackagedPath(source, kind, catalogEntry?.packagedPath),
    kind,
    ...(catalogEntry?.sourcePath ? { sourcePath: catalogEntry.sourcePath } : {}),
    ...(catalogEntry?.binaryContent ? { binaryContent: catalogEntry.binaryContent } : {}),
  };
}

function validateFont(
  layer: SceneLayer,
  options: OGrafExportOptions,
  diagnostics: OGrafExportDiagnostic[],
  assets: OGrafAssetPlan[],
): void {
  if (!layer.fontFamily) return;

  const source = `font:${layer.fontFamily}`;
  const entry = options.assetCatalog?.[source] || options.assetCatalog?.[layer.fontFamily];
  const hasPortableSource = entry?.kind === 'local' && Boolean(entry.sourcePath || entry.binaryContent);

  if (!hasPortableSource) {
    diagnostics.push(diagnostic(
      'OGRAF_FONT_UNVERIFIED',
      options.requirePortableAssets ? 'ERROR' : 'WARNING',
      `Display ${layer.name} uses ${layer.fontFamily}, but KCS has no portable font file for this font. Import/upload the font file or choose a portable font before OGraf export.`,
      layer,
      'font',
    ));
    return;
  }

  const safeName = layer.fontFamily.toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-+|-+$/gu, '') || 'font';
  assets.push({
    source,
    packagedPath: entry.packagedPath || `assets/fonts/${safeName}.font`,
    kind: 'font',
    ...(entry.sourcePath ? { sourcePath: entry.sourcePath } : {}),
    ...(entry.binaryContent ? { binaryContent: entry.binaryContent } : {}),
  });
}

function validateLayer(layer: SceneLayer, options: OGrafExportOptions, diagnostics: OGrafExportDiagnostic[], assets: OGrafAssetPlan[]): void {
  if (!SUPPORTED_LAYER_TYPES[layer.type]) {
    const code: OGrafDiagnosticCode = layer.type === 'custom_video'
      ? 'OGRAF_UNSUPPORTED_VIDEO'
      : layer.type === 'particle_system'
        ? 'OGRAF_UNSUPPORTED_PARTICLE'
        : layer.type === 'mograph_cloner'
          ? 'OGRAF_UNSUPPORTED_CLONER'
          : 'OGRAF_UNSUPPORTED_SHAPE';
    diagnostics.push(diagnostic(code, 'ERROR', `Layer type "${layer.type}" is not supported by OGraf Export V1.`, layer, layer.type));
  }

  if (layer.booleanOperation || layer.booleanOperandIds?.length || layer.booleanGroupId) {
    diagnostics.push(diagnostic('OGRAF_UNSUPPORTED_BOOLEAN', 'ERROR', 'Boolean groups are not supported by OGraf Export V1 yet.', layer, 'boolean'));
  }

  if (layer.imageUrl && layer.type !== 'custom_image') {
  }
  if (layer.imageUrl) {
    const asset = validateAsset(layer.imageUrl, 'image', options, diagnostics, layer);
    if (asset) assets.push(asset);
  }

  if (layer.fontFamily) {
    validateFont(layer, options, diagnostics, assets);
  }

  const matte = layer.matte;
  if (matte) {
    const mode = matte.mode || 'clip';
    if (mode === 'clip' && !matte.inverted && !(matte.feather || 0) && !matte.gradient) {
      diagnostics.push(diagnostic('OGRAF_CONDITIONAL_CLIP_MATTE', 'WARNING', 'Clip matte is emitted as a portable SVG clipPath.', layer, 'matte'));
    }
    if (mode !== 'clip' && matte.feather && matte.feather > 0) {
      diagnostics.push(diagnostic('OGRAF_UNSUPPORTED_FEATHER_MATTE', 'ERROR', 'Legacy matte feather cannot be emitted faithfully by OGraf Export V1.', layer, 'matte'));
    }
    if (mode !== 'clip' && matte.gradient) {
      diagnostics.push(diagnostic('OGRAF_UNSUPPORTED_GRADIENT_MATTE', 'ERROR', 'Legacy matte gradients cannot be emitted faithfully by OGraf Export V1.', layer, 'matte'));
    }
    if (mode !== 'clip' && matte.strength !== undefined && matte.strength !== 1) {
      diagnostics.push(diagnostic('OGRAF_UNSUPPORTED_ALPHA_MATTE', 'ERROR', 'Legacy matte strength cannot be emitted faithfully by OGraf Export V1.', layer, 'matte'));
    }
  }
  if (layer.trackMatte && layer.trackMatte.sourceLayerId === layer.id) {
    diagnostics.push(diagnostic('OGRAF_INVALID_TRACK_MATTE', 'ERROR', 'Track Matte V2 cannot reference its own layer.', layer, 'track-matte'));
  }

  const proceduralValues = [layer.inAnimPreset, layer.outAnimPreset].filter((value): value is string => Boolean(value));
  if (proceduralValues.some((value) => /(?:shake|random)/iu.test(value))) {
    diagnostics.push(diagnostic('OGRAF_UNSUPPORTED_NONDETERMINISTIC_PROCEDURAL', 'ERROR', 'Non-deterministic procedural animation is not supported by OGraf Export V1.', layer, 'procedural-animation'));
  }
}

function createPublicStateSchema(options: OGrafExportOptions, layers: SceneLayer[]): OGrafPublicStateSchema {
  const properties: Record<string, Record<string, unknown>> = {};
  for (const field of options.publicTextFields || []) {
    properties[field.id] = {
      type: 'string',
      ...(field.title ? { title: field.title } : {}),
      ...(field.defaultValue !== undefined ? { default: field.defaultValue } : {}),
    };
  }
  const imageSources = new Set(layers.filter((layer) => layer.type === 'custom_image' && layer.imageUrl).map((layer) => layer.imageUrl as string));
  const packagedImageValues = Object.entries(options.assetCatalog || {})
    .filter(([source, entry]) => entry.kind === 'local' && imageSources.has(source))
    .map(([source]) => source);
  for (const field of options.publicImageFields || []) {
    properties[field.id] = {
      type: 'string',
      enum: packagedImageValues,
      ...(field.title ? { title: field.title } : {}),
      ...(field.defaultValue !== undefined ? { default: field.defaultValue } : {}),
    };
  }
  return { type: 'object', properties, additionalProperties: false };
}

export function validateSceneForOGraf(sceneData: SceneData, options: OGrafExportOptions = {}): ValidatedOGrafScene {
  const diagnostics: OGrafExportDiagnostic[] = [];
  const assets: OGrafAssetPlan[] = [];

  if (!sceneData || (sceneData.version !== 1 && sceneData.version !== 2) || !Number.isFinite(sceneData.width) || !Number.isFinite(sceneData.height) || !Number.isFinite(sceneData.fps)) {
    diagnostics.push({ code: 'OGRAF_INVALID_PROJECT', severity: 'ERROR', message: 'SceneData must be a version 1 or version 2 project with finite width, height, and FPS.' });
  }
  if (!sceneData || sceneData.width <= 0 || sceneData.height <= 0 || sceneData.fps <= 0) {
    diagnostics.push({ code: 'OGRAF_INVALID_PROJECT', severity: 'ERROR', message: 'SceneData width, height, and FPS must be greater than zero.' });
  }

  validatePublicFields(options, sceneData.layers || [], diagnostics);
  for (const layer of sceneData.layers || []) validateLayer(layer, options, diagnostics, assets);
  const layerById = new Map((sceneData.layers || []).map((layer) => [layer.id, layer]));
  const relationships = new Map<string, string>();
  for (const layer of sceneData.layers || []) {
    const sourceId = layer.trackMatte?.sourceLayerId ?? layer.matte?.sourcePartId;
    if (!sourceId) continue;
    relationships.set(layer.id, sourceId);
    if (!layerById.has(sourceId)) {
      diagnostics.push({
        code: 'OGRAF_INVALID_TRACK_MATTE',
        severity: 'ERROR',
        message: `Track matte source "${sourceId}" for layer "${layer.id}" was not found.`,
        layerId: layer.id,
        layerName: layer.name,
        feature: 'track-matte',
      });
    }
  }
  const visit = (id: string, visiting: Set<string>, visited: Set<string>) => {
    if (visiting.has(id)) {
      const layer = layerById.get(id);
      diagnostics.push({
        code: 'OGRAF_INVALID_TRACK_MATTE',
        severity: 'ERROR',
        message: `Track matte cycle detected at layer "${id}".`,
        ...(layer ? { layerId: layer.id, layerName: layer.name } : {}),
        feature: 'track-matte',
      });
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    const sourceId = relationships.get(id);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of relationships.keys()) visit(id, new Set(), new Set());
  return {
    sceneData,
    diagnostics,
    assets,
    publicStateSchema: createPublicStateSchema(options, sceneData.layers),
    canCompile: diagnostics.every((item) => item.severity !== 'ERROR'),
  };
}
