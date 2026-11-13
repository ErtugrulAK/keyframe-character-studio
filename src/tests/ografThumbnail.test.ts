import { describe, expect, it } from 'vitest';
import { ografThumbnailSize } from '../export/ografThumbnail';

describe('OGraf thumbnail size', () => {
  it('keeps the scene aspect with the longest edge at 320 px', () => {
    expect(ografThumbnailSize(1920, 1080)).toEqual({ width: 320, height: 180 });
    expect(ografThumbnailSize(1080, 1920)).toEqual({ width: 180, height: 320 });
    expect(ografThumbnailSize(1000, 1000)).toEqual({ width: 320, height: 320 });
    expect(ografThumbnailSize(4000, 10)).toEqual({ width: 320, height: 1 });
  });
});
