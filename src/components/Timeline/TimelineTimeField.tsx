import React, { useState } from 'react';
import { formatTimeDisplay, parseTimeInput, type TimeDisplayMode } from '../../utils/editor/timeInput';

interface TimelineTimeFieldProps {
  currentFrame: number;
  totalFrames: number;
  fps: number;
  onSeek: (frame: number) => void;
}

/**
 * The playhead time in the timeline header. It shows timecode or frames (the
 * TC / F button switches), and a typed time — 25, 25f, 1.5s, 500ms or
 * 00:00:01:00 — moves the playhead on Enter or when the field is left.
 * Escape, or text that is not a time, puts the current time back.
 */
export const TimelineTimeField: React.FC<TimelineTimeFieldProps> = ({ currentFrame, totalFrames, fps, onSeek }) => {
  const [mode, setMode] = useState<TimeDisplayMode>('timecode');
  const [draft, setDraft] = useState<string | null>(null);
  const shown = formatTimeDisplay(currentFrame, fps, mode);

  const commit = () => {
    if (draft === null) return;
    const frame = parseTimeInput(draft, fps);
    setDraft(null);
    if (frame !== null) onSeek(Math.max(0, Math.min(totalFrames, frame)));
  };

  return (
    <>
      <input
        className="timecode-text timecode-input"
        aria-label="Current time"
        title="Type a time: 25 or 25f (frames), 1.5s, 500ms or 00:00:01:00, then Enter"
        value={draft ?? shown}
        spellCheck={false}
        autoComplete="off"
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
      <span className="timecode-total">/ {formatTimeDisplay(totalFrames, fps, mode)}</span>
      <button
        type="button"
        className="timecode-mode-toggle"
        aria-label={mode === 'timecode' ? 'Show the time in frames' : 'Show the time as timecode'}
        title={mode === 'timecode' ? 'Show frames' : 'Show timecode'}
        onClick={() => setMode((current) => (current === 'timecode' ? 'frames' : 'timecode'))}
      >
        {mode === 'timecode' ? 'TC' : 'F'}
      </button>
    </>
  );
};
