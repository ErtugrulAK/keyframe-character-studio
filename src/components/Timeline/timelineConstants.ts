import type { TrackChannel } from '../../types/animator';

// Visual metadata for each Transform channel
export const CHANNEL_META: Record<TrackChannel, { label: string; color: string; shortLabel: string }> = {
  x:            { label: 'Location X',  shortLabel: 'X',   color: '#ef4444' },
  y:            { label: 'Location Y',  shortLabel: 'Y',   color: '#22c55e' },
  rotation:     { label: 'Rotation',    shortLabel: 'R°',  color: '#3b82f6' },
  scaleX:       { label: 'Scale X',     shortLabel: 'SX',  color: '#a855f7' },
  scaleY:       { label: 'Scale Y',     shortLabel: 'SY',  color: '#ec4899' },
  opacity:      { label: 'Opacity',     shortLabel: 'Op',  color: '#f59e0b' },
  maskOffsetX:  { label: 'Mask X',      shortLabel: 'MX',  color: '#14b8a6' },
  maskOffsetY:  { label: 'Mask Y',      shortLabel: 'MY',  color: '#06b6d4' },
  maskScale:    { label: 'Mask Scale',   shortLabel: 'MS',  color: '#8b5cf6' },
  maskRotation: { label: 'Mask Rot',     shortLabel: 'MR°', color: '#f97316' },
  trimPathStart: { label: 'Trim Start', shortLabel: 'TS', color: '#22d3ee' },
  trimPathEnd: { label: 'Trim End', shortLabel: 'TE', color: '#2dd4bf' },
  trimPathOffset: { label: 'Trim Offset', shortLabel: 'TO°', color: '#a78bfa' },
};

export const TRACK_ROW_HEIGHT = 34;   // parent track row
export const CHANNEL_ROW_HEIGHT = 28; // sub-channel row
