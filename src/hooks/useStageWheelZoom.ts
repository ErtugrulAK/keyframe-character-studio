import { useCallback, useEffect, useRef } from 'react';
import type { AppMode } from '../types/animator';
import { clampZoom, getCursorAnchoredCameraCenter, type StageCameraView } from '../utils/geometry/viewportMath';

interface StageWheelZoomInput {
  containerRef: React.RefObject<HTMLDivElement | null>;
  cameraViewRef: React.RefObject<StageCameraView | null>;
  zoomRef: React.RefObject<number>;
  appMode: AppMode;
  setZoomLevel: (zoom: number) => void;
  setCameraView: (view: StageCameraView) => void;
}

/** The stage's wheel zoom, anchored at the cursor. Moved out of `StageCanvas` unchanged. */
export const useStageWheelZoom = ({ containerRef, cameraViewRef, zoomRef, appMode, setZoomLevel, setCameraView }: StageWheelZoomInput): void => {
  /**
   * Wheel zoom, smooth: the step follows the wheel's own distance (a trackpad
   * pinch sends many small ones, a mouse notch one larger), and every wheel
   * event of one animation frame is applied together, so the stage renders
   * once per frame however fast the events come.
   */
  const pendingWheelRef = useRef<{ deltaY: number; clientX: number; clientY: number; frame: number | null }>({ deltaY: 0, clientX: 0, clientY: 0, frame: null });
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current || !cameraViewRef.current || appMode === 'broadcast') return;
    const pending = pendingWheelRef.current;
    // Lines and pages count as about 40 and 800 pixels.
    pending.deltaY += e.deltaY * (e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 800 : 1);
    pending.clientX = e.clientX;
    pending.clientY = e.clientY;
    if (pending.frame !== null) return;
    pending.frame = requestAnimationFrame(() => {
      pending.frame = null;
      const view = cameraViewRef.current;
      const deltaY = Math.max(-600, Math.min(600, pending.deltaY));
      pending.deltaY = 0;
      if (!view || deltaY === 0) return;
      const currentZoom = zoomRef.current;
      // 100 px of wheel (one mouse notch) is a 1.16x step.
      const nextZoom = clampZoom(currentZoom * Math.exp(-deltaY * 0.0015));
      if (nextZoom === currentZoom) return;
      zoomRef.current = nextZoom;
      setZoomLevel(nextZoom);
      setCameraView({
        baseScale: view.baseScale,
        center: getCursorAnchoredCameraCenter({
          view,
          clientX: pending.clientX,
          clientY: pending.clientY,
          zoom: currentZoom,
          nextZoom,
        }),
      });
    });
  }, [appMode, containerRef, cameraViewRef, zoomRef, setZoomLevel, setCameraView]);
  useEffect(() => () => {
    const frame = pendingWheelRef.current.frame;
    if (frame !== null) cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [containerRef, handleWheel]);
};
