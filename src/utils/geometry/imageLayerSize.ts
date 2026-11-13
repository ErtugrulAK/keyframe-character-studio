/** A new image layer's box: the picture fitted inside `maxDim` (140 × 140 when its size is unknown). */
export const fitImageSize = (naturalWidth: number, naturalHeight: number, maxDim = 150): { width: number; height: number } => {
  if (!naturalWidth || !naturalHeight) return { width: 140, height: 140 };
  return naturalWidth >= naturalHeight
    ? { width: maxDim, height: Math.round(maxDim * (naturalHeight / naturalWidth)) }
    : { width: Math.round(maxDim * (naturalWidth / naturalHeight)), height: maxDim };
};

/**
 * The box of an image layer whose picture is replaced: the width stays, the
 * height follows the new picture's proportions. A layer without a width (or a
 * picture of unknown size) keeps the box it had.
 */
export const replacedImageSize = (
  width: number | undefined,
  height: number | undefined,
  naturalWidth: number,
  naturalHeight: number,
): { width: number; height: number } => {
  const keptWidth = width && width > 0 ? width : 140;
  if (!naturalWidth || !naturalHeight) return { width: keptWidth, height: height && height > 0 ? height : keptWidth };
  return { width: keptWidth, height: Math.max(1, Math.round(keptWidth * (naturalHeight / naturalWidth))) };
};
