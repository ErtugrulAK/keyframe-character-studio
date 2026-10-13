import { useState, useCallback, useRef, useEffect } from 'react';
import { sanitizeProjectFps } from '../utils/timebase';

/**
 * Timeline playback.
 *
 * FPS/TIMEBASE CONTRACT (release critical, manual QA round four):
 *   seconds = frame / fps   and   frame = seconds * fps
 * The authored FPS is a TIME MAPPING, never a redraw budget. Playback therefore
 * integrates ELAPSED WALL-CLOCK TIME and steps the playhead by however many
 * whole authored frames that interval buys — it never advances exactly one
 * frame per `requestAnimationFrame` callback. A 30/60/120 FPS authoring of the
 * same animation reaches the same frame at the same wall-clock instant, on any
 * monitor refresh rate, and a dropped or throttled frame is recovered instead
 * of shortening the animation.
 */
export const usePlayback = () => {
  const [currentFrame, setCurrentFrame] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [fps, setFpsState] = useState<number>(60);
  const [totalFrames, setTotalFramesState] = useState<number>(60);

  const setTotalFrames = useCallback((newTotal: number | ((prev: number) => number)) => {
    setTotalFramesState((prev) => {
      const val = typeof newTotal === 'function' ? newTotal(prev) : newTotal;
      const clamped = Math.max(10, Math.min(1200, Math.round(val)));
      setCurrentFrame((cf) => Math.min(cf, clamped));
      return clamped;
    });
  }, []);

  const [isLooping, setIsLooping] = useState<boolean>(false);

  /**
   * The project frame rate is a positive, whole number of frames per second:
   * `seconds = frame / fps` has no meaning otherwise. The import boundary
   * already refuses a non-finite FPS; a document that still carries one (a
   * hand-edited file) keeps the current rate instead of poisoning every later
   * conversion with `Infinity` or `NaN`.
   */
  const setFps = useCallback((next: number | ((prev: number) => number)) => {
    setFpsState((prev) => sanitizeProjectFps(typeof next === 'function' ? next(prev) : next, prev));
  }, []);

  const fpsRef = useRef(fps);
  // Intentional latest-value mirror keeps the animation loop on the current FPS.
  // oxlint-disable-next-line react/refs
  fpsRef.current = fps;

  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  /**
   * The sub-frame remainder of the last wall-clock interval, in milliseconds.
   * It carries across callbacks so that time is never rounded away: the loop
   * converts accumulated TIME into frames, not callbacks into frames.
   */
  const frameRemainderMsRef = useRef<number>(0);

  // Playback Loop
  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      return;
    }

    // Automatically rewind to frame 0 if playback is started at or past totalFrames
    // Starting playback synchronizes the cursor with the playable frame range.
    // oxlint-disable-next-line react/set-state-in-effect
    setCurrentFrame((prev) => (prev >= totalFrames ? 0 : prev));

    const frameIntervalMs = 1000 / fps;
    frameRemainderMsRef.current = 0;

    const tick = (now: number) => {
      const elapsedMs = now - lastTimeRef.current;
      lastTimeRef.current = now;
      // Guard against a non-monotonic clock so time can never run backwards.
      frameRemainderMsRef.current = Math.max(0, frameRemainderMsRef.current + elapsedMs);

      const steps = Math.floor(frameRemainderMsRef.current / frameIntervalMs);
      if (steps > 0) {
        frameRemainderMsRef.current -= steps * frameIntervalMs;
        setCurrentFrame((prev) => {
          if (prev >= totalFrames) {
            if (isLooping) return 0;
            setIsPlaying(false);
            return prev;
          }
          const next = prev + steps;
          if (!isLooping && next >= totalFrames) {
            // Reaching the authored end stops playback AT the end pose; a
            // callback that elapsed several frames must not overshoot it.
            setIsPlaying(false);
            return totalFrames;
          }
          if (next <= totalFrames) return next;
          // Looping: wrap the overshoot into the playable range (0 and
          // totalFrames are the same pose, so the cycle is totalFrames + 1
          // frames long) instead of collapsing whole frames that elapsed while
          // the tab was throttled.
          return next % (totalFrames + 1);
        });
      }
      animationFrameRef.current = requestAnimationFrame(tick);
    };

    lastTimeRef.current = performance.now();
    animationFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, fps, totalFrames, isLooping]);

  return {
    currentFrame,
    setCurrentFrame,
    isPlaying,
    setIsPlaying,
    fps,
    setFps,
    totalFrames,
    setTotalFrames,
    isLooping,
    setIsLooping,
    fpsRef,
  };
};
