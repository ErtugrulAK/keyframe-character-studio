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

const isHexDigit = (byte: number | undefined): boolean =>
  byte !== undefined && ((byte >= 0x30 && byte <= 0x39) || (byte >= 0x41 && byte <= 0x46) || (byte >= 0x61 && byte <= 0x66));

/**
 * The bytes of a non-base64 data URL body, decoded as a browser does (URL
 * "percent-decode"): the text is UTF-8, and only a `%` followed by two hex
 * digits is an escaped byte, so `ı`, `ğ` or a bare `100%` survive.
 */
function percentDecodeToBytes(value: string): Uint8Array {
  const input = new TextEncoder().encode(value);
  const output = new Uint8Array(input.length);
  let length = 0;
  for (let index = 0; index < input.length; index += 1) {
    const byte = input[index];
    if (byte === 0x25 && isHexDigit(input[index + 1]) && isHexDigit(input[index + 2])) {
      output[length] = Number.parseInt(String.fromCharCode(input[index + 1], input[index + 2]), 16);
      index += 2;
    } else {
      output[length] = byte;
    }
    length += 1;
  }
  return output.subarray(0, length);
}

export function decodeDataUrl(source: string): { bytes: Uint8Array; mimeType: string } | undefined {
  // `data:<mime>[;param=value…][;base64],<body>`: parameters such as
  // `;charset=utf-8` may come before the base64 flag.
  const match = source.match(/^data:([^;,]+)((?:;[^;,]*)*),([\s\S]*)$/iu);
  if (!match) return undefined;
  const mimeType = match[1].trim().toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(EMBEDDED_IMAGE_MIME_TYPES, mimeType)) return undefined;
  const isBase64 = match[2].split(';').some((parameter) => parameter.trim().toLowerCase() === 'base64');
  try {
    const bytes = isBase64 ? bytesFromBinaryString(atob(match[3])) : percentDecodeToBytes(match[3]);
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
