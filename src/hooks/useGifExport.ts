import { useCallback, useRef, useState } from 'react';
import type { SceneData } from '../types/composition';
import type { OGrafExportDiagnostic } from '../ograf/types';
import type { ToastOptions } from './useToast';
import { renderGif, type GifExportResult } from '../export/gifExport';
import { validateGifScene } from '../export/gifPlan';
import { downloadBlob } from '../utils/fileDownload';
import { sanitizeFilenameComponent } from '../utils/pathSafety';

type ShowToast = (message: string, type?: 'success' | 'error' | 'info', options?: ToastOptions) => void;

export interface GifExportProgressState {
  completed: number;
  total: number;
}

export interface GifExportStartOptions {
  /** The scene SNAPSHOT the panel summarised; never re-read while rendering. */
  scene: SceneData;
  exportFps: number;
  scale: number;
}

export interface GifExportController {
  isExporting: boolean;
  progress: GifExportProgressState | null;
  /** The finished export, for the summary the panel keeps on screen. */
  lastResult: Omit<GifExportResult, 'bytes'> | null;
  start: (options: GifExportStartOptions) => Promise<void>;
  cancel: () => void;
}

interface UseGifExportOptions {
  sceneTitle: string;
  showToast: ShowToast;
  /** Reports a scene that cannot be drawn as a GIF at all, in the export's own diagnostics. */
  onBlocked: (diagnostics: OGrafExportDiagnostic[]) => void;
}

/**
 * Runs an `Export as GIF` and reports its progress.
 *
 * The scene is a snapshot taken by the caller, the render itself is
 * `export/gifExport` (the editor's own evaluator and renderer, rasterised), and
 * cancellation is checked between frames — a cancelled export writes no file and
 * says so.
 */
export const useGifExport = ({ sceneTitle, showToast, onBlocked }: UseGifExportOptions): GifExportController => {
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [progress, setProgress] = useState<GifExportProgressState | null>(null);
  const [lastResult, setLastResult] = useState<Omit<GifExportResult, 'bytes'> | null>(null);
  const isExportingRef = useRef<boolean>(false);
  const cancelledRef = useRef<boolean>(false);

  const cancel = useCallback(() => {
    if (!isExportingRef.current) return;
    cancelledRef.current = true;
  }, []);

  const start = useCallback(async ({ scene, exportFps, scale }: GifExportStartOptions) => {
    if (isExportingRef.current) return;
    const blocking = validateGifScene(scene);
    if (blocking.length > 0) {
      onBlocked(blocking);
      return;
    }
    isExportingRef.current = true;
    cancelledRef.current = false;
    setIsExporting(true);
    setProgress({ completed: 0, total: 0 });
    try {
      const result = await renderGif({
        scene,
        exportFps,
        scale,
        onProgress: (next) => setProgress(next),
        shouldCancel: () => cancelledRef.current,
      });
      if (!result) {
        showToast('GIF export cancelled. Nothing was written.', 'info');
        return;
      }
      const fileName = `${sanitizeFilenameComponent(sceneTitle || 'Template', 'Template')}.gif`;
      downloadBlob(result.bytes, fileName, 'image/gif');
      setLastResult(result);
      showToast(
        `Exported "${fileName}" · ${result.frameCount} frames · ${result.durationSeconds.toFixed(2)} s · ${result.width}×${result.height}`,
        'success',
      );
      const missingFonts = result.sceneFontFamilies.filter((family) => !result.embeddedFontFamilies.includes(family));
      if (missingFonts.length > 0) {
        showToast(
          `The font${missingFonts.length > 1 ? 's' : ''} ${missingFonts.join(', ')} could not be embedded, so that text used a system family in the GIF.`,
          'info',
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected GIF export failure.';
      showToast(`Could not export a GIF: ${message}`, 'error');
    } finally {
      isExportingRef.current = false;
      setIsExporting(false);
      setProgress(null);
    }
  }, [onBlocked, sceneTitle, showToast]);

  return { isExporting, progress, lastResult, start, cancel };
};
