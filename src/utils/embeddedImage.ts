/**
 * The embedded-image policy shared by the OGraf export and the Lottie import:
 * which data-URL images the app embeds (an allowlist of MIME types plus an SVG
 * script check). Kept apart from the OGraf preparation so the importer does
 * not pull that lazily loaded module into the main bundle.
 */
export const EMBEDDED_IMAGE_MIME_TYPES: Record<string, string> = {
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
};

function bytesFromBinaryString(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) bytes[index] = value.charCodeAt(index) & 0xff;
  return bytes;
}

export function isSafeEmbeddedImage(bytes: Uint8Array, mimeType: string): boolean {
  if (mimeType !== 'image/svg+xml') return true;
  const source = new TextDecoder().decode(bytes);
  return !/<(?:script|iframe|object|foreignObject)\b|<!DOCTYPE\b|<!ENTITY\b|(?:on[a-z]+\s*=|(?:href|xlink:href)\s*=\s*["']?\s*(?:javascript:|data:))/iu.test(source);
}

export function decodeDataUrl(source: string): { bytes: Uint8Array; mimeType: string } | undefined {
  const match = source.match(/^data:([^;,]+)(;base64)?,([\s\S]*)$/iu);
  if (!match) return undefined;
  const mimeType = match[1].toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(EMBEDDED_IMAGE_MIME_TYPES, mimeType)) return undefined;
  try {
    const payload = match[2] ? atob(match[3]) : decodeURIComponent(match[3]);
    const bytes = bytesFromBinaryString(payload);
    return bytes.length > 0 && isSafeEmbeddedImage(bytes, mimeType) ? { bytes, mimeType } : undefined;
  } catch {
    return undefined;
  }
}

/**
 * True when `source` is a data URL whose MIME type and payload pass the
 * embedded-image policy (the allowlist above plus the SVG script check).
 *
 * The Lottie importer uses this instead of its own MIME list so a document can
 * never smuggle an image form the rest of the app refuses to embed.
 */
export const isSupportedEmbeddedImage = (source: string): boolean => decodeDataUrl(source) !== undefined;
