import React, { useState } from 'react';
import { Tv } from 'lucide-react';

const ZOOM_PRESETS = [25, 50, 100, 200, 400] as const;

interface StageZoomControlProps {
  /** Screen pixels per project pixel (1 = 100 %). */
  scale: number;
  /** Zoom to a screen scale (1 = 100 %), about the view centre. */
  onZoomTo: (scale: number) => void;
  /** Fit the whole artboard and centre it. */
  onFit: () => void;
  showSafeAreas: boolean;
  onToggleSafeAreas: () => void;
}

/**
 * The stage's view bar (bottom right): the zoom as a typed percentage, Fit,
 * 1:1, preset sizes and the safe-area guides. 100 % shows one project pixel as
 * one screen pixel. Zoom in and out stay on the toolbar (their one home).
 */
export const StageZoomControl: React.FC<StageZoomControlProps> = ({ scale, onZoomTo, onFit, showSafeAreas, onToggleSafeAreas }) => {
  const percent = Math.round(scale * 1000) / 10;
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const value = Number(draft.replace('%', '').replace(',', '.').trim());
    setDraft(null);
    if (Number.isFinite(value) && value > 0) onZoomTo(value / 100);
  };

  return (
    <div className="stage-zoom-control" role="group" aria-label="Zoom and guides">
      <input
        className="stage-zoom-input"
        aria-label="Zoom percentage"
        title="Type a zoom percentage, then Enter"
        value={draft ?? `${percent}%`}
        spellCheck={false}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
            event.currentTarget.blur();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            setDraft(null);
            event.currentTarget.blur();
          }
        }}
      />
      <button type="button" className="stage-zoom-button stage-zoom-text" aria-label="Fit the artboard" title="Fit the artboard in the view" onClick={onFit}>Fit</button>
      <button type="button" className="stage-zoom-button stage-zoom-text" aria-label="Actual size (1:1)" title="Actual size: one project pixel per screen pixel" onClick={() => onZoomTo(1)}>1:1</button>
      <select
        className="stage-zoom-presets"
        aria-label="Zoom presets"
        value=""
        onChange={(event) => {
          const value = Number(event.target.value);
          if (value > 0) onZoomTo(value / 100);
        }}
      >
        <option value="" disabled>Presets</option>
        {ZOOM_PRESETS.map((preset) => <option key={preset} value={preset}>{preset}%</option>)}
      </select>
      <button
        type="button"
        className={`stage-zoom-button${showSafeAreas ? ' active' : ''}`}
        aria-label="Toggle safe areas"
        aria-pressed={showSafeAreas}
        title={showSafeAreas ? 'Hide the action-safe and title-safe guides' : 'Show the action-safe (93 %) and title-safe (90 %) guides'}
        onClick={onToggleSafeAreas}
      >
        <Tv size={13} aria-hidden="true" />
      </button>
    </div>
  );
};
