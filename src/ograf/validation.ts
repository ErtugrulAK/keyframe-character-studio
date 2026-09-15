import type { SceneData, SceneLayer } from '../types/composition';
import { isPrototypeSensitiveKey, normalizePackagePath } from '../utils/pathSafety';
import {
  type OGrafAssetPlan,
  type OGrafDiagnosticCode,
  type OGrafExportDiagnostic,
  type OGrafExportOptions,
  type OGrafPublicColorField,
  type OGrafPublicImageField,
  type OGrafPublicTextField,
  type OGrafPublicStateSchema,
  type ValidatedOGrafScene,
} from './types';
import { resolveOGrafPublicControls } from './publicControls';
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
function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function invalidProject(
  diagnostics: OGrafExportDiagnostic[],
  message: string,
  layer?: SceneLayer,
  feature?: string,
): void {
  diagnostics.push(diagnostic('OGRAF_INVALID_PROJECT', 'ERROR', message, layer, feature));
}

function validateFiniteFields(
  value: Record<string, unknown>,
  fields: readonly string[],
  diagnostics: OGrafExportDiagnostic[],
  layer: SceneLayer,
  feature: string,
): void {
  for (const field of fields) {
    if (value[field] !== undefined && !isFiniteNumber(value[field])) {
      invalidProject(diagnostics, `${feature} field "${field}" must be a finite number.`, layer, feature);
    }
  }
}

function validateRequiredFiniteFields(
  value: Record<string, unknown>,
  fields: readonly string[],
  diagnostics: OGrafExportDiagnostic[],
  layer: SceneLayer,
  feature: string,
): void {
  for (const field of fields) {
    if (!isFiniteNumber(value[field])) {
      invalidProject(diagnostics, `${feature} field "${field}" must be a finite number.`, layer, feature);
    }
  }
}

function validatePathPoints(
  points: unknown,
  diagnostics: OGrafExportDiagnostic[],
  layer: SceneLayer,
  feature: string,
): void {
  if (points === undefined) return;
  if (!Array.isArray(points)) {
    invalidProject(diagnostics, `${feature} must be an array.`, layer, feature);
    return;
  }
  for (const point of points) {
    if (!point || typeof point !== 'object' || Array.isArray(point)) {
      invalidProject(diagnostics, `${feature} contains an invalid point.`, layer, feature);
      continue;
    }
    const candidate = point as Record<string, unknown>;
    if (!isFiniteNumber(candidate.x) || !isFiniteNumber(candidate.y)) {
      invalidProject(diagnostics, `${feature} points must contain finite x and y values.`, layer, feature);
    }
    for (const handle of ['handleIn', 'handleOut']) {
      const rawHandle = candidate[handle];
      if (rawHandle === undefined) continue;
      if (!rawHandle || typeof rawHandle !== 'object' || Array.isArray(rawHandle)
        || !isFiniteNumber((rawHandle as Record<string, unknown>).x)
        || !isFiniteNumber((rawHandle as Record<string, unknown>).y)) {
        invalidProject(diagnostics, `${feature} handles must contain finite x and y values.`, layer, feature);
      }
    }
  }
}

function validateKeyframeMetadata(
  candidate: Record<string, unknown>,
  diagnostics: OGrafExportDiagnostic[],
  layer: SceneLayer,
  feature: string,
): void {
  validateRequiredFiniteFields(candidate, ['frame'], diagnostics, layer, feature);
  for (const handle of ['bezierIn', 'bezierOut']) {
    const value = candidate[handle];
    if (value === undefined) continue;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      invalidProject(diagnostics, `${feature} ${handle} must be an object with finite x and y values.`, layer, feature);
      continue;
    }
    validateRequiredFiniteFields(value as Record<string, unknown>, ['x', 'y'], diagnostics, layer, feature);
  }
  const controlPoints = candidate.bezierControlPoints;
  if (controlPoints !== undefined
    && (!Array.isArray(controlPoints)
      || controlPoints.length !== 4
      || controlPoints.some((value) => !isFiniteNumber(value)))) {
    invalidProject(diagnostics, `${feature} bezierControlPoints must contain exactly four finite numbers.`, layer, feature);
  }
}

function validateKeyframeArray(
  keyframes: unknown,
  diagnostics: OGrafExportDiagnostic[],
  layer: SceneLayer,
  feature: string,
): void {
  if (keyframes === undefined) return;
  if (!Array.isArray(keyframes)) {
    invalidProject(diagnostics, `${feature} must be an array.`, layer, feature);
    return;
  }
  for (const keyframe of keyframes) {
    if (!keyframe || typeof keyframe !== 'object' || Array.isArray(keyframe)) {
      invalidProject(diagnostics, `${feature} contains an invalid keyframe.`, layer, feature);
      continue;
    }
    const candidate = keyframe as Record<string, unknown>;
    validateKeyframeMetadata(candidate, diagnostics, layer, feature);
    validateRequiredFiniteFields(candidate, ['value'], diagnostics, layer, feature);
  }
}

function validateLegacyKeyframeArray(
  keyframes: unknown,
  diagnostics: OGrafExportDiagnostic[],
  layer: SceneLayer,
  feature: string,
): void {
  if (keyframes === undefined) return;
  if (!Array.isArray(keyframes)) {
    invalidProject(diagnostics, `${feature} must be an array.`, layer, feature);
    return;
  }
  for (const keyframe of keyframes) {
    if (!keyframe || typeof keyframe !== 'object' || Array.isArray(keyframe)) {
      invalidProject(diagnostics, `${feature} contains an invalid keyframe.`, layer, feature);
      continue;
    }
    const candidate = keyframe as Record<string, unknown>;
    validateKeyframeMetadata(candidate, diagnostics, layer, feature);
    if (!candidate.transform || typeof candidate.transform !== 'object' || Array.isArray(candidate.transform)) {
      invalidProject(diagnostics, `${feature} transform must be an object.`, layer, feature);
      continue;
    }
    validateRequiredFiniteFields(
      candidate.transform as Record<string, unknown>,
      ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity'],
      diagnostics,
      layer,
      feature,
    );
  }
}

function validateLayerInput(layer: SceneLayer, diagnostics: OGrafExportDiagnostic[]): void {
  const record = layer as unknown as Record<string, unknown>;
  validateFiniteFields(
    record,
    ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity', 'zIndex'],
    diagnostics,
    layer,
    'layer',
  );
  for (const field of ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity', 'zIndex']) {
    if (!isFiniteNumber(record[field])) {
      invalidProject(diagnostics, `Layer field "${field}" must be a finite number.`, layer, 'layer');
    }
  }
  validateFiniteFields(
    record,
    ['fillOpacity', 'strokeWidth', 'strokeOpacity', 'trimPathStart', 'trimPathEnd', 'trimPathOffset',
      'shadowBlur', 'shadowOffsetX', 'shadowOffsetY', 'borderRadius', 'fontSize', 'width', 'height',
      'inAnimDuration', 'outAnimDuration'],
    diagnostics,
    layer,
    'layer',
  );
  for (const field of ['id', 'name', 'type', 'fillColor', 'strokeColor', 'textValue', 'fontFamily', 'imageUrl', 'videoUrl']) {
    if (record[field] !== undefined && typeof record[field] !== 'string') {
      invalidProject(diagnostics, `Layer field "${field}" must be a string.`, layer, 'layer');
    }
  }
  if (layer.strokeAlignment !== undefined
    && !['center', 'inside', 'outside'].includes(layer.strokeAlignment)) {
    invalidProject(diagnostics, `Layer strokeAlignment "${String(layer.strokeAlignment)}" is not supported.`, layer, 'style');
  }
  validatePathPoints(record.points, diagnostics, layer, 'layer points');
  if (record.path && typeof record.path === 'object') {
    validatePathPoints((record.path as Record<string, unknown>).points, diagnostics, layer, 'layer path');
  }
  for (const mask of layer.masks || []) {
    if (!['add', 'subtract', 'intersect', 'difference'].includes(mask.mode)) {
      invalidProject(diagnostics, `Mask mode "${String(mask.mode)}" is not supported.`, layer, 'mask');
    }
    validateFiniteFields(
      mask as unknown as Record<string, unknown>,
      ['feather', 'opacity', 'expansion'],
      diagnostics,
      layer,
      'mask',
    );
    validatePathPoints(mask.path?.points, diagnostics, layer, 'mask path');
  }
  if (layer.matte) {
    const mode = layer.matte.mode;
    if (mode !== undefined && !['clip', 'alpha', 'luminance'].includes(mode)) {
      invalidProject(diagnostics, `Matte mode "${String(mode)}" is not supported.`, layer, 'matte');
    }
    validateFiniteFields(layer.matte as unknown as Record<string, unknown>, ['feather', 'strength'], diagnostics, layer, 'matte');
    if (layer.matte.gradient) {
      if (layer.matte.gradient.type !== undefined && !['linear', 'radial'].includes(layer.matte.gradient.type)) {
        invalidProject(diagnostics, `Matte gradient type "${String(layer.matte.gradient.type)}" is not supported.`, layer, 'matte');
      }
      validateFiniteFields(layer.matte.gradient as unknown as Record<string, unknown>, ['angle'], diagnostics, layer, 'matte');
    }
  }
  if (layer.trackMatte && !['alpha', 'luminance'].includes(layer.trackMatte.mode)) {
    invalidProject(diagnostics, `Track matte mode "${String(layer.trackMatte.mode)}" is not supported.`, layer, 'track-matte');
  }
}
function validateTrackInput(
  track: unknown,
  diagnostics: OGrafExportDiagnostic[],
  layer: SceneLayer,
): void {
  if (!track || typeof track !== 'object') {
    invalidProject(diagnostics, 'Animation track must be an object.', layer, 'channels');
    return;
  }
  const candidate = track as Record<string, unknown>;
  validateLegacyKeyframeArray(candidate.keyframes, diagnostics, layer, 'track keyframes');
  for (const [channel, keyframes] of Object.entries(candidate.channels || {})) {
    validateKeyframeArray(keyframes, diagnostics, layer, `track channel "${channel}"`);
  }
  for (const [channel, keyframes] of Object.entries(candidate.maskChannels || {})) {
    validateKeyframeArray(keyframes, diagnostics, layer, `mask channel "${channel}"`);
  }
  for (const [channel, keyframes] of Object.entries(candidate.maskPathChannels || {})) {
    if (!Array.isArray(keyframes)) {
      invalidProject(diagnostics, `Mask path channel "${channel}" must be an array.`, layer, 'channels');
      continue;
    }
    for (const keyframe of keyframes) {
      if (!keyframe || typeof keyframe !== 'object' || Array.isArray(keyframe)) {
        invalidProject(diagnostics, `Mask path channel "${channel}" contains an invalid keyframe.`, layer, 'channels');
        continue;
      }
      const pathKeyframe = keyframe as Record<string, unknown>;
      validateKeyframeMetadata(pathKeyframe, diagnostics, layer, `mask path channel "${channel}"`);
      const value = pathKeyframe.value;
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        invalidProject(diagnostics, `Mask path channel "${channel}" contains an invalid path.`, layer, 'channels');
        continue;
      }
      validatePathPoints((value as Record<string, unknown>).points, diagnostics, layer, `mask path channel "${channel}"`);
    }
  }
}

function normalizePackagedPath(source: string, kind: 'image' | 'font', configuredPath?: string): string {
  const extension = source.split(/[?#]/u)[0].split('.').pop()?.toLowerCase() || (kind === 'image' ? 'asset' : 'font');
  const fallback = `assets/${kind}s/${source.split(/[\\/]/u).pop()?.split(/[?#]/u)[0] || `asset.${extension}`}`;
  const base = configuredPath || fallback;
  return normalizePackagePath(base).replace(/^\.\/+/u, '');
}
function validatePublicFields(
  textFields: OGrafPublicTextField[],
  imageFields: OGrafPublicImageField[],
  colorFields: OGrafPublicColorField[],
  layers: SceneLayer[],
  diagnostics: OGrafExportDiagnostic[],
): void {
  const ids = new Set<string>();
  const layerIds = new Set(layers.map((layer) => layer.id));
  for (const field of [...textFields, ...imageFields, ...colorFields]) {
    if (isPrototypeSensitiveKey(field.id)
      || !field.id
      || ids.has(field.id)
      || !field.layerId
      || !layerIds.has(field.layerId)) {
      diagnostics.push({
        code: 'OGRAF_INVALID_PUBLIC_FIELD',
        severity: 'ERROR',
        message: `Public field "${field.id || '<empty>'}" must have a unique id and a valid layerId.`,
        ...(field.layerId ? { layerId: field.layerId } : {}),
        feature: 'public-state',
      });
    }
    if (field.id) ids.add(field.id);
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

  const packagedPath = normalizePackagedPath(source, kind, catalogEntry?.packagedPath);

  return {
    source,
    packagedPath,
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
  const packagedPath = normalizePackagedPath(layer.fontFamily, 'font', entry.packagedPath || `assets/fonts/${safeName}.font`);
  assets.push({
    source,
    packagedPath,
    kind: 'font',
    ...(entry.sourcePath ? { sourcePath: entry.sourcePath } : {}),
    ...(entry.binaryContent ? { binaryContent: entry.binaryContent } : {}),
  });
}

function validateLayer(layer: SceneLayer, options: OGrafExportOptions, diagnostics: OGrafExportDiagnostic[], assets: OGrafAssetPlan[]): void {
  validateLayerInput(layer, diagnostics);
  if (isPrototypeSensitiveKey(layer.id)) {
    diagnostics.push(diagnostic('OGRAF_INVALID_PROJECT', 'ERROR', `Layer id "${layer.id}" is reserved and cannot be imported safely.`, layer, 'layer-id'));
  }
  for (const mask of layer.masks || []) {
    if (isPrototypeSensitiveKey(mask.id)) {
      diagnostics.push(diagnostic('OGRAF_INVALID_PROJECT', 'ERROR', `Mask id "${mask.id}" is reserved and cannot be imported safely.`, layer, 'mask-id'));
    }
  }
  if (!Object.prototype.hasOwnProperty.call(SUPPORTED_LAYER_TYPES, layer.type)) {
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

function createPublicStateSchema(
  textFields: OGrafPublicTextField[],
  imageFields: OGrafPublicImageField[],
  colorFields: OGrafPublicColorField[],
  assets: OGrafAssetPlan[],
): OGrafPublicStateSchema {
  const properties: Record<string, Record<string, unknown>> = Object.create(null);
  for (const field of textFields) {
    if (isPrototypeSensitiveKey(field.id)) continue;
    properties[field.id] = {
      type: 'string',
      ...(field.title ? { title: field.title } : {}),
      ...(field.defaultValue !== undefined ? { default: field.defaultValue } : {}),
    };
  }
  const packagedImageValues = assets.filter((asset) => asset.kind === 'image').map((asset) => asset.packagedPath);
  for (const field of imageFields) {
    if (isPrototypeSensitiveKey(field.id)) continue;
    properties[field.id] = {
      type: 'string',
      enum: field.options || packagedImageValues,
      ...(field.title ? { title: field.title } : {}),
      ...(field.defaultValue !== undefined ? { default: field.defaultValue } : {}),
    };
  }
  for (const field of colorFields) {
    if (isPrototypeSensitiveKey(field.id)) continue;
    properties[field.id] = {
      type: 'string',
      format: 'color',
      gddType: 'color-rrggbb',
      pattern: '^#[0-9a-f]{6}$',
      ...(field.title ? { title: field.title } : {}),
      ...(field.defaultValue !== undefined ? { default: field.defaultValue.toLowerCase() } : {}),
    };
  }
  return { type: 'object', properties, additionalProperties: false };
}

function validateLayerHierarchy(layers: SceneLayer[], diagnostics: OGrafExportDiagnostic[]): void {
  const layerById = new Map<string, SceneLayer>();
  for (const layer of layers) layerById.set(layer.id, layer);
  const relationships = new Map<string, string>();
  for (const layer of layers) {
    const parentId = layer.parentId ?? layer.booleanGroupId;
    if (!parentId) continue;
    if (isPrototypeSensitiveKey(parentId)) {
      invalidProject(
        diagnostics,
        `Layer parent "${parentId}" for layer "${layer.id}" is reserved.`,
        layer,
        'hierarchy',
      );
      continue;
    }
    if (!layerById.has(parentId)) continue;
    relationships.set(layer.id, parentId);
  }
  const visit = (id: string, visiting: Set<string>, visited: Set<string>): void => {
    if (visiting.has(id)) {
      const layer = layerById.get(id);
      invalidProject(diagnostics, `Layer parent cycle detected at "${id}".`, layer, 'hierarchy');
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    const parentId = relationships.get(id);
    if (parentId) visit(parentId, visiting, visited);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of relationships.keys()) visit(id, new Set(), new Set());
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

  for (const layer of sceneData.layers || []) validateLayer(layer, options, diagnostics, assets);
  for (const track of sceneData.tracks || []) {
    const layer = (sceneData.layers || []).find((candidate) => candidate.id === track.partId);
    if (layer) validateTrackInput(track, diagnostics, layer);
  }
  validateLayerHierarchy(sceneData.layers || [], diagnostics);
  const publicControls = resolveOGrafPublicControls(sceneData, options, assets);
  validatePublicFields(publicControls.textFields, publicControls.imageFields, publicControls.colorFields, sceneData.layers || [], diagnostics);
  const layerById = new Map((sceneData.layers || []).map((layer) => [layer.id, layer]));
  const relationships = new Map<string, string>();
  for (const layer of sceneData.layers || []) {
    const sourceId = layer.trackMatte?.sourceLayerId ?? layer.matte?.sourcePartId;
    if (!sourceId) continue;
    if (isPrototypeSensitiveKey(sourceId)) {
      diagnostics.push({
        code: 'OGRAF_INVALID_TRACK_MATTE',
        severity: 'ERROR',
        message: `Track matte source "${sourceId}" for layer "${layer.id}" is reserved and cannot be imported safely.`,
        layerId: layer.id,
        layerName: layer.name,
        feature: 'track-matte',
      });
      continue;
    }
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
    if (sourceId) visit(sourceId, visiting, visited);
    visiting.delete(id);
  };
  for (const id of relationships.keys()) visit(id, new Set(), new Set());
  const publicStateSchema = createPublicStateSchema(
    publicControls.textFields,
    publicControls.imageFields,
    publicControls.colorFields,
    assets,
  );
  return {
    sceneData,
    diagnostics,
    assets,
    publicStateSchema,
    publicTextFields: publicControls.textFields,
    publicImageFields: publicControls.imageFields,
    publicColorFields: publicControls.colorFields,
    canCompile: diagnostics.every((item) => item.severity !== 'ERROR'),
  };
}
