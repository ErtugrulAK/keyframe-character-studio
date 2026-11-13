/**
 * Export as GIF — the render step.
 *
 * One pass: for each planned frame, the editor's own evaluator
 * (`evaluateSceneFrame`) and the editor's own SVG renderer (`renderOGrafSvg`)
 * produce the frame, which is rasterised on a transparent background, mapped onto
 * ONE shared palette and appended to a streaming GIF89a writer. Frames are never
 * all held in memory, and the palette is built from a sample of frames taken
 * across the animation so a colour that appears late is still in the table.
 *
 * The caller owns the scene SNAPSHOT it passes in (the hook takes one when the
 * export starts), the diagnostics gate and the progress UI; this function owns
 * the pixels and reports progress and cancellation back through its callbacks.
 */
import type { SceneData } from '../types/composition';
import { renderOGrafSvg } from '../ograf/svgRenderer';
import { evaluateSceneFrame } from '../ograf/evaluation';
import { collectSceneFontFamilies, embedSceneFonts } from './fontEmbedding';
import { rasterizeSvgFrame, yieldToBrowser } from './svgRaster';
import {
  buildGifPalette,
  collectPaletteSamples,
  GifWriter,
  quantizeFrame,
  type RgbaFrame,
} from './gifEncoder';
import {
  resolveGifDimensions,
  resolveGifFramePlan,
  resolvePaletteSampleIndexes,
  type GifFramePlan,
} from './gifPlan';
import { KCS_DEFAULT_TEXT_FONT } from '../utils/layers/textFonts';

/** How many frames the palette is sampled from. */
const GIF_PALETTE_SAMPLE_FRAMES = 8;

interface GifExportProgress {
  /** Frames whose pixels are done, against the plan's total. */
  completed: number;
  total: number;
}

interface GifExportRequest {
  scene: SceneData;
  exportFps: number;
  scale: number;
  onProgress?: (progress: GifExportProgress) => void;
  /** Checked between frames so a cancelled export stops at a frame boundary. */
  shouldCancel?: () => boolean;
}

export interface GifExportResult {
  bytes: Uint8Array;
  width: number;
  height: number;
  frameCount: number;
  /** The GIF's own duration: the sum of the frame delays. */
  durationSeconds: number;
  authoredDurationSeconds: number;
  exportFps: number;
  /** The font families that were embedded into the rasterised frames. */
  embeddedFontFamilies: string[];
  /** The font families the scene draws with, whether or not they were embedded. */
  sceneFontFamilies: string[];
}

/** `null` means the export was cancelled; every other outcome is a result. */
export const renderGif = async ({
  scene,
  exportFps,
  scale,
  onProgress,
  shouldCancel,
}: GifExportRequest): Promise<GifExportResult | null> => {
  const plan: GifFramePlan = resolveGifFramePlan({
    totalFrames: scene.totalFrames,
    projectFps: scene.fps,
    exportFps,
  });
  const { width, height } = resolveGifDimensions(scene.width, scene.height, scale);
  const sceneFontFamilies = collectSceneFontFamilies(scene.layers, KCS_DEFAULT_TEXT_FONT);
  const fonts = await embedSceneFonts(sceneFontFamilies);
  if (shouldCancel?.()) return null;

  const rendered = new Map<number, RgbaFrame>();
  const renderFrame = async (frame: number): Promise<RgbaFrame> => {
    const cached = rendered.get(frame);
    if (cached) return cached;
    const evaluated = evaluateSceneFrame(scene, frame);
    const pixelFrame = await rasterizeSvgFrame(renderOGrafSvg(evaluated), width, height, fonts.css);
    if (rendered.size < GIF_PALETTE_SAMPLE_FRAMES) rendered.set(frame, pixelFrame);
    return pixelFrame;
  };

  const samples: RgbaFrame[] = [];
  for (const index of resolvePaletteSampleIndexes(plan.frameCount, GIF_PALETTE_SAMPLE_FRAMES)) {
    samples.push(await renderFrame(plan.steps[index].frame));
    if (shouldCancel?.()) return null;
    await yieldToBrowser();
  }
  const palette = buildGifPalette(collectPaletteSamples(samples));

  const writer = new GifWriter({ width, height, palette });
  onProgress?.({ completed: 0, total: plan.frameCount });
  let completed = 0;
  for (const step of plan.steps) {
    const pixelFrame = await renderFrame(step.frame);
    writer.writeFrame(quantizeFrame(palette, pixelFrame), step.delayCentiseconds);
    completed += 1;
    onProgress?.({ completed, total: plan.frameCount });
    if (shouldCancel?.()) return null;
    await yieldToBrowser();
  }

  return {
    bytes: writer.finish(),
    width,
    height,
    frameCount: plan.frameCount,
    durationSeconds: plan.durationSeconds,
    authoredDurationSeconds: plan.authoredDurationSeconds,
    exportFps: plan.exportFps,
    embeddedFontFamilies: fonts.families,
    sceneFontFamilies,
  };
};
