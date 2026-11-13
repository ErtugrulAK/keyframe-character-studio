/**
 * Puts a generated OGraf graphic on air at once. A graphic paints nothing
 * before its first playAction, so a test that inspects a frame plays it first;
 * `frame` then shows that frame of the timeline.
 */
export const onAir = async (graphic: HTMLElement, frame?: number): Promise<void> => {
  const live = graphic as unknown as { playAction: (params: { skipAnimation: boolean }) => Promise<unknown>; _currentFrame: number; _render: () => void };
  await live.playAction({ skipAnimation: true });
  if (frame !== undefined) {
    live._currentFrame = frame;
    live._render();
  }
};
