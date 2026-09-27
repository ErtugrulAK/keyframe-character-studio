import { useState, useCallback, useRef, useEffect } from 'react';

export const usePlayback = () => {
  const [currentFrame, setCurrentFrame] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [fps, setFps] = useState<number>(60);
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

  const fpsRef = useRef(fps);
  // Intentional latest-value mirror keeps the animation loop on the current FPS.
  // oxlint-disable-next-line react/refs
  fpsRef.current = fps;

  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

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

    const frameInterval = 1000 / fps;

    const tick = (now: number) => {
      const delta = now - lastTimeRef.current;
      if (delta >= frameInterval) {
        lastTimeRef.current = now - (delta % frameInterval);
        setCurrentFrame((prev) => {
          if (prev >= totalFrames) {
            if (isLooping) return 0;
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
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
