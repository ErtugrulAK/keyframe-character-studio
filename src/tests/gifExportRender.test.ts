import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SceneData } from '../types/composition';

/**
 * `renderGif` orchestration: the pixels come from the browser rasteriser,
 * which jsdom cannot run, so it is replaced by a solid frame per call. What is
 * checked is the part this module owns — the frame plan it walks, the shared
 * palette sample cache, progress, cancellation at frame boundaries and the
 * result it reports.
 */
const raster = vi.hoisted(() => ({ calls: [] as string[] }));

vi.mock('../export/svgRaster', () => ({
  rasterizeSvgFrame: vi.fn(async (svg: string, width: number, height: number) => {
    raster.calls.push(svg);
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 200;
      data[i + 3] = 255;
    }
    return { data, width, height };
  }),
  yieldToBrowser: vi.fn(async () => undefined),
}));

vi.mock('../export/fontEmbedding', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../export/fontEmbedding')>()),
  embedSceneFonts: vi.fn(async () => ({ css: '', families: [] })),
}));

const { renderGif } = await import('../export/gifExport');

const scene = (totalFrames: number, fps = 10): SceneData =>
  ({ version: 2, width: 40, height: 20, fps, totalFrames, layers: [], tracks: [] }) as unknown as SceneData;

beforeEach(() => {
  raster.calls.length = 0;
});

describe('renderGif', () => {
  it('writes a GIF89a of the planned frames at the requested scale', async () => {
    const result = await renderGif({ scene: scene(10), exportFps: 10, scale: 0.5 });
    expect(result).not.toBeNull();
    expect(new TextDecoder().decode(result!.bytes.slice(0, 6))).toBe('GIF89a');
    expect(result!.bytes[result!.bytes.length - 1]).toBe(0x3b);
    expect(result).toMatchObject({ width: 20, height: 10, frameCount: 10, exportFps: 10 });
    expect(result!.durationSeconds).toBeCloseTo(1, 5);
  });

  it('reuses the palette sample frames instead of rasterising them twice', async () => {
    await renderGif({ scene: scene(4), exportFps: 10, scale: 1 });
    // Four frames, all within the eight palette samples: each is drawn once.
    expect(raster.calls).toHaveLength(4);
  });

  it('reports progress from zero to the total, once per frame', async () => {
    const progress: number[] = [];
    await renderGif({ scene: scene(5), exportFps: 10, scale: 1, onProgress: ({ completed, total }) => {
      expect(total).toBe(5);
      progress.push(completed);
    } });
    expect(progress).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('returns null when cancelled before any frame', async () => {
    const result = await renderGif({ scene: scene(5), exportFps: 10, scale: 1, shouldCancel: () => true });
    expect(result).toBeNull();
    expect(raster.calls).toHaveLength(0);
  });

  it('stops at a frame boundary when cancelled mid-export', async () => {
    let completedFrames = 0;
    const result = await renderGif({
      scene: scene(20),
      exportFps: 10,
      scale: 1,
      onProgress: ({ completed }) => { completedFrames = completed; },
      shouldCancel: () => completedFrames >= 3,
    });
    expect(result).toBeNull();
    expect(completedFrames).toBe(3);
  });
});
