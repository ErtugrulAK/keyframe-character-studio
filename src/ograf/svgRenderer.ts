import type { EvaluatedLayer, LayerContent } from '../types/composition';
import { buildFreeformPath } from '../utils/freeform';
import { getShapeGeometry, polygonPointsToString } from '../utils/shapeGeometry';
import { resolveShapeAppearance } from '../utils/shapeAppearance';
import { getTrimPathDashProps, resolveTrimPath } from '../utils/trimPath';
import type { OGrafEvaluatedScene } from './evaluation';

export interface OGrafSvgRenderOptions {
  imageReferences?: Record<string, string>;
}

type SvgAttributes = Record<string, string | number | undefined>;

function escapeXml(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&apos;');
}

function svgAttributeName(key: string): string {
  if (key === 'strokeDasharray') return 'stroke-dasharray';
  if (key === 'strokeDashoffset') return 'stroke-dashoffset';
  return key;
}

function attributes(values: SvgAttributes): string {
  return Object.entries(values)
    .filter((entry): entry is [string, string | number] => entry[1] !== undefined)
    .map(([key, value]) => ` ${svgAttributeName(key)}="${escapeXml(String(value))}"`)
    .join('');
}

function renderGeometry(type: string, content: LayerContent, props: SvgAttributes = {}): string {
  const geometry = getShapeGeometry(type as Parameters<typeof getShapeGeometry>[0]);
  if (type === 'custom_freeform') {
    const path = content.points && content.points.length >= 3 ? buildFreeformPath(content.points) : '';
    if (!path) return '';
    return `<path d="${escapeXml(path)}" stroke-linejoin="round"${attributes(props)} />`;
  }
  if (!geometry) return '';
  if (geometry.kind === 'circle') return `<circle cx="0" cy="0" r="${geometry.r}"${attributes(props)} />`;
  if (geometry.kind === 'rect') {
    const rx = content.borderRadius ?? geometry.rx;
    return `<rect x="${geometry.x}" y="${geometry.y}" width="${geometry.width}" height="${geometry.height}" rx="${rx}"${attributes(props)} />`;
  }
  return `<polygon points="${polygonPointsToString(geometry.points)}"${attributes(props)} />`;
}

function renderTrim(content: LayerContent): SvgAttributes {
  const trim = resolveTrimPath(content);
  return getTrimPathDashProps(trim) || {};
}

function renderShape(layer: EvaluatedLayer): string {
  const content = layer.content;
  const appearance = resolveShapeAppearance({
    type: layer.type as Parameters<typeof resolveShapeAppearance>[0]['type'],
    fillColor: content.fillColor || 'none',
    strokeColor: content.strokeColor || 'none',
    fillEnabled: content.fillEnabled,
    fillOpacity: content.fillOpacity,
    strokeEnabled: content.strokeEnabled,
    strokeOpacity: content.strokeOpacity,
    strokeWidth: content.strokeWidth,
    strokeAlignment: content.strokeAlignment,
  });
  const trim = renderTrim(content);
  const common: SvgAttributes = {
    fill: appearance.fillEnabled ? appearance.fillColor : 'none',
    'fill-opacity': appearance.fillOpacity,
    stroke: appearance.strokeEnabled ? appearance.strokeColor : 'none',
    'stroke-opacity': appearance.strokeOpacity,
    'stroke-width': appearance.strokeWidth,
    'vector-effect': 'non-scaling-stroke',
    ...trim,
  };
  const geometry = renderGeometry(layer.type, content, common);
  if (!geometry) throw new Error(`Unsupported or invalid SVG geometry for layer "${layer.id}" (${layer.type}).`);
  if (appearance.strokeAlignment === 'center' || !appearance.strokeEnabled || appearance.strokeWidth <= 0) return geometry;

  const maskId = `${appearance.strokeAlignment}-stroke-${layer.id.replace(/[^a-zA-Z0-9_-]/gu, '_')}`;
  const maskGeometry = renderGeometry(layer.type, content, {
    fill: appearance.strokeAlignment === 'inside' ? 'white' : 'black',
    stroke: 'none',
  });
  const fillGeometry = renderGeometry(layer.type, content, { ...common, stroke: 'none', 'stroke-width': 0 });
  const strokeGeometry = renderGeometry(layer.type, content, {
    ...common,
    fill: 'none',
    'stroke-width': appearance.strokeWidth * 2,
    mask: `url(#${maskId})`,
  });
  return `<g><defs><mask id="${maskId}" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse"><rect x="-1000000" y="-1000000" width="2000000" height="2000000" fill="${appearance.strokeAlignment === 'inside' ? 'black' : 'white'}" />${maskGeometry}</mask></defs>${fillGeometry}${strokeGeometry}</g>`;
}

function renderText(layer: EvaluatedLayer): string {
  const content = layer.content;
  const text = content.textValue || 'TEXT';
  return `<text x="0" y="0" text-anchor="middle" dominant-baseline="middle" fill="${escapeXml(content.fillColor || 'none')}" stroke="${escapeXml(content.strokeColor || 'none')}" stroke-width="0.5" font-size="${content.fontSize || 24}" font-weight="bold" font-family="${escapeXml(content.fontFamily || 'Outfit')}" vector-effect="non-scaling-stroke">${escapeXml(text)}</text>`;
}

function renderImage(layer: EvaluatedLayer, options: OGrafSvgRenderOptions): string {
  const content = layer.content;
  if (!content.imageUrl) throw new Error(`Image layer "${layer.id}" has no image reference.`);
  const href = options.imageReferences?.[content.imageUrl] || content.imageUrl;
  const width = content.width || 180;
  const height = content.height || 120;
  return `<image href="${escapeXml(href)}" x="${-width / 2}" y="${-height / 2}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice" />`;
}

function layerTransform(scene: OGrafEvaluatedScene, layer: EvaluatedLayer): string {
  const centerX = scene.width / 2 + layer.transform.x;
  const centerY = scene.height / 2 + layer.transform.y;
  return `translate(${centerX} ${centerY}) rotate(${layer.transform.rotation}) scale(${layer.transform.scaleX} ${layer.transform.scaleY})`;
}

function renderClipDefs(scene: OGrafEvaluatedScene): string {
  const defs: string[] = [];
  const renderedSources = new Set<string>();
  for (const target of scene.layers) {
    const matte = target.content.matte;
    if (!matte || (matte.mode || 'clip') !== 'clip' || renderedSources.has(matte.sourcePartId)) continue;
    const source = scene.layers.find((layer) => layer.id === matte.sourcePartId);
    if (!source) throw new Error(`Clip matte source "${matte.sourcePartId}" for layer "${target.id}" was not found.`);
    const sourceGeometry = renderGeometry(source.type, source.content, { fill: 'white', stroke: 'none' });
    if (!sourceGeometry) throw new Error(`Clip matte source "${source.id}" has no supported SVG geometry.`);
    renderedSources.add(source.id);
    defs.push(`<clipPath id="kcs-clip-${escapeXml(source.id)}" clipPathUnits="userSpaceOnUse"><g transform="${layerTransform(scene, source)}">${sourceGeometry}</g></clipPath>`);
  }
  return defs.join('');
}

function renderLayer(scene: OGrafEvaluatedScene, layer: EvaluatedLayer, options: OGrafSvgRenderOptions): string {
  if (!layer.visible || layer.opacity <= 0) return '';
  let content = '';
  if (layer.type === 'custom_text') content = renderText(layer);
  else if (layer.type === 'custom_image') content = renderImage(layer, options);
  else content = renderShape(layer);
  const matte = layer.content.matte;
  const clip = matte && (matte.mode || 'clip') === 'clip' ? ` clip-path="url(#kcs-clip-${escapeXml(matte.sourcePartId)})"` : '';
  return `<g data-layer-id="${escapeXml(layer.id)}" data-z-index="${layer.zIndex}" transform="${layerTransform(scene, layer)}" opacity="${layer.opacity}"${clip}>${content}</g>`;
}

export function renderOGrafSvg(scene: OGrafEvaluatedScene, options: OGrafSvgRenderOptions = {}): string {
  const clipDefs = renderClipDefs(scene);
  const layers = scene.layers.map((layer) => renderLayer(scene, layer, options)).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${scene.width}" height="${scene.height}" viewBox="0 0 ${scene.width} ${scene.height}"><defs>${clipDefs}</defs>${layers}</svg>`;
}
