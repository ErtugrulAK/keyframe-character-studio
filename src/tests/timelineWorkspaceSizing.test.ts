import { describe, expect, it } from 'vitest';
import {
  clampPanelSize,
  MIN_STAGE_HEIGHT,
  OUTLINER_MAX_WIDTH,
  OUTLINER_MIN_WIDTH,
  resolveTimelineHeightCeiling,
  TIMELINE_MAX_HEIGHT,
  TIMELINE_MIN_HEIGHT,
} from '../components/Timeline/timelineConstants';

/**
 * R2-03 — the timeline workspace has ONE sizing authority: the resizer and the
 * column divider clamp through it, and the height ceiling keeps the canvas
 * usable instead of letting the panel swallow the stage.
 */
describe('clampPanelSize', () => {
  it('clamps into the band and rounds to whole pixels', () => {
    expect(clampPanelSize(100, 150, 700)).toBe(150);
    expect(clampPanelSize(900, 150, 700)).toBe(700);
    expect(clampPanelSize(320.4, TIMELINE_MIN_HEIGHT, TIMELINE_MAX_HEIGHT)).toBe(320);
    expect(clampPanelSize(320.6, OUTLINER_MIN_WIDTH, OUTLINER_MAX_WIDTH)).toBe(321);
  });
});

describe('resolveTimelineHeightCeiling', () => {
  it('never exceeds the authored bound', () => {
    expect(resolveTimelineHeightCeiling(2000, 100)).toBe(TIMELINE_MAX_HEIGHT);
  });

  it('leaves the stage its room on a short window', () => {
    // 720 window, 119px of chrome above the stage → 720 - 119 - 160 = 441.
    expect(resolveTimelineHeightCeiling(720, 119)).toBe(720 - 119 - MIN_STAGE_HEIGHT);
  });

  it('never drops below the usable minimum, however short the window is', () => {
    expect(resolveTimelineHeightCeiling(200, 119)).toBe(TIMELINE_MIN_HEIGHT);
  });
});
