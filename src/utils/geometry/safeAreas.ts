/**
 * Broadcast safe areas (EBU R95): action-safe keeps 3.5 % of the picture
 * width and height clear on every side (93 % of the frame), graphics-safe
 * (title-safe) keeps 5 % clear (90 %). They are editor guides only.
 */
export const ACTION_SAFE = 0.93;
export const TITLE_SAFE = 0.9;

export interface SafeAreaRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The safe-area rectangle that covers `fraction` of the artboard, centred on it. */
export const safeAreaRect = (artX: number, artY: number, width: number, height: number, fraction: number): SafeAreaRect => {
  const insetX = (width * (1 - fraction)) / 2;
  const insetY = (height * (1 - fraction)) / 2;
  return { x: artX + insetX, y: artY + insetY, width: width - 2 * insetX, height: height - 2 * insetY };
};
