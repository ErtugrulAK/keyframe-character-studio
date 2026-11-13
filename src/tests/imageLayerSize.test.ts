import { describe, expect, it } from 'vitest';
import { fitImageSize, replacedImageSize } from '../utils/geometry/imageLayerSize';

describe('image layer sizes', () => {
  it('fits a new picture inside 150 units, as before', () => {
    expect(fitImageSize(1920, 1080)).toEqual({ width: 150, height: 84 });
    expect(fitImageSize(500, 1000)).toEqual({ width: 75, height: 150 });
    expect(fitImageSize(0, 0)).toEqual({ width: 140, height: 140 });
  });

  it('keeps the width of a replaced picture and follows its proportions', () => {
    expect(replacedImageSize(300, 169, 1000, 1000)).toEqual({ width: 300, height: 300 });
    expect(replacedImageSize(300, 300, 1920, 1080)).toEqual({ width: 300, height: 169 });
  });

  it('keeps the box when the picture size is unknown', () => {
    expect(replacedImageSize(300, 200, 0, 0)).toEqual({ width: 300, height: 200 });
    expect(replacedImageSize(undefined, undefined, 100, 50)).toEqual({ width: 140, height: 70 });
  });
});
