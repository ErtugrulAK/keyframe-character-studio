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
  const base = configuredPath?.replace(/^[\\/]+/u, '').replace(/\\/gu, '/') || `${kind}s/${source.split(/[\\/]/u).pop()?.split(/[?#]/u)[0] || `asset.${extension}`}`;
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
  };
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
    diagnostics.push(diagnostic('OGRAF_FONT_UNVERIFIED', 'WARNING', `Font "${layer.fontFamily}" requires a later local font asset resolution step.`, layer, 'font'));
  }

  const matte = layer.matte;
  if (matte) {
    const mode = matte.mode || 'clip';
    if (mode === 'alpha') diagnostics.push(diagnostic('OGRAF_UNSUPPORTED_ALPHA_MATTE', 'ERROR', 'Alpha mattes are deferred from OGraf Export V1.', layer, 'matte'));
    if (mode === 'luminance') diagnostics.push(diagnostic('OGRAF_UNSUPPORTED_LUMINANCE_MATTE', 'ERROR', 'Luminance mattes are deferred from OGraf Export V1.', layer, 'matte'));
    if (matte.inverted) diagnostics.push(diagnostic('OGRAF_UNSUPPORTED_INVERTED_MATTE', 'ERROR', 'Inverted mattes are deferred from OGraf Export V1.', layer, 'matte'));
    if ((matte.feather || 0) > 0) diagnostics.push(diagnostic('OGRAF_UNSUPPORTED_FEATHER_MATTE', 'ERROR', 'Feathered mattes are deferred from OGraf Export V1.', layer, 'matte'));
    if (matte.gradient) diagnostics.push(diagnostic('OGRAF_UNSUPPORTED_GRADIENT_MATTE', 'ERROR', 'Gradient mattes are deferred from OGraf Export V1.', layer, 'matte'));
    if (mode === 'clip' && !matte.inverted && !(matte.feather || 0) && !matte.gradient) {
      diagnostics.push(diagnostic('OGRAF_CONDITIONAL_CLIP_MATTE', 'WARNING', 'Clip matte requires standalone SVG renderer validation in a later phase.', layer, 'matte'));
    }
  }

  const proceduralValues = [layer.inAnimPreset, layer.outAnimPreset].filter((value): value is string => Boolean(value));
  if (proceduralValues.some((value) => /(?:shake|random)/iu.test(value))) {
    diagnostics.push(diagnostic('OGRAF_UNSUPPORTED_NONDETERMINISTIC_PROCEDURAL', 'ERROR', 'Non-deterministic procedural animation is not supported by OGraf Export V1.', layer, 'procedural-animation'));
  }
}

function createPublicStateSchema(options: OGrafExportOptions): OGrafPublicStateSchema {
  const properties: Record<string, Record<string, unknown>> = {};
  for (const field of options.publicTextFields || []) {
    properties[field.id] = {
      type: 'string',
      ...(field.title ? { title: field.title } : {}),
      ...(field.defaultValue !== undefined ? { default: field.defaultValue } : {}),
    };
  }
  for (const field of options.publicImageFields || []) {
    properties[field.id] = {
      type: 'string',
      ...(field.title ? { title: field.title } : {}),
      ...(field.defaultValue !== undefined ? { default: field.defaultValue } : {}),
    };
  }
  return { type: 'object', properties };
}

export function validateSceneForOGraf(sceneData: SceneData, options: OGrafExportOptions = {}): ValidatedOGrafScene {
  const diagnostics: OGrafExportDiagnostic[] = [];
  const assets: OGrafAssetPlan[] = [];

  if (!sceneData || sceneData.version !== 1 || !Number.isFinite(sceneData.width) || !Number.isFinite(sceneData.height) || !Number.isFinite(sceneData.fps)) {
    diagnostics.push({ code: 'OGRAF_INVALID_PROJECT', severity: 'ERROR', message: 'SceneData must be a version 1 project with finite width, height, and FPS.' });
  }
  if (sceneData.width <= 0 || sceneData.height <= 0 || sceneData.fps <= 0) {
    diagnostics.push({ code: 'OGRAF_INVALID_PROJECT', severity: 'ERROR', message: 'SceneData width, height, and FPS must be greater than zero.' });
  }

  validatePublicFields(options, sceneData.layers || [], diagnostics);
  for (const layer of sceneData.layers || []) validateLayer(layer, options, diagnostics, assets);

  return {
    sceneData,
    diagnostics,
    assets,
    publicStateSchema: createPublicStateSchema(options),
    canCompile: diagnostics.every((item) => item.severity !== 'ERROR'),
  };
}
