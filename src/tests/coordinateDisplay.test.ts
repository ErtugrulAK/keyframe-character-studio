import { describe, expect, it } from 'vitest';
import {
  formatInspectorCoordinate,
  getPositionDisplayScale,
  toInspectorPositionDisplay,
} from '../utils/editor/coordinateDisplay';

describe('coordinate display contract', () => {
  it('keeps project-unit positions raw and inverts the stage Y sign', () => {
    expect(getPositionDisplayScale('project-unit-center-v1')).toBe(1);
    expect(toInspectorPositionDisplay(
      { x: 100, y: -50 },
      'project-unit-center-v1',
    )).toEqual({ x: 100, y: 50 });
  });

  it('keeps historical centi-unit positions aligned with the Inspector', () => {
    expect(getPositionDisplayScale('legacy-centi-unit-v1')).toBe(0.01);
    expect(toInspectorPositionDisplay(
      { x: 30_000, y: -10_000 },
      'legacy-centi-unit-v1',
    )).toEqual({ x: 300, y: 100 });
  });

  it('formats values like the shared numeric input without trailing zeros', () => {
    expect(formatInspectorCoordinate(300)).toBe('300');
    expect(formatInspectorCoordinate(300.5)).toBe('300.5');
    expect(formatInspectorCoordinate(0.004)).toBe('0');
    expect(formatInspectorCoordinate(-0)).toBe('0');
    expect(formatInspectorCoordinate(Number.NaN)).toBe('0');
  });
});
