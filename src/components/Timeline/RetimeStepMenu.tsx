import React, { useRef, useState } from 'react';
import { NumberField } from '../Inspector/inputs/NumberField';
import { sectionAt } from '../../utils/animation/sectionRetime';
import { frameToSeconds, secondsToFrame } from '../../utils/animation/timebase';
import { usePointerMenuPlacement } from '../../hooks/usePointerMenuPlacement';
import { useDismissFloatingMenu } from '../../hooks/useDismissFloatingMenu';

export interface RetimeStepRequest {
  /** The frame under the pointer when the ruler was right-clicked. */
  frame: number;
  x: number;
  y: number;
}

interface RetimeStepMenuProps {
  request: RetimeStepRequest;
  stepMarkers: readonly number[];
  durationFrames: number;
  fps: number;
  /** Retimes the step at `frame` to `length` frames; false when it was refused. */
  retimeStep: (frame: number, length: number) => boolean;
  onClose: () => void;
}

/**
 * Retime a step: the small menu a right-click on the ruler opens for the step
 * under the pointer (between its markers, or the whole sequence). A new length
 * stretches its keys (`utils/animation/sectionRetime`). Mount it with a key per
 * request, so the length field starts from the step that was clicked.
 */
export const RetimeStepMenu: React.FC<RetimeStepMenuProps> = ({ request, stepMarkers, durationFrames, fps, retimeStep, onClose }) => {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const placement = usePointerMenuPlacement(menuRef, request);
  useDismissFloatingMenu(menuRef, true, onClose);
  const section = sectionAt(stepMarkers, durationFrames, Math.round(request.frame));
  const [seconds, setSeconds] = useState(() => Number(frameToSeconds(section.end - section.start, fps).toFixed(2)));
  const name = stepMarkers.length > 0 ? `Step ${section.index + 1}` : 'The whole sequence';
  const apply = () => {
    if (seconds > 0 && retimeStep(request.frame, Math.round(secondsToFrame(seconds, fps)))) onClose();
  };
  return (
    <div
      ref={menuRef}
      role="dialog"
      aria-label="Retime step"
      className="editor-context-menu timeline-context-menu timeline-retime-menu"
      style={{ position: 'fixed', left: placement?.left ?? request.x, top: placement?.top ?? request.y, zIndex: 1000, minWidth: 200 }}
      onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } }}
    >
      <div className="timeline-retime-title">{name} (frames {section.start}–{section.end})</div>
      <label className="timeline-retime-row">
        <span>Length</span>
        <NumberField
          className="duration-input"
          aria-label={`New length of ${name.toLowerCase()}, in seconds`}
          autoFocus
          step={0.5}
          min={0.01}
          max={40}
          value={seconds}
          onFocus={(event) => event.target.select()}
          onValue={setSeconds}
          onKeyDown={(event) => { if (event.key === 'Enter') apply(); }}
        />
        <span aria-hidden="true">s</span>
      </label>
      <p className="timeline-retime-hint">Its keyframes stretch or squeeze; everything after it moves.</p>
      <button type="button" className="timeline-menu-item editor-context-menu-item" onClick={apply}>Retime</button>
    </div>
  );
};
