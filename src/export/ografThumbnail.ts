/**
 * The OGraf package thumbnail: the graphic as it stands on air (the last frame
 * of its play), drawn by the same renderer and embedded fonts as the GIF
 * export, at most 320 px on its longest edge. Renderers such as Reality Hub and
 * the OGraf DevTool show it in their graphic lists.
 */
import type { OGrafGeneratedPackage } from '../ograf/types';
import type { SceneData } from '../types/composition';
import { renderOGrafSvg } from '../ograf/svgRenderer';
import { evaluateSceneFrame } from '../ograf/evaluation';
import { collectSceneFontFamilies, embedSceneFonts } from './fontEmbedding';
import { rasterizeSvgToPng } from './svgRaster';
import { KCS_DEFAULT_TEXT_FONT } from '../utils/layers/textFonts';

export const OGRAF_THUMBNAIL_LONGEST_EDGE = 320;

export interface OGrafThumbnail {
  bytes: Uint8Array;
  width: number;
  height: number;
}

/** The thumbnail size for a scene: the longest edge is 320 px, the aspect is the scene's. */
export const ografThumbnailSize = (sceneWidth: number, sceneHeight: number): { width: number; height: number } => {
  const scale = OGRAF_THUMBNAIL_LONGEST_EDGE / Math.max(sceneWidth, sceneHeight);
  return { width: Math.max(1, Math.round(sceneWidth * scale)), height: Math.max(1, Math.round(sceneHeight * scale)) };
};

/** Renders the thumbnail of the scene a compiled package carries (its `scene.kcs`). */
export const renderOGrafThumbnail = async (plan: OGrafGeneratedPackage): Promise<OGrafThumbnail> => {
  const sceneFile = plan.files.find((file) => file.kind === 'scene');
  if (!sceneFile?.content) throw new Error('The package carries no scene to draw a thumbnail from.');
  const scene = JSON.parse(sceneFile.content) as SceneData;
  const { width, height } = ografThumbnailSize(scene.width, scene.height);
  const fonts = await embedSceneFonts(collectSceneFontFamilies(scene.layers, KCS_DEFAULT_TEXT_FONT));
  const svg = renderOGrafSvg(evaluateSceneFrame(scene, scene.totalFrames));
  return { bytes: await rasterizeSvgToPng(svg, width, height, fonts.css), width, height };
};
