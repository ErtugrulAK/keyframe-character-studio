import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { SceneData } from '../../types/composition';
import type { OGrafExportDiagnostic } from '../../ograf/types';
import { useGifExport } from '../../hooks/useGifExport';
import { useFloatingPanel } from '../../hooks/useFloatingPanel';
import {
  GIF_EXPORT_FPS_OPTIONS,
  GIF_SCALE_OPTIONS,
  resolveGifDimensions,
  resolveGifExportFps,
  resolveGifFramePlan,
  resolveGifScale,
  validateGifScene,
} from '../../export/gifPlan';
import './GifExportPanel.css';

interface GifExportPanelProps {
  /** The scene snapshot the panel summarises and exports. */
  scene: SceneData;
  sceneTitle: string;
  onClose: () => void;
  onBlocked: (diagnostics: OGrafExportDiagnostic[]) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const scaleLabel = (scale: number): string => `${Math.round(scale * 1000) / 10}%`;

/**
 * The `Export as GIF` panel.
 *
 * It states exactly what will be written before it writes it: the export rate,
 * the pixel size, the frame count and the resulting duration, all derived from
 * the same plan the render uses (`export/gifPlan`). The two format facts the
 * user cannot act on — the 20 ms playback floor and one-bit transparency — are
 * carried as tooltips on the control they qualify, not as paragraph copy.
 *
 * It is NOT a blocking dialog: the editor stays usable behind it (the export
 * renders a snapshot, so editing cannot change what is being written). The
 * header X, Escape and an outside click dismiss it; a footer button would just
 * duplicate the X one row down.
 */
export const GifExportPanel: React.FC<GifExportPanelProps> = ({ scene, sceneTitle, onClose, onBlocked, showToast }) => {
  const [exportFps, setExportFps] = useState<number>(() => resolveGifExportFps(scene.fps));
  const [scale, setScale] = useState<number>(() => resolveGifScale(scene.width, scene.height));
  const gif = useGifExport({ sceneTitle, showToast, onBlocked });
  const closeRef = useRef<HTMLButtonElement>(null);
  const { panelRef } = useFloatingPanel({ isOpen: true, onClose });

  const plan = useMemo(
    () => resolveGifFramePlan({ totalFrames: scene.totalFrames, projectFps: scene.fps, exportFps }),
    [exportFps, scene.fps, scene.totalFrames],
  );
  const dimensions = useMemo(() => resolveGifDimensions(scene.width, scene.height, scale), [scale, scene.height, scene.width]);
  // A scene the GIF renderer cannot draw is stated up front, not after a render.
  const blocking = useMemo(() => validateGifScene(scene), [scene]);
  const textLayerCount = scene.layers.filter((layer) => layer.type === 'custom_text').length;

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [onClose]);

  return (
    <div ref={panelRef} className="gif-export-panel" role="dialog" aria-label="Export animated GIF">
      <header className="gif-export-header">
        <h2>Export as GIF</h2>
        <button
          type="button"
          className="gif-export-close"
          ref={closeRef}
          aria-label="Close the GIF export panel"
          onClick={onClose}
        >
          <X />
        </button>
      </header>

      <dl className="gif-export-summary" aria-label="What will be exported">
        <div>
          <dt>Frames</dt>
          <dd>{plan.frameCount}</dd>
        </div>
        <div>
          <dt>Duration</dt>
          <dd>{plan.durationSeconds.toFixed(2)} s</dd>
        </div>
        <div>
          <dt>Size</dt>
          <dd>{dimensions.width}×{dimensions.height}</dd>
        </div>
      </dl>

      <div className="gif-export-controls">
        <label htmlFor="gif-export-fps">
          Sampling rate
          <select
            id="gif-export-fps"
            value={exportFps}
            disabled={gif.isExporting}
            title={`${plan.exportFps} fps sampling. GIF playback uses at least 20 ms per frame; the full animation duration is preserved, rounded to hundredths of a second.`}
            onChange={(event) => setExportFps(Number(event.target.value))}
          >
            {GIF_EXPORT_FPS_OPTIONS.map((option) => (
              <option key={option} value={option}>{option} fps</option>
            ))}
          </select>
        </label>
        <label htmlFor="gif-export-scale">
          Size
          <select
            id="gif-export-scale"
            value={scale}
            disabled={gif.isExporting}
            title="The exported pixel size relative to the composition."
            onChange={(event) => setScale(Number(event.target.value))}
          >
            {GIF_SCALE_OPTIONS.map((option) => (
              <option key={option} value={option}>{scaleLabel(option)}</option>
            ))}
          </select>
        </label>
      </div>


      {blocking.length > 0 ? (
        <p className="gif-export-blocked" role="alert">
          This scene cannot be drawn frame by frame: {blocking[0].message}
          {blocking.length > 1 ? ` (+${blocking.length - 1} more)` : ''}
        </p>
      ) : gif.isExporting && gif.progress ? (
        <div className="gif-export-progress" role="status">
          <div className="gif-export-progress-track">
            <div
              className="gif-export-progress-value"
              style={{ width: `${gif.progress.total > 0 ? Math.round((gif.progress.completed / gif.progress.total) * 100) : 0}%` }}
            />
          </div>
          <span>{gif.progress.total > 0 ? `Frame ${gif.progress.completed} of ${gif.progress.total}` : 'Preparing frames…'}</span>
        </div>
      ) : gif.lastResult ? (
        <p className="gif-export-done" role="status">
          Last export: {gif.lastResult.frameCount} frames · {gif.lastResult.durationSeconds.toFixed(2)} s · {gif.lastResult.width}×{gif.lastResult.height}
        </p>
      ) : null}

      <div className="gif-export-actions">
        {gif.isExporting ? (
          <button type="button" className="gif-export-run" onClick={gif.cancel}>Cancel</button>
        ) : (
          <button
            type="button"
            className="gif-export-run"
            disabled={blocking.length > 0}
            title={textLayerCount > 0
              ? 'GIF has one transparent colour and no partial alpha, so soft transparency becomes a hard edge. Text uses the scene font when it can be embedded; otherwise a reported system-font fallback is used.'
              : 'GIF has one transparent colour and no partial alpha, so soft transparency becomes a hard edge.'}
            onClick={() => void gif.start({ scene, exportFps, scale })}
          >
            Export GIF
          </button>
        )}
      </div>
    </div>
  );
};
