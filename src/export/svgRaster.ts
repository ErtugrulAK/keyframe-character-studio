/**
 * SVG → pixels, for the GIF export.
 *
 * The frames come from the editor's OWN renderer: `renderOGrafSvg` turns an
 * evaluated scene into the same SVG markup the OGraf package carries, and this
 * module rasterises that markup. There is no second renderer, and a frame is a
 * pure function of the document, so the export is deterministic and does not
 * depend on the editor's DOM, its camera or its selection.
 *
 * The image context is isolated, which is exactly why the frame carries its
 * fonts and its images inline (see `fontEmbedding`) — an external resource would
 * simply not load, and the frame would silently miss it.
 */
import type { RgbaFrame } from './gifEncoder';

/** The stage's background is NOT painted: the GIF keeps its transparent area. */
export const rasterizeSvgFrame = async (
  svgMarkup: string,
  pixelWidth: number,
  pixelHeight: number,
  fontCss: string,
): Promise<RgbaFrame> => {
  const markup = fontCss.length > 0 ? injectFontStyles(svgMarkup, fontCss) : svgMarkup;
  const blob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('The browser did not provide a 2D canvas for the GIF export.');
    // No background fill: every pixel starts fully transparent, and the SVG's own
    // opacity decides what survives (GIF keeps that as its one transparent key).
    context.clearRect(0, 0, pixelWidth, pixelHeight);
    context.drawImage(image, 0, 0, pixelWidth, pixelHeight);
    return {
      data: context.getImageData(0, 0, pixelWidth, pixelHeight).data,
      width: pixelWidth,
      height: pixelHeight,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
};

/** The `@font-face` rules are placed INSIDE the rasterised document. */
const injectFontStyles = (svgMarkup: string, fontCss: string): string => {
  const openTagEnd = svgMarkup.indexOf('>');
  if (openTagEnd < 0) return svgMarkup;
  return `${svgMarkup.slice(0, openTagEnd + 1)}<style>${fontCss}</style>${svgMarkup.slice(openTagEnd + 1)}`;
};

/**
 * Yields to the browser between frames, so the progress the user is watching is
 * painted instead of appearing after the render. It is a cooperative yield (a
 * zero-delay task), never a delay that changes what is exported.
 */
export const yieldToBrowser = (): Promise<void> =>
  // The executor form is required here: the project's `lib` is ES2023, which has
  // no `Promise.withResolvers`.
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
