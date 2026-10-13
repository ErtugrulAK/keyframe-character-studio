/**
 * GIF export planning — the pure half of `Export as GIF`.
 *
 * Everything that decides WHAT is exported (frame plan, timing, size, whether
 * the scene can be drawn at all) lives here and is a plain function of the
 * scene, so the browser only has to rasterise and encode what this module
 * decided.
 *
 * FPS/TIMEBASE CONTRACT (see `utils/timebase`): a GIF frame's delay is stored in
 * whole CENTISECONDS, which is the format's own granularity (1/100 s). The plan
 * therefore maps every exported frame with a CUMULATIVE rounding
 * (`delay(k) = round((k+1)·100/fps) − round(k·100/fps)`, never below 1cs) so the
 * delays add up to exactly `round(frameCount·100/fps)` centiseconds: the GIF's
 * wall-clock duration is the authored duration rounded to the format's grid, and
 * it never drifts frame after frame the way a per-frame `100/fps` truncation
 * would. The authored frame for each exported frame is resolved through the
 * timebase (`secondsToFrame(k/exportFps, projectFps)`), so changing the export
 * rate resamples the SAME animation and never changes how long it lasts.
 */
import type { SceneData } from '../types/composition';
import type { OGrafExportDiagnostic } from '../ograf/types';
import { validateSceneForOGraf } from '../ograf/validation';
import { frameToSeconds, sanitizeProjectFps, secondsToFrame } from '../utils/timebase';

/** The rates the GIF panel offers. GIF delay granularity is 1/100 s, so all are ≤ 100. */
export const GIF_EXPORT_FPS_OPTIONS = [10, 12, 15, 20, 24, 25, 30, 50, 60];

/** The raster scales the GIF panel offers. A GIF is a delivery format, not a master. */
export const GIF_SCALE_OPTIONS = [1, 0.5, 0.25, 0.125];

/** The widest/tallest GIF the default scale aims for. */
export const GIF_DEFAULT_MAX_EDGE = 960;

/** Hard ceiling on how many frames one export may encode. */
export const GIF_MAX_FRAMES = 900;

/**
 * Diagnostics that do NOT block a GIF:
 *
 *  - `OGRAF_UNSUPPORTED_PROCEDURAL` / `…_NONDETERMINISTIC_PROCEDURAL` refuse an
 *    export whose generated RUNTIME would resolve a different frame than the
 *    editor. The GIF has no runtime: it rasterises the editor's own evaluated
 *    frames, so an in/out preset renders exactly what the user sees.
 *  - the asset/font codes describe the OGraf PACKAGE's portability policy
 *    (packaged files, no network). A GIF carries its images inline in the SVG it
 *    rasterises and embeds the web font when it can, so the package policy is
 *    not the GIF's. The GIF's own media rule is added below.
 */
const NON_BLOCKING_FOR_GIF = [
  'OGRAF_UNSUPPORTED_PROCEDURAL',
  'OGRAF_UNSUPPORTED_NONDETERMINISTIC_PROCEDURAL',
  'OGRAF_EXTERNAL_ASSET_REJECTED',
  'OGRAF_ASSET_UNVERIFIED',
  'OGRAF_MISSING_ASSET',
  'OGRAF_FONT_UNVERIFIED',
];

/** True for an asset URL the isolated raster context can load (inline bytes only). */
export const isInlineMediaUrl = (url: string): boolean => /^data:/iu.test(url);

/**
 * Whether the current scene can be GIF'd, in the editor's own diagnostic
 * vocabulary: the renderability rules the generated SVG renderer already
 * enforces (through `validateSceneForOGraf`, minus the runtime-only and
 * package-portability codes) plus the one rule that is specific to rasterising
 * in an isolated context — an image the frame cannot load.
 */
export const validateGifScene = (scene: SceneData): OGrafExportDiagnostic[] => {
  const diagnostics: OGrafExportDiagnostic[] = validateSceneForOGraf(scene).diagnostics.filter(
    (entry) => entry.severity === 'ERROR' && !NON_BLOCKING_FOR_GIF.includes(entry.code),
  );
  for (const layer of scene.layers) {
    if (layer.type !== 'custom_image' || !layer.imageUrl) continue;
    if (isInlineMediaUrl(layer.imageUrl)) continue;
    diagnostics.push({
      code: 'OGRAF_EXTERNAL_ASSET_REJECTED',
      severity: 'ERROR',
      layerId: layer.id,
      layerName: layer.name,
      feature: 'image',
      message: `Image layer "${layer.name}" points at an external URL. A GIF frame is rasterised in an isolated context that loads no external resources, so the image would silently disappear.`,
    });
  }
  return diagnostics;
};

/** The export rate a new panel starts on: the project's own rate when it is representable. */
export const resolveGifExportFps = (projectFps: number): number => {
  const usable = GIF_EXPORT_FPS_OPTIONS.filter((option) => option <= projectFps);
  return usable.length > 0 ? usable[usable.length - 1] : GIF_EXPORT_FPS_OPTIONS[0];
};

/** The raster scale a new panel starts on: the largest option that stays within the default edge. */
export const resolveGifScale = (width: number, height: number): number => {
  const longestEdge = Math.max(width, height);
  return GIF_SCALE_OPTIONS.find((scale) => longestEdge * scale <= GIF_DEFAULT_MAX_EDGE)
    ?? GIF_SCALE_OPTIONS[GIF_SCALE_OPTIONS.length - 1];
};

export interface GifDimensions {
  width: number;
  height: number;
}

/** The pixel box of the GIF: the stage's aspect, scaled and rounded, never below 1×1. */
export const resolveGifDimensions = (width: number, height: number, scale: number): GifDimensions => ({
  width: Math.max(1, Math.round(width * scale)),
  height: Math.max(1, Math.round(height * scale)),
});

/**
 * The frames the palette is sampled from: evenly spread across the animation,
 * and always including the first and the last, so a colour that only appears at
 * one end of the sequence still reaches the table.
 */
export const resolvePaletteSampleIndexes = (frameCount: number, sampleCount: number): number[] => {
  const total = Math.max(1, Math.floor(frameCount));
  const wanted = Math.max(1, Math.min(Math.floor(sampleCount), total));
  if (wanted === 1) return [0];
  const indexes = new Set<number>();
  for (let index = 0; index < wanted; index += 1) {
    indexes.add(Math.round((index * (total - 1)) / (wanted - 1)));
  }
  return Array.from(indexes).sort((left, right) => left - right);
};

export interface GifFrameStep {
  /** The authored frame this GIF frame shows. */
  frame: number;
  /** How long it is shown, in the format's whole centiseconds (never 0). */
  delayCentiseconds: number;
}

export interface GifFramePlan {
  exportFps: number;
  frameCount: number;
  /** The GIF's own duration: the sum of its delays, in seconds. */
  durationSeconds: number;
  /** The authored animation's duration, in seconds. */
  authoredDurationSeconds: number;
  steps: GifFrameStep[];
}

export interface GifFramePlanInput {
  totalFrames: number;
  projectFps: number;
  exportFps: number;
}

/**
 * The exported frames: which authored frame each GIF frame shows, and how long
 * it is shown. Deterministic — the same scene and options always produce the
 * same plan, so a GIF is reproducible.
 */
export const resolveGifFramePlan = ({ totalFrames, projectFps, exportFps }: GifFramePlanInput): GifFramePlan => {
  const sourceFps = sanitizeProjectFps(projectFps);
  const authoredFrames = Math.max(1, Math.floor(totalFrames));
  const rate = Math.max(1, Math.min(100, Math.floor(exportFps)));
  const authoredDurationSeconds = frameToSeconds(authoredFrames, sourceFps);
  const frameCount = Math.min(GIF_MAX_FRAMES, Math.max(1, Math.round(authoredDurationSeconds * rate)));
  const steps: GifFrameStep[] = [];
  for (let index = 0; index < frameCount; index += 1) {
    const seconds = index / rate;
    const frame = Math.min(authoredFrames - 1, Math.max(0, Math.round(secondsToFrame(seconds, sourceFps))));
    const delayCentiseconds = Math.max(1, Math.round(((index + 1) * 100) / rate) - Math.round((index * 100) / rate));
    steps.push({ frame, delayCentiseconds });
  }
  const totalCentiseconds = steps.reduce((sum, step) => sum + step.delayCentiseconds, 0);
  return {
    exportFps: rate,
    frameCount,
    durationSeconds: totalCentiseconds / 100,
    authoredDurationSeconds,
    steps,
  };
};
