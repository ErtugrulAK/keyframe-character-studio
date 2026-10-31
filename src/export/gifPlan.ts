/**
 * GIF export planning — the pure half of `Export as GIF`.
 *
 * Everything that decides WHAT is exported (frame plan, timing, size, whether
 * the scene can be drawn at all) lives here and is a plain function of the
 * scene, so the browser only has to rasterise and encode what this module
 * decided.
 *
 * FPS/TIMEBASE CONTRACT (see `utils/timebase`): the requested rate is the
 * sampling grid, not a promise that GIF can display that many distinct frames.
 * GIF stores whole centiseconds; browsers expand delays <= 1cs to 100ms.
 * Displayed frames therefore receive at least 2cs, cumulatively rounded over
 * the WHOLE authored duration (also when the frame budget is reached). Frames
 * are sampled on the requested grid and coalesced to the display budget.
 * The duration is rounded to 1cs, with a minimum single-frame hold of 2cs.
 * See Chromium DeferredImageDecoder::FrameDurationAtIndex for the playback floor.
 */
import type { SceneData } from '../types/composition';
import type { OGrafExportDiagnostic } from '../ograf/types';
import { validateSceneForOGraf } from '../ograf/validation';
import { frameToSeconds, sanitizeProjectFps, secondsToFrame } from '../utils/timebase';

/** Requested sampling rates; the encoded playback plan respects GIF timing. */
export const GIF_EXPORT_FPS_OPTIONS = [10, 12, 15, 20, 24, 25, 30, 50, 60, 120];

/** The most frames a GIF shows per second: its 2-centisecond delay floor. */
export const GIF_MAX_DISPLAY_FPS = 50;

/** The raster scales the GIF panel offers. A GIF is a delivery format, not a master. */
export const GIF_SCALE_OPTIONS = [1, 0.5, 0.25, 0.125];

/** The widest/tallest GIF the default scale aims for. */
const GIF_DEFAULT_MAX_EDGE = 960;

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
  // The GIF frames come from the SVG renderer, which draws colour
  // correction and effect-only masks exactly like the editor.
  'OGRAF_UNSUPPORTED_COLOR_CORRECTION',
  'OGRAF_UNSUPPORTED_EFFECT_MASK',
  'OGRAF_UNSUPPORTED_PROCEDURAL',
  'OGRAF_UNSUPPORTED_NONDETERMINISTIC_PROCEDURAL',
  'OGRAF_EXTERNAL_ASSET_REJECTED',
  'OGRAF_ASSET_UNVERIFIED',
  'OGRAF_MISSING_ASSET',
  'OGRAF_FONT_UNVERIFIED',
];

/** True for an asset URL the isolated raster context can load (inline bytes only). */
const isInlineMediaUrl = (url: string): boolean => /^data:/iu.test(url);

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

interface GifDimensions {
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
  /** Whole centiseconds, at least 2 to avoid browser short-delay clamping. */
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

interface GifFramePlanInput {
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
  const rate = Math.max(1, Math.min(120, Math.floor(exportFps)));
  const authoredDurationSeconds = frameToSeconds(authoredFrames, sourceFps);
  const totalCentiseconds = Math.max(2, Math.round(authoredDurationSeconds * 100));
  const frameCount = Math.min(
    GIF_MAX_FRAMES,
    Math.max(1, Math.round(authoredDurationSeconds * rate)),
    Math.floor(totalCentiseconds / 2),
  );
  const steps: GifFrameStep[] = [];
  for (let index = 0; index < frameCount; index += 1) {
    const seconds = index * authoredDurationSeconds / frameCount;
    const sampledSeconds = Math.round(seconds * rate) / rate;
    const frame = Math.min(authoredFrames - 1, Math.max(0, Math.round(secondsToFrame(sampledSeconds, sourceFps))));
    const delayCentiseconds = Math.round((index + 1) * totalCentiseconds / frameCount)
      - Math.round(index * totalCentiseconds / frameCount);
    steps.push({ frame, delayCentiseconds });
  }
  return {
    exportFps: rate,
    frameCount,
    durationSeconds: totalCentiseconds / 100,
    authoredDurationSeconds,
    steps,
  };
};
