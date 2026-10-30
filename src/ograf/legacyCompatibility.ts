import type { SceneData, SceneLayer } from '../types/composition';
import type { OGrafExportOptions } from './types';
import { matchTextFontFamily } from '../utils/textFonts';
import playfairDisplayUrl from '../assets/fonts/playfair-display/PlayfairDisplay.ttf?url';
import playfairDisplayLicense from '../assets/fonts/playfair-display/OFL.txt?raw';
import { EMBEDDED_IMAGE_MIME_TYPES, decodeDataUrl, isSafeEmbeddedImage } from '../utils/embeddedImage';
import { BUNDLED_TEXT_FONTS, type BundledFontFamily } from './bundledFonts';
import type { OGrafAssetCatalogEntry } from './types';

interface LegacyOGrafPreparation {
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

async function readBlobUrl(source: string): Promise<{ bytes: Uint8Array; mimeType: string } | undefined> {
  if (!source.startsWith('blob:') || typeof fetch !== 'function') return undefined;
  try {
    const response = await fetch(source);
    if (!response.ok) return undefined;
    const blob = await response.blob();
    const mimeType = (blob.type || response.headers.get('content-type') || '').split(';', 1)[0].trim().toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(EMBEDDED_IMAGE_MIME_TYPES, mimeType) || blob.size <= 0) return undefined;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return bytes.length > 0 && isSafeEmbeddedImage(bytes, mimeType) ? { bytes, mimeType } : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Pinned integrity of the project-owned Playfair Display face.
 *
 * The 4-byte sfnt signature alone is a weak gate: a truncated or mutated file
 * passes it and then fails in the font decoder, so a broken asset could ship as
 * a "ready" package. The owned bytes are pinned to their exact SHA-256, and any
 * other bytes are refused. This applies to the PROJECT-OWNED asset only — a
 * caller-supplied catalog font is never checked against this hash.
 */
const PLAYFAIR_DISPLAY_SHA256 = 'c40f2293766a503bc70cce9e512ef844a4ccb7cbcde792fe2ea31d191917d8d6';

const sha256Hex = async (bytes: Uint8Array): Promise<string | undefined> => {
  try {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) return undefined;
    const digest = await subtle.digest('SHA-256', bytes.slice());
    return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  } catch {
    return undefined;
  }
};

/** The owned bytes at `url`, or undefined unless they hash to `sha256` exactly. */
async function readPinnedBytes(url: string, sha256: string): Promise<Uint8Array | undefined> {
  try {
    const response = await fetch(url);
    if (!response.ok) return undefined;
    const bytes = new Uint8Array(await response.arrayBuffer());
    return await sha256Hex(bytes) === sha256 ? bytes : undefined;
  } catch {
    return undefined;
  }
}

/**
 * A bundled WOFF2 family as one catalog entry: the Latin face, with the Latin
 * Extended face as an additional face (each with its unicode-range). Both
 * subsets are required — Turkish needs both — so a missing or mutated file
 * leaves the family unpackaged and the validator's font diagnostic stands.
 */
async function readBundledWoff2Family(family: BundledFontFamily): Promise<OGrafAssetCatalogEntry | undefined> {
  const [latin, latinExt] = family.faces;
  const [latinBytes, latinExtBytes] = await Promise.all([readPinnedBytes(latin.url, latin.sha256), readPinnedBytes(latinExt.url, latinExt.sha256)]);
  if (!latinBytes || !latinExtBytes) return undefined;
  return {
    kind: 'local',
    packagedPath: `assets/fonts/${family.slug}-latin.woff2`,
    binaryContent: latinBytes,
    unicodeRange: latin.unicodeRange,
    fontWeight: family.fontWeight,
    licenseText: family.licenseText,
    additionalFaces: [{ packagedPath: `assets/fonts/${family.slug}-latin-ext.woff2`, binaryContent: latinExtBytes, unicodeRange: latinExt.unicodeRange, fontWeight: family.fontWeight }],
  };
}

async function readBundledPlayfairFont(): Promise<PreparedAsset | undefined> {
  try {
    const response = await fetch(playfairDisplayUrl);
    if (!response.ok) return undefined;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length < 4 || new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0) !== 0x00010000) return undefined;
    // Integrity, not just the sfnt signature: the pinned hash IS the identity of
    // the owned face, so truncated or mutated bytes are refused.
    if (await sha256Hex(bytes) !== PLAYFAIR_DISPLAY_SHA256) return undefined;
    return { packagedPath: 'assets/fonts/playfair-display.ttf', binaryContent: bytes };
  } catch {
    // Missing owned bytes remain a blocking diagnostic in the canonical validator.
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

function finishPreparation(state: PreparationState, baseOptions: OGrafExportOptions = {}): LegacyOGrafPreparation {
  return { sceneData: state.sceneData, options: { ...baseOptions, assetCatalog: { ...(baseOptions.assetCatalog || {}), ...state.assetCatalog } } };
}

/**
 * Converts same-document embedded images and the bundled text fonts (Playfair
 * Display and the WOFF2 families of src/fonts.css) into owned package bytes. Remote, executable, file, and unsupported sources
 * remain untouched so the canonical OGraf validator keeps rejecting them.
 *
 * Data-only images retain the synchronous flow; blob images and bundled fonts
 * return a Promise because their browser bytes require fetch().
 */
export function prepareLegacyOGrafExport(sceneData: SceneData, baseOptions: OGrafExportOptions = {}): LegacyOGrafPreparation | Promise<LegacyOGrafPreparation> {
  const state: PreparationState = {
    sceneData: JSON.parse(JSON.stringify(sceneData)) as SceneData,
    assetCatalog: {},
    preparedBySource: new Map<string, PreparedAsset>(),
  };
  const blobLayers: Array<{ layer: SceneLayer; source: string }> = [];
  /** Layer font strings (as written) → the bundled family they name. */
  const bundledFontFamilies = new Map<string, string>();

  for (const layer of state.sceneData.layers) {
    const bundled = layer.fontFamily ? matchTextFontFamily(layer.fontFamily) : undefined;
    if (layer.fontFamily && bundled && (bundled === "'Playfair Display'" || BUNDLED_TEXT_FONTS[bundled])
      && !baseOptions.assetCatalog?.[`font:${layer.fontFamily}`] && !baseOptions.assetCatalog?.[layer.fontFamily]) {
      bundledFontFamilies.set(layer.fontFamily, bundled);
    }
    if (layer.type !== 'custom_image' || !layer.imageUrl) continue;
    const source = layer.imageUrl;
    const embedded = decodeDataUrl(source);
    if (embedded) applyPreparedAsset(layer, source, embedded, state);
    else if (source.startsWith('blob:')) blobLayers.push({ layer, source });
  }

  if (blobLayers.length === 0 && bundledFontFamilies.size === 0) return finishPreparation(state, baseOptions);
  return (async () => {
    const prepared = new Map<string, OGrafAssetCatalogEntry | undefined>();
    for (const [written, bundled] of bundledFontFamilies) {
      if (!prepared.has(bundled)) {
        if (bundled === "'Playfair Display'") {
          const font = await readBundledPlayfairFont();
          prepared.set(bundled, font && { kind: 'local', ...font, fontWeight: '400 900', licenseText: playfairDisplayLicense });
        } else {
          prepared.set(bundled, await readBundledWoff2Family(BUNDLED_TEXT_FONTS[bundled]));
        }
      }
      const entry = prepared.get(bundled);
      if (entry) state.assetCatalog[`font:${written}`] = entry;
    }
    for (const { layer, source } of blobLayers) {
      const embedded = await readBlobUrl(source);
      if (embedded) applyPreparedAsset(layer, source, embedded, state);
    }
    return finishPreparation(state, baseOptions);
  })();
}
