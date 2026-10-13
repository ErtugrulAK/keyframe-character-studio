import React from 'react';

interface TimeRulerProps {
  frameNumbers: number[];
  frameWidth: number;
  totalFrames: number;
  onPointerDown: (e: React.PointerEvent) => void;
}

/**
 * Horizontal time ruler with adaptive label/mark density based on zoom.
 */
export const TimeRuler: React.FC<TimeRulerProps> = ({ frameNumbers, frameWidth, totalFrames, onPointerDown }) => {
  return (
    <div className="time-ruler" onPointerDown={onPointerDown} style={{ width: `${(totalFrames + 30) * frameWidth}px`, minWidth: '100%' }}>
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
