import type { CharacterPart, LayerMask } from '../types/animator';
import type { EvaluatedLayer, LayerContent } from '../types/composition';
import { buildBezierPathD } from '../utils/bezierPath';
import { buildFreeformPath } from '../utils/freeform';
import { buildLayerMaskDefinition, layerMaskFilterId } from '../utils/layerMasks';
import { getShapeGeometry, polygonPointsToString } from '../utils/shapeGeometry';
import { resolveShapeAppearance } from '../utils/shapeAppearance';
import { getTrimPathDashProps, resolveTrimPath } from '../utils/trimPath';
import type { OGrafEvaluatedScene } from './evaluation';

export interface OGrafSvgRenderOptions {
  imageReferences?: Record<string, string>;
}

type SvgAttributes = Record<string, string | number | undefined>;
type MatteRelationship = {
  sourceLayerId: string;
  mode: 'alpha' | 'luminance';
  inverted: boolean;
  sourceVisible: boolean;
};

function escapeXml(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&apos;');
}

/** One deterministic namespace for every generated SVG identifier. */
function safeSvgId(value: string): string {
  return String(value).replace(/[^a-zA-Z0-9_-]/gu, '_') || 'empty';
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
    const path = content.path
      ? buildBezierPathD(content.path)
      : content.points && content.points.length >= 3
        ? buildFreeformPath(content.points)
        : '';
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

function renderText(layer: EvaluatedLayer, props: SvgAttributes = {}): string {
  const content = layer.content;
  const text = content.textValue || 'TEXT';
  return `<text x="0" y="0" text-anchor="middle" dominant-baseline="middle" fill="${escapeXml(content.fillColor || 'none')}" fill-opacity="${content.fillOpacity ?? 1}" stroke="${escapeXml(content.strokeColor || 'none')}" stroke-opacity="${content.strokeOpacity ?? 1}" stroke-width="0.5" font-size="${content.fontSize || 24}" font-weight="bold" font-family="${escapeXml(content.fontFamily || 'Outfit')}" vector-effect="non-scaling-stroke"${attributes(props)}>${escapeXml(text)}</text>`;
}

function renderImage(layer: EvaluatedLayer, options: OGrafSvgRenderOptions, props: SvgAttributes = {}): string {
  const content = layer.content;
  const href = options.imageReferences?.[content.imageUrl || ''] || content.imageUrl;
  if (!href) return '';
  const width = content.width || 180;
  const height = content.height || 120;
  return `<image href="${escapeXml(href)}" x="${-width / 2}" y="${-height / 2}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice"${attributes(props)} />`;
}

function renderLayerContent(layer: EvaluatedLayer, options: OGrafSvgRenderOptions, props: SvgAttributes = {}): string {
  if (layer.type === 'custom_text') return renderText(layer, props);
  if (layer.type === 'custom_image') return renderImage(layer, options, props);
  return renderGeometry(layer.type, layer.content, props);
}

function renderTrim(content: LayerContent): SvgAttributes {
  const trim = resolveTrimPath(content);
  return getTrimPathDashProps(trim) || {};
}

function layerTransform(scene: OGrafEvaluatedScene, layer: EvaluatedLayer): string {
  const centerX = scene.width / 2 + layer.transform.x;
  const centerY = scene.height / 2 + layer.transform.y;
  return `translate(${centerX} ${centerY}) rotate(${layer.transform.rotation}) scale(${layer.transform.scaleX} ${layer.transform.scaleY})`;
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
  const common: SvgAttributes = {
    fill: appearance.fillEnabled ? appearance.fillColor : 'none',
    'fill-opacity': appearance.fillOpacity,
    stroke: appearance.strokeEnabled ? appearance.strokeColor : 'none',
    'stroke-opacity': appearance.strokeOpacity,
    'stroke-width': appearance.strokeWidth,
    ...renderTrim(content),
  };
  const geometry = renderGeometry(layer.type, content, common);
  if (!geometry) throw new Error(`Unsupported or invalid SVG geometry for layer "${layer.id}" (${layer.type}).`);
  if (appearance.strokeAlignment === 'center' || !appearance.strokeEnabled || appearance.strokeWidth <= 0) return geometry;
  const maskId = safeSvgId(`${appearance.strokeAlignment}-stroke-${layer.id}`);
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

function asCharacterPart(layer: EvaluatedLayer): CharacterPart {
  return {
    id: layer.id,
    name: layer.id,
    type: layer.type as CharacterPart['type'],
    zIndex: layer.zIndex,
    baseTransform: layer.transform,
    pivot: { x: 0, y: 0 },
    width: layer.content.width,
    height: layer.content.height,
    path: layer.content.path,
    points: layer.content.points,
  } as CharacterPart;
}

function renderLayerMaskDefinitions(scene: OGrafEvaluatedScene, target: EvaluatedLayer): { defs: string; ids: string[] } {
  const masks = target.content.masks || [];
  if (masks.length === 0) return { defs: '', ids: [] };
  const part = asCharacterPart(target);
  const region = `M 0 0 H ${scene.width} V ${scene.height} H 0 Z`;
  const definitions: string[] = [];
  const ids: string[] = [];
  let additivePaths: string[] = [];
  let additiveMask: LayerMask | undefined;
  const flushAdditive = () => {
    if (!additiveMask || additivePaths.length === 0) return;
    const definition = buildLayerMaskDefinition(part, { ...additiveMask, path: additiveMask.path }, target.transform, { x: scene.width / 2, y: scene.height / 2 });
    if (definition) {
      const id = safeSvgId(`kcs-ograf-layer-mask-${target.id}-${additiveMask.id}-add`);
      const filter = definition.feather > 0 || definition.expansion !== 0
        ? `<filter id="${safeSvgId(layerMaskFilterId(id))}" filterUnits="userSpaceOnUse"><feMorphology operator="${definition.expansion > 0 ? 'dilate' : 'erode'}" radius="${Math.abs(definition.expansion)}" />${definition.feather > 0 ? `<feGaussianBlur stdDeviation="${definition.feather / 2}" />` : ''}</filter>`
        : '';
      definitions.push(`${filter}<mask id="${id}" x="0" y="0" width="${scene.width}" height="${scene.height}" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" mask-type="alpha"><path d="${escapeXml(additivePaths.join(' '))}" fill="white" fill-opacity="${definition.opacity}"${filter ? ` filter="url(#${safeSvgId(layerMaskFilterId(id))})` : ''} /></mask>`);
      ids.push(id);
    }
    additiveMask = undefined;
    additivePaths = [];
  };
  for (const mask of masks) {
    if (mask.enabled === false) continue;
    const definition = buildLayerMaskDefinition(part, mask, target.transform, { x: scene.width / 2, y: scene.height / 2 });
    if (!definition) continue;
    if (mask.mode === 'add' && mask.inverted !== true) {
      const compatible = additiveMask && additiveMask.opacity === mask.opacity && additiveMask.feather === mask.feather && additiveMask.expansion === mask.expansion;
      if (!compatible) flushAdditive();
      if (!additiveMask) additiveMask = mask;
      additivePaths.push(definition.pathD);
      continue;
    }
    flushAdditive();
    const id = safeSvgId(`kcs-ograf-layer-mask-${target.id}-${mask.id}`);
    const hole = mask.mode === 'subtract' || mask.mode === 'difference' ? mask.inverted !== true : mask.inverted === true;
    const path = hole ? `${region} ${definition.pathD}` : definition.pathD;
    const filter = definition.feather > 0 || definition.expansion !== 0
      ? `<filter id="${safeSvgId(layerMaskFilterId(id))}" filterUnits="userSpaceOnUse"><feMorphology operator="${definition.expansion > 0 ? 'dilate' : 'erode'}" radius="${Math.abs(definition.expansion)}" />${definition.feather > 0 ? `<feGaussianBlur stdDeviation="${definition.feather / 2}" />` : ''}</filter>`
      : '';
    definitions.push(`${filter}<mask id="${id}" x="0" y="0" width="${scene.width}" height="${scene.height}" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" mask-type="alpha"><path d="${escapeXml(path)}" fill="white" fill-opacity="${hole ? 1 : definition.opacity}" fill-rule="${hole ? 'evenodd' : 'nonzero'}"${filter ? ` filter="url(#${safeSvgId(layerMaskFilterId(id))})` : ''} />${hole && definition.opacity < 1 ? `<path d="${escapeXml(definition.pathD)}" fill="black" fill-opacity="${1 - definition.opacity}" />` : ''}</mask>`);
    ids.push(id);
  }
  flushAdditive();
  return { defs: definitions.join(''), ids };
}

function getMatteRelationship(layer: EvaluatedLayer): MatteRelationship | undefined {
  const v2 = layer.content.trackMatte;
  if (v2 && v2.enabled !== false) return {
    sourceLayerId: v2.sourceLayerId,
    mode: v2.mode,
    inverted: v2.inverted === true,
    sourceVisible: v2.sourceVisible !== false,
  };
  if (v2) return undefined;
  const legacy = layer.content.matte;
  if (!legacy || (legacy.mode || 'clip') === 'clip') return undefined;
  return {
    sourceLayerId: legacy.sourcePartId,
    mode: (legacy.mode || 'alpha') as 'alpha' | 'luminance',
    inverted: legacy.inverted === true,
    sourceVisible: true,
  };
}

function renderTrackMatteDefinition(scene: OGrafEvaluatedScene, target: EvaluatedLayer, options: OGrafSvgRenderOptions): { defs: string; id?: string; relationship?: MatteRelationship } {
  const relationship = getMatteRelationship(target);
  if (!relationship) return { defs: '' };
  const source = scene.layers.find((candidate) => candidate.id === relationship.sourceLayerId);
  if (!source) throw new Error(`Track matte source "${relationship.sourceLayerId}" for layer "${target.id}" was not found.`);
  const id = safeSvgId(`kcs-ograf-track-matte-${target.id}-${source.id}-${relationship.mode}${relationship.inverted ? '-inverted' : ''}`);
  const sourceContent = renderLayerContent(source, options, {
    fill: relationship.mode === 'luminance' ? (source.content.fillColor || 'white') : 'white',
    stroke: 'none',
    'fill-opacity': source.content.fillOpacity ?? 1,
  });
  if (!sourceContent) throw new Error(`Track matte source "${source.id}" has no supported SVG content.`);
  const sourceShape = `<g transform="${layerTransform(scene, source)}">${sourceContent}</g>`;
  const body = relationship.inverted && relationship.mode === 'alpha'
    ? `<path d="M 0 0 H ${scene.width} V ${scene.height} H 0 Z" fill="white" fill-rule="evenodd" />${sourceShape.replace('fill="white"', 'fill="black"')}`
    : relationship.inverted
      ? `<filter id="${id}-invert"><feComponentTransfer><feFuncR type="table" tableValues="1 0" /><feFuncG type="table" tableValues="1 0" /><feFuncB type="table" tableValues="1 0" /><feFuncA type="table" tableValues="1 0" /></feComponentTransfer></filter>${sourceShape.replace('<g ', `<g filter="url(#${id}-invert)" `)}`
      : sourceShape;
  return {
    defs: relationship.inverted && relationship.mode === 'alpha'
      ? `<mask id="${id}" x="0" y="0" width="${scene.width}" height="${scene.height}" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" mask-type="${relationship.mode}"><path d="M 0 0 H ${scene.width} V ${scene.height} H 0 Z" fill="white" fill-rule="evenodd" />${sourceShape.replace('fill="white"', 'fill="black"')}</mask>`
      : `<mask id="${id}" x="0" y="0" width="${scene.width}" height="${scene.height}" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" mask-type="${relationship.mode}">${body}</mask>`,
    id,
    relationship,
  };
}

function renderClipDefs(scene: OGrafEvaluatedScene, options: OGrafSvgRenderOptions): string {
  const defs: string[] = [];
  const renderedSources = new Set<string>();
  for (const target of scene.layers) {
    const relationship = getMatteRelationship(target);
    const sourceLayerId = relationship?.sourceLayerId || target.content.matte?.sourcePartId;
    const isClip = relationship?.mode === 'clip' || target.content.matte?.mode === 'clip' || (!relationship && Boolean(target.content.matte));
    if (!sourceLayerId || !isClip || renderedSources.has(sourceLayerId)) continue;
    const source = scene.layers.find((layer) => layer.id === sourceLayerId);
    if (!source) throw new Error(`Clip matte source "${sourceLayerId}" for layer "${target.id}" was not found.`);
    const sourceGeometry = renderLayerContent(source, options, { fill: 'white', stroke: 'none' });
    if (!sourceGeometry) throw new Error(`Clip matte source "${source.id}" has no supported SVG content.`);
    defs.push(`<clipPath id="kcs-clip-${safeSvgId(source.id)}" clipPathUnits="userSpaceOnUse"><g transform="${layerTransform(scene, source)}">${sourceGeometry}</g></clipPath>`);
  }
  return defs.join('');
}

function renderLayer(scene: OGrafEvaluatedScene, layer: EvaluatedLayer, options: OGrafSvgRenderOptions, maskIds: string[], matteId?: string, hidden = false): string {
  if (hidden || !layer.visible || layer.opacity <= 0) return '';
  const body = layer.type === 'custom_text' || layer.type === 'custom_image' ? renderLayerContent(layer, options) : renderShape(layer);
  const legacyMatte = layer.content.matte;
  const relationship = getMatteRelationship(layer);
  const clipSourceId = relationship?.sourceLayerId || legacyMatte?.sourcePartId;
  const clip = clipSourceId && (relationship?.mode === 'clip' || legacyMatte?.mode === 'clip' || (!relationship && legacyMatte))
    ? ` clip-path="url(#kcs-clip-${safeSvgId(clipSourceId)})"` : '';
  const allMaskIds = [...maskIds, ...(matteId ? [matteId] : [])];
  const transformedBody = `<g transform="${layerTransform(scene, layer)}">${body}</g>`;
  const maskedBody = allMaskIds.reduceRight(
    (content, id) => `<g mask="url(#${escapeXml(id)})">${content}</g>`,
    transformedBody,
  );
  return `<g data-layer-id="${escapeXml(layer.id)}" data-z-index="${layer.zIndex}" opacity="${layer.opacity}"${clip}>${maskedBody}</g>`;
}

export function renderOGrafSvg(scene: OGrafEvaluatedScene, options: OGrafSvgRenderOptions = {}): string {
  const defs: string[] = [renderClipDefs(scene, options)];
  const maskIds = new Map<string, string[]>();
  const matteIds = new Map<string, string>();
  const hiddenSources = new Set<string>();
  for (const target of scene.layers) {
    const layerMasks = renderLayerMaskDefinitions(scene, target);
    defs.push(layerMasks.defs);
    maskIds.set(target.id, layerMasks.ids);
    const matte = renderTrackMatteDefinition(scene, target, options);
    defs.push(matte.defs);
    if (matte.id) matteIds.set(target.id, matte.id);
    if (matte.relationship && !matte.relationship.sourceVisible) hiddenSources.add(matte.relationship.sourceLayerId);
  }
  const layers = scene.layers.map((layer) => renderLayer(scene, layer, options, maskIds.get(layer.id) || [], matteIds.get(layer.id), hiddenSources.has(layer.id))).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${scene.width}" height="${scene.height}" viewBox="0 0 ${scene.width} ${scene.height}"><defs>${defs.join('')}</defs>${layers}</svg>`;
}
