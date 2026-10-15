import { describe, expect, it } from 'vitest';
import type { SceneData, SceneLayer } from '../types/composition';
import {
  GIF_EXPORT_FPS_OPTIONS,
  GIF_MAX_FRAMES,
  resolveGifDimensions,
  resolveGifExportFps,
  resolveGifFramePlan,
  resolveGifScale,
  resolvePaletteSampleIndexes,
  validateGifScene,
} from '../export/gifPlan';

const layer = (overrides: Partial<SceneLayer> = {}): SceneLayer => ({
  id: 'layer',
  name: 'Layer',
  type: 'custom_rect',
  x: 0,
  y: 0,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
  zIndex: 1,
  fillColor: '#ffffff',
  strokeColor: '#000000',
  ...overrides,
});

const scene = (layers: SceneLayer[], overrides: Partial<SceneData> = {}): SceneData => ({
  version: 1,
  width: 1920,
  height: 1080,
  fps: 30,
  totalFrames: 60,
  layers,
  tracks: layers.map((entry) => ({ id: `track-${entry.id}`, partId: entry.id, name: entry.name, color: '#fff', visible: true, locked: false, channels: {} })) as SceneData['tracks'],
  ...overrides,
});

describe('gif frame plan', () => {
  it('exports the authored frames at the authored rate, keeping the duration exact', () => {
    const plan = resolveGifFramePlan({ totalFrames: 60, projectFps: 30, exportFps: 30 });

    expect(plan.frameCount).toBe(60);
    expect(plan.exportFps).toBe(30);
    expect(plan.steps.map((step) => step.frame)).toEqual(Array.from({ length: 60 }, (_, index) => index));
    // 30 fps is not a whole number of centiseconds: the cumulative rounding makes
    // the delays alternate 3/4 so the total is exactly the authored two seconds.
    expect(plan.steps.slice(0, 6).map((step) => step.delayCentiseconds)).toEqual([3, 4, 3, 3, 4, 3]);
    expect(plan.steps.reduce((sum, step) => sum + step.delayCentiseconds, 0)).toBe(200);
    expect(plan.durationSeconds).toBe(2);
    expect(plan.authoredDurationSeconds).toBe(2);
  });

  it('keeps centisecond delays whole at every offered rate', () => {
    for (const rate of GIF_EXPORT_FPS_OPTIONS) {
      const plan = resolveGifFramePlan({ totalFrames: 120, projectFps: 60, exportFps: rate });
      expect(plan.steps.every((step) => step.delayCentiseconds >= 1), `rate ${rate}`).toBe(true);
      expect(plan.steps.every((step) => Number.isInteger(step.delayCentiseconds)), `rate ${rate}`).toBe(true);
      // The GIF's duration matches the authored two seconds to the format's centisecond.
      expect(Math.abs(plan.durationSeconds - 2), `rate ${rate}`).toBeLessThanOrEqual(0.01);
    }
  });

  it('resamples the same animation when the export rate differs', () => {
    const plan = resolveGifFramePlan({ totalFrames: 120, projectFps: 60, exportFps: 25 });

    expect(plan.frameCount).toBe(50);
    expect(plan.durationSeconds).toBe(2);
    expect(plan.steps.every((step) => step.delayCentiseconds === 4)).toBe(true);
    // 25 fps samples the 60 fps animation every 2.4 authored frames.
    expect(plan.steps.slice(0, 5).map((step) => step.frame)).toEqual([0, 2, 5, 7, 10]);
    expect(plan.steps[plan.steps.length - 1].frame).toBe(118);
  });

  it('never plans a frame outside the authored range', () => {
    const plan = resolveGifFramePlan({ totalFrames: 7, projectFps: 24, exportFps: 60 });
    expect(plan.steps.every((step) => step.frame >= 0 && step.frame <= 6)).toBe(true);
  });

  it('caps a very long sequence', () => {
    const plan = resolveGifFramePlan({ totalFrames: 120000, projectFps: 120, exportFps: 60 });
    expect(plan.frameCount).toBe(GIF_MAX_FRAMES);
  });

  it('samples at 120 FPS without browser-clamped short delays or wall-clock drift', () => {
    const plan = resolveGifFramePlan({ totalFrames: 120, projectFps: 120, exportFps: 120 });
    expect(plan.exportFps).toBe(120);
    expect(plan.durationSeconds).toBe(1);
    expect(plan.steps.reduce((sum, step) => sum + step.delayCentiseconds, 0)).toBe(100);
    expect(plan.steps.every((step) => step.delayCentiseconds >= 2)).toBe(true);
    expect(plan.steps[0].frame).toBe(0);
    expect(plan.steps.at(-1)!.frame).toBeGreaterThanOrEqual(117);
  });

  it('spends the two-centisecond GIF delay floor across a 120-sampling plan of 0.5 s, 1 s and 2 s', () => {
    // 120 is a sampling grid over the authored frames, not a display rate: a GIF
    // may not show a frame for less than two centiseconds (Chromium clamps delays
    // of 10 ms and below to 100 ms), so the encoded plan carries floor(totalCS / 2)
    // frames and holds the authored duration exactly.
    const rows = [
      { projectFps: 120, authoredFrames: 60, requestedFrames: 60, encodedFrames: 25, centiseconds: 50, lastFrame: 58 },
      { projectFps: 120, authoredFrames: 120, requestedFrames: 120, encodedFrames: 50, centiseconds: 100, lastFrame: 118 },
      { projectFps: 120, authoredFrames: 240, requestedFrames: 240, encodedFrames: 100, centiseconds: 200, lastFrame: 238 },
      { projectFps: 30, authoredFrames: 15, requestedFrames: 60, encodedFrames: 25, centiseconds: 50, lastFrame: 14 },
      { projectFps: 30, authoredFrames: 30, requestedFrames: 120, encodedFrames: 50, centiseconds: 100, lastFrame: 29 },
      { projectFps: 30, authoredFrames: 60, requestedFrames: 240, encodedFrames: 100, centiseconds: 200, lastFrame: 59 },
    ];
    for (const row of rows) {
      const plan = resolveGifFramePlan({ totalFrames: row.authoredFrames, projectFps: row.projectFps, exportFps: 120 });
      const label = `${row.authoredFrames} authored frames at ${row.projectFps} fps`;

      // The grid requests the full rate; the file cannot spend it.
      expect(Math.round(plan.authoredDurationSeconds * 120), label).toBe(row.requestedFrames);
      expect(plan.frameCount, label).toBe(row.encodedFrames);
      expect(plan.frameCount, label).toBeLessThan(row.requestedFrames);
      expect(plan.durationSeconds, label).toBe(plan.authoredDurationSeconds);
      expect(plan.steps, label).toHaveLength(row.encodedFrames);
      expect(plan.steps.every((step) => step.delayCentiseconds === 2), label).toBe(true);
      expect(plan.steps.reduce((sum, step) => sum + step.delayCentiseconds, 0), label).toBe(row.centiseconds);
      expect(plan.steps[0].frame, label).toBe(0);
      expect(plan.steps[plan.steps.length - 1].frame, label).toBe(row.lastFrame);
    }
  });

  it('preserves the complete animation duration when the encoded frame budget is reached', () => {
    const plan = resolveGifFramePlan({ totalFrames: 120000, projectFps: 120, exportFps: 120 });
    expect(plan.durationSeconds).toBe(1000);
    expect(plan.frameCount).toBeLessThanOrEqual(GIF_MAX_FRAMES);
    expect(plan.steps.at(-1)!.frame).toBeGreaterThan(119800);
  });

  it('picks an export rate and a scale the format can hold', () => {
    expect(resolveGifExportFps(30)).toBe(30);
    expect(resolveGifExportFps(24)).toBe(24);

    // The default keeps a 1080p stage under the default edge, and a small stage as it is.
    expect(resolveGifScale(1920, 1080)).toBe(0.5);
    expect(resolveGifScale(640, 360)).toBe(1);
    expect(resolveGifScale(3840, 2160)).toBe(0.25);
  });

  it('keeps the stage aspect when it scales', () => {
    expect(resolveGifDimensions(1920, 1080, 0.5)).toEqual({ width: 960, height: 540 });
    expect(resolveGifDimensions(1920, 1080, 0.125)).toEqual({ width: 240, height: 135 });
    // Odd sizes round, and a tiny scale still yields a usable box.
    expect(resolveGifDimensions(1921, 1081, 0.5)).toEqual({ width: 961, height: 541 });
    expect(resolveGifDimensions(1920, 1080, 0.0001)).toEqual({ width: 1, height: 1 });
  });

  it('samples the palette across the whole animation, ends included', () => {
    expect(resolvePaletteSampleIndexes(60, 8)).toEqual([0, 8, 17, 25, 34, 42, 51, 59]);
    expect(resolvePaletteSampleIndexes(3, 8)).toEqual([0, 1, 2]);
    expect(resolvePaletteSampleIndexes(1, 8)).toEqual([0]);
    expect(resolvePaletteSampleIndexes(0, 8)).toEqual([0]);
  });
});

describe('gif scene gate', () => {
  it('accepts a scene of shapes, text and inline images', () => {
    const diagnostics = validateGifScene(scene([
      layer({ id: 'rect' }),
      layer({ id: 'text', type: 'custom_text', textValue: 'Hello', fontFamily: 'Outfit' }),
      layer({ id: 'image', type: 'custom_image', imageUrl: 'data:image/png;base64,AAAA' }),
    ]));
    expect(diagnostics).toEqual([]);
  });

  it('refuses an image the isolated raster context could not load', () => {
    const diagnostics = validateGifScene(scene([
      layer({ id: 'image', name: 'Logo', type: 'custom_image', imageUrl: 'https://example.com/logo.png' }),
    ]));
    expect(diagnostics.map((entry) => entry.code)).toEqual(['OGRAF_EXTERNAL_ASSET_REJECTED']);
    expect(diagnostics[0].layerName).toBe('Logo');
  });

  it('refuses a layer the frame renderer cannot draw', () => {
    const diagnostics = validateGifScene(scene([layer({ id: 'video', type: 'custom_video', videoUrl: 'data:video/mp4;base64,AAAA' })]));
    expect(diagnostics.map((entry) => entry.code)).toEqual(['OGRAF_UNSUPPORTED_VIDEO']);
    expect(diagnostics[0].severity).toBe('ERROR');
  });

  it('does not block an export for runtime-only or package-portability reasons', () => {
    // An in/out preset renders exactly what the editor shows (the GIF has no
    // runtime), and a text font is embedded by the raster step or reported as a
    // fallback — neither is a reason to refuse the export.
    const diagnostics = validateGifScene(scene([
      layer({ id: 'text', type: 'custom_text', textValue: 'Hi', fontFamily: 'Outfit', inAnimPreset: 'pop_in' }),
    ]));
    expect(diagnostics).toEqual([]);
  });

  it('refuses an unsupported project box', () => {
    const diagnostics = validateGifScene(scene([layer()], { width: 0 }));
    expect(diagnostics.map((entry) => entry.code)).toEqual(['OGRAF_INVALID_PROJECT']);
  });
});
