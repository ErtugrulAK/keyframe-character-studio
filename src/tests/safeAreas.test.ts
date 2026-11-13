import { describe, expect, it } from 'vitest';
import { ACTION_SAFE, TITLE_SAFE, safeAreaRect } from '../utils/geometry/safeAreas';

describe('broadcast safe areas', () => {
  it('insets the 1080p frame by 3.5 % for action and 5 % for titles', () => {
    const action = safeAreaRect(-960, -540, 1920, 1080, ACTION_SAFE);
    expect(action.x).toBeCloseTo(-960 + 67.2, 6);
    expect(action.y).toBeCloseTo(-540 + 37.8, 6);
    expect(action.width).toBeCloseTo(1785.6, 6);
    expect(action.height).toBeCloseTo(1004.4, 6);
    const title = safeAreaRect(-960, -540, 1920, 1080, TITLE_SAFE);
    expect(title).toEqual({ x: -864, y: -486, width: 1728, height: 972 });
  });

  it('stays centred on the artboard', () => {
    const rect = safeAreaRect(100, 50, 1280, 720, TITLE_SAFE);
    expect(rect.x + rect.width / 2).toBeCloseTo(100 + 640, 6);
    expect(rect.y + rect.height / 2).toBeCloseTo(50 + 360, 6);
  });
});
