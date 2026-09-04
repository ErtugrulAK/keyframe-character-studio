import type { SceneData, SceneLayer } from '../types/composition';
import type { OGrafExportOptions } from './types';

const EMBEDDED_IMAGE_MIME_TYPES: Record<string, string> = {
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
};

export interface LegacyOGrafPreparation {
  sceneData: SceneData;
  options: OGrafExportOptions;
}

type PreparedAsset = { packagedPath: string; binaryContent: Uint8Array };

type PreparationState = {
  sceneData: SceneData;
  assetCatalog: NonNullable<OGrafExportOptions['assetCatalog']>;
  preparedBySource: Map<string, PreparedAsset>;
};

function hashBytes(bytes: Uint8Array): string {
  let hash = 2166136261;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function bytesFromBinaryString(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) bytes[index] = value.charCodeAt(index) & 0xff;
  return bytes;
}
function isSafeEmbeddedImage(bytes: Uint8Array, mimeType: string): boolean {
  if (mimeType !== 'image/svg+xml') return true;
  const source = new TextDecoder().decode(bytes);
  return !/<(?:script|iframe|object|foreignObject)\b|<!DOCTYPE\b|<!ENTITY\b|(?:on[a-z]+\s*=|(?:href|xlink:href)\s*=\s*["']?\s*(?:javascript:|data:))/iu.test(source);
}

function decodeDataUrl(source: string): { bytes: Uint8Array; mimeType: string } | undefined {
  const match = source.match(/^data:([^;,]+)(;base64)?,([\s\S]*)$/iu);
  if (!match) return undefined;
  const mimeType = match[1].toLowerCase();
  if (!EMBEDDED_IMAGE_MIME_TYPES[mimeType]) return undefined;
  try {
    const payload = match[2] ? atob(match[3]) : decodeURIComponent(match[3]);
    const bytes = bytesFromBinaryString(payload);
    return bytes.length > 0 && isSafeEmbeddedImage(bytes, mimeType) ? { bytes, mimeType } : undefined;
  } catch {
    return undefined;
  }
}

async function readBlobUrl(source: string): Promise<{ bytes: Uint8Array; mimeType: string } | undefined> {
  if (!source.startsWith('blob:') || typeof fetch !== 'function') return undefined;
  try {
    const response = await fetch(source);
    if (!response.ok) return undefined;
    const blob = await response.blob();
    const mimeType = (blob.type || response.headers.get('content-type') || '').split(';', 1)[0].trim().toLowerCase();
    if (!EMBEDDED_IMAGE_MIME_TYPES[mimeType] || blob.size <= 0) return undefined;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return bytes.length > 0 && isSafeEmbeddedImage(bytes, mimeType) ? { bytes, mimeType } : undefined;
  } catch {
    return undefined;
  }
}

function createPreparedAsset(bytes: Uint8Array, mimeType: string): PreparedAsset {
  return {
    packagedPath: `assets/images/legacy-${hashBytes(bytes)}.${EMBEDDED_IMAGE_MIME_TYPES[mimeType]}`,
    binaryContent: bytes,
  };
}

function applyPreparedAsset(layer: SceneLayer, source: string, embedded: { bytes: Uint8Array; mimeType: string }, state: PreparationState): void {
  const prepared = state.preparedBySource.get(source) || createPreparedAsset(embedded.bytes, embedded.mimeType);
  state.preparedBySource.set(source, prepared);
  layer.imageUrl = prepared.packagedPath;
  state.assetCatalog[prepared.packagedPath] = {
    kind: 'local',
    packagedPath: prepared.packagedPath,
    binaryContent: prepared.binaryContent,
  };
}

function finishPreparation(state: PreparationState): LegacyOGrafPreparation {
  return { sceneData: state.sceneData, options: { assetCatalog: state.assetCatalog } };
}

/**
 * Converts only same-document embedded image sources into owned package bytes.
 * Remote, executable, file, and unsupported data sources remain untouched so
 * the canonical OGraf validator rejects them instead of weakening policy.
 *
 * Data URLs are handled synchronously to preserve the existing export flow;
 * blob URLs return a Promise because their browser bytes require fetch().
 */
export function prepareLegacyOGrafExport(sceneData: SceneData): LegacyOGrafPreparation | Promise<LegacyOGrafPreparation> {
  const state: PreparationState = {
    sceneData: JSON.parse(JSON.stringify(sceneData)) as SceneData,
    assetCatalog: {},
    preparedBySource: new Map<string, PreparedAsset>(),
  };
  const blobLayers: Array<{ layer: SceneLayer; source: string }> = [];

  for (const layer of state.sceneData.layers) {
    if (layer.type !== 'custom_image' || !layer.imageUrl) continue;
    const source = layer.imageUrl;
    const embedded = decodeDataUrl(source);
    if (embedded) applyPreparedAsset(layer, source, embedded, state);
    else if (source.startsWith('blob:')) blobLayers.push({ layer, source });
  }

  if (blobLayers.length === 0) return finishPreparation(state);
  return (async () => {
    for (const { layer, source } of blobLayers) {
      const embedded = await readBlobUrl(source);
      if (embedded) applyPreparedAsset(layer, source, embedded, state);
    }
    return finishPreparation(state);
  })();
}
