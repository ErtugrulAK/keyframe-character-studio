import React from 'react';

interface TimeRulerProps {
  frameNumbers: number[];
  frameWidth: number;
  totalFrames: number;
  currentFrame: number;
  onPointerDown: (e: React.PointerEvent) => void;
  onSeekFrame: (frame: number) => void;
}

/**
 * Horizontal time ruler with adaptive label/mark density based on zoom.
 *
 * Keyboard: the ruler is the playhead's slider — arrows step one frame,
 * Shift+arrows step ten, Home/End jump to the ends. It mirrors the pointer
 * scrub semantics; the two are the same seek authority in the parent.
 */
export const TimeRuler: React.FC<TimeRulerProps> = ({ frameNumbers, frameWidth, totalFrames, currentFrame, onPointerDown, onSeekFrame }) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 1;
    if (e.key === 'ArrowLeft') onSeekFrame(currentFrame - step);
    else if (e.key === 'ArrowRight') onSeekFrame(currentFrame + step);
    else if (e.key === 'Home') onSeekFrame(0);
    else if (e.key === 'End') onSeekFrame(totalFrames);
    else return;
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div
      className="time-ruler"
      role="slider"
      tabIndex={0}
      aria-label="Playhead position"
      aria-orientation="horizontal"
      aria-valuemin={0}
      aria-valuemax={totalFrames}
      aria-valuenow={currentFrame}
      aria-valuetext={`Frame ${currentFrame} of ${totalFrames}`}
      onPointerDown={onPointerDown}
      onKeyDown={handleKeyDown}
      style={{ width: `${(totalFrames + 30) * frameWidth}px`, minWidth: '100%' }}
    >
      {frameNumbers.map((frame) => {
        const labelStep =
          frameWidth >= 20 ? 5 :
          frameWidth >= 10 ? 10 :
          frameWidth >= 5  ? 20 : 50;

        const isLabel = frame % labelStep === 0;
        const isTen = frame % 10 === 0;
        const isFive = frame % 5 === 0;
        return (
          <div key={frame} data-frame={frame} className={`ruler-mark ${isTen ? 'ten' : isFive ? 'major' : 'minor'}`} style={{ left: `${frame * frameWidth}px` }}>
            {isLabel && <span className="ruler-label">{frame}</span>}
          </div>
        );
      })}
    </div>
  );
};
