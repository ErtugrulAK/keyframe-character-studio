/**
 * An image the playout operator may give an image layer marked "Operator can
 * pick any image" (`CharacterPart.operatorImageAny`). Without the mark the
 * exported graphic only accepts its own packaged images.
 *
 * Accepted, after trimming: an http(s) or file address, a Windows file path
 * (turned into a file address), a base64 PNG / JPEG / GIF / WebP data address,
 * or a relative path. Anything else (javascript:, blob:, an SVG data address,
 * text with spaces or quotes) is refused, so the value can only ever name a
 * picture for an SVG <image>.
 *
 * The generated OGraf runtime repeats this rule inline (it cannot import
 * application modules); `src/tests/ografOperatorImage.test.ts` keeps the two
 * in step.
 */
export const MAX_OPERATOR_IMAGE_LENGTH = 2_000_000;
export const OPERATOR_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp'];

/** The address the graphic should load, or undefined when the value is refused. */
export const operatorImageAddress = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  if (!text || text.length > MAX_OPERATOR_IMAGE_LENGTH || /[\s"'<>`]/u.test(text)) return undefined;
  if (/^https?:\/\/[^/]/iu.test(text) || /^file:\/\//iu.test(text)) return text;
  if (/^data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+={0,2}$/iu.test(text)) return text;
  if (/^[a-z]:[\\/]/iu.test(text)) return 'file:///' + text.replace(/\\/gu, '/');
  // A relative path: no scheme, not protocol-relative.
  if (!/^[a-z][a-z0-9+.-]*:/iu.test(text) && !text.startsWith('//') && !text.startsWith('\\')) return text;
  return undefined;
};
