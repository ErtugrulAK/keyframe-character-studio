import type { SceneData } from '../types/composition';
import type { OGrafPublicImageField, OGrafPublicTextField } from './types';

/**
 * Emit a standalone OGraf runtime. Its pure path, mask, matte, and channel
 * evaluators intentionally mirror the editor authorities without importing the
 * React application into the materialized package.
 */
export function generateGraphicModule(
  sceneData: SceneData,
  textFields: OGrafPublicTextField[] = [],
  imageFields: OGrafPublicImageField[] = [],
  imageReferences: Record<string, string> = {},
  fontReferences: Record<string, string> = {},
): string {
  const bindings = {
    text: Object.fromEntries(textFields.map((field) => [field.id, { layerId: field.layerId, property: 'textValue' }])),
    image: Object.fromEntries(imageFields.map((field) => [field.id, { layerId: field.layerId, property: 'imageUrl' }])),
  };

  return `const SCENE = ${JSON.stringify(sceneData)};
const PUBLIC_BINDINGS = ${JSON.stringify(bindings)};
const IMAGE_REFERENCES = ${JSON.stringify(imageReferences)};
const FONT_REFERENCES = ${JSON.stringify(fontReferences)};
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function escapeXml(value) { return String(value).split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;').split('"').join('&quot;').split("'").join('&apos;'); }
function fontStyles() { return Object.entries(FONT_REFERENCES).map(([family, path]) => '@font-face{font-family:' + JSON.stringify(family) + ';src:url(' + JSON.stringify(path) + ');}' ).join(''); }
function solveCubicBezier(x1, y1, x2, y2, input) {
  if (input <= 0) return 0; if (input >= 1) return 1;
  let t = input;
  for (let index = 0; index < 8; index += 1) {
    const currentX = 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
    const slope = 3 * (1 - t) * (1 - t) * x1 + 6 * (1 - t) * t * (x2 - x1) + 3 * t * t * (1 - x2);
    if (Math.abs(slope) < 1e-6) break;
    t = clamp(t - (currentX - input) / slope, 0, 1);
  }
  return 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
}
function applyEasing(value, type, controlPoints, temporal) {
  const progress = clamp(value, 0, 1);
  if (type === 'hold') return 0;
  if (temporal) return solveCubicBezier(temporal.out.x, temporal.out.y, temporal.in.x, temporal.in.y, progress);
  if (controlPoints) return solveCubicBezier(controlPoints[0], controlPoints[1], controlPoints[2], controlPoints[3], progress);
  if (type === 'easeIn') return solveCubicBezier(0.42, 0, 1, 1, progress);
  if (type === 'easeOut') return solveCubicBezier(0, 0, 0.58, 1, progress);
  if (type === 'easeInOut' || type === 'cubic_bezier' || type === 'bezier' || type === 'autoBezier') return solveCubicBezier(0.42, 0, 0.58, 1, progress);
  return progress;
}
function channelValue(keyframes, frame, fallback) {
  const values = (keyframes || []).filter((keyframe) => (keyframe.templateId || 'Sequence') === 'Sequence').slice().sort((a, b) => a.frame - b.frame);
  if (!values.length) return fallback;
  if (frame <= values[0].frame) return values[0].value;
  if (frame >= values[values.length - 1].frame) return values[values.length - 1].value;
  let previous = values[0]; let next = values[values.length - 1];
  for (let index = 0; index < values.length - 1; index += 1) { if (frame >= values[index].frame && frame <= values[index + 1].frame) { previous = values[index]; next = values[index + 1]; break; } }
  const progress = (frame - previous.frame) / Math.max(1, next.frame - previous.frame);
  const temporal = previous.bezierOut && next.bezierIn ? { out: previous.bezierOut, in: next.bezierIn } : undefined;
  const eased = applyEasing(progress, previous.easing, previous.bezierControlPoints, temporal);
  return previous.value + (next.value - previous.value) * eased;
}
function topologyCompatible(first, second) { return Boolean(first && second && first.closed === second.closed && first.coordinateSpace === second.coordinateSpace && first.points.length === second.points.length && first.points.every((point, index) => point.id === second.points[index].id)); }
function interpolatePath(first, second, progress) {
  if (!topologyCompatible(first, second)) return first;
  const t = clamp(progress, 0, 1); const lerp = (a, b) => a + (b - a) * t;
  const handle = (a, b) => { if (!a && !b) return undefined; const start = a || b; const end = b || a; return { x: lerp(start.x, end.x), y: lerp(start.y, end.y) }; };
  return { version: 1, coordinateSpace: first.coordinateSpace, closed: first.closed, points: first.points.map((point, index) => { const target = second.points[index]; const inHandle = handle(point.handleIn, target.handleIn); const outHandle = handle(point.handleOut, target.handleOut); return { id: point.id, x: lerp(point.x, target.x), y: lerp(point.y, target.y), ...(inHandle ? { handleIn: inHandle } : {}), ...(outHandle ? { handleOut: outHandle } : {}), kind: t < 0.5 ? point.kind : target.kind }; }) };
}
function pathChannelValue(keyframes, frame, fallback) {
  const values = (keyframes || []).filter((keyframe) => (keyframe.templateId || 'Sequence') === 'Sequence').slice().sort((a, b) => a.frame - b.frame);
  if (!values.length) return fallback;
  if (frame <= values[0].frame) return values[0].value;
  if (frame >= values[values.length - 1].frame) return values[values.length - 1].value;
  let previous = values[0]; let next = values[values.length - 1];
  for (let index = 0; index < values.length - 1; index += 1) { if (frame >= values[index].frame && frame <= values[index + 1].frame) { previous = values[index]; next = values[index + 1]; break; } }
  const progress = (frame - previous.frame) / Math.max(1, next.frame - previous.frame);
  const temporal = previous.bezierOut && next.bezierIn ? { out: previous.bezierOut, in: next.bezierIn } : undefined;
  return interpolatePath(previous.value, next.value, applyEasing(progress, previous.easing, previous.bezierControlPoints, temporal));
}
function pathD(path, map) {
  if (!path || !path.points || path.points.length < 2) return '';
  const points = path.points.map(map); const mappedHandle = (handle, fallback) => map(handle || fallback); let value = 'M ' + points[0].x + ' ' + points[0].y;
  for (let index = 1; index < points.length; index += 1) { const previous = path.points[index - 1]; const current = path.points[index]; const out = mappedHandle(previous.handleOut, previous); const incoming = mappedHandle(current.handleIn, current); value += previous.handleOut || current.handleIn ? ' C ' + out.x + ' ' + out.y + ', ' + incoming.x + ' ' + incoming.y + ', ' + points[index].x + ' ' + points[index].y : ' L ' + points[index].x + ' ' + points[index].y; }
  if (path.closed) { const previous = path.points[path.points.length - 1]; const current = path.points[0]; const out = mappedHandle(previous.handleOut, previous); const incoming = mappedHandle(current.handleIn, current); if (previous.handleOut || current.handleIn) value += ' C ' + out.x + ' ' + out.y + ', ' + incoming.x + ' ' + incoming.y + ', ' + points[0].x + ' ' + points[0].y; value += ' Z'; }
  return value;
}
function localPathD(path) { return pathD(path, (point) => ({ x: point.x, y: point.y })); }
function maskPathD(layer, mask, scene) {
  const width = Number.isFinite(layer.width) ? layer.width : 120; const height = Number.isFinite(layer.height) ? layer.height : 80;
  const radians = layer.transform.rotation * Math.PI / 180;
  return pathD(mask.path, (point) => { const local = mask.path.coordinateSpace === 'normalized' ? { x: (point.x - 0.5) * width, y: (point.y - 0.5) * height } : point; const x = local.x * layer.transform.scaleX; const y = local.y * layer.transform.scaleY; return { x: scene.width / 2 + layer.transform.x + x * Math.cos(radians) - y * Math.sin(radians), y: scene.height / 2 + layer.transform.y + x * Math.sin(radians) + y * Math.cos(radians) }; });
}
function geometry(layer, props) {
  const attributes = props || ''; const path = layer.path ? localPathD(layer.path) : layer.points && layer.points.length >= 3 ? 'M ' + layer.points.map((point) => point.x + ' ' + point.y).join(' L ') + ' Z' : '';
  if (layer.type === 'custom_freeform') return path ? '<path d="' + escapeXml(path) + '" stroke-linejoin="round"' + attributes + ' />' : '';
  if (layer.type === 'custom_circle') return '<circle cx="0" cy="0" r="30"' + attributes + ' />';
  if (layer.type === 'custom_box') return '<rect x="-30" y="-30" width="60" height="60" rx="0"' + attributes + ' />';
  if (layer.type === 'custom_rect') return '<rect x="-60" y="-30" width="120" height="60" rx="' + (layer.borderRadius || 0) + '"' + attributes + ' />';
  if (layer.type === 'custom_capsule') return '<rect x="-50" y="-20" width="100" height="40" rx="20"' + attributes + ' />';
  const points = { custom_triangle: '0,-35 35,25 -35,25', custom_diamond: '0,-35 35,0 0,35 -35,0', custom_star: '0,-35 10,-10 35,-10 15,5 23,30 0,15 -23,30 -15,5 -35,-10 -10,-10', custom_parallelogram: '-35,-30 85,-30 35,30 -85,30' };
  return points[layer.type] ? '<polygon points="' + points[layer.type] + '"' + attributes + ' />' : '';
}
function text(layer, props) { return '<text x="0" y="0" text-anchor="middle" dominant-baseline="middle" fill="' + escapeXml(layer.fillColor || 'none') + '" fill-opacity="' + (layer.fillOpacity === undefined ? 1 : layer.fillOpacity) + '" font-size="' + (layer.fontSize || 24) + '" font-family="' + escapeXml(layer.fontFamily || 'Outfit') + '"' + (props || '') + '>' + escapeXml(layer.textValue || 'TEXT') + '</text>'; }
function image(layer, imageReferences, props) { const width = layer.width || 180; const height = layer.height || 120; const href = imageReferences[layer.imageUrl] || layer.imageUrl || ''; return '<image href="' + escapeXml(href) + '" x="' + (-width / 2) + '" y="' + (-height / 2) + '" width="' + width + '" height="' + height + '" preserveAspectRatio="xMidYMid slice"' + (props || '') + ' />'; }
function content(layer, imageReferences, props) { if (layer.type === 'custom_text') return text(layer, props); if (layer.type === 'custom_image') return image(layer, imageReferences, props); return geometry(layer, props); }
function transform(scene, layer) { return 'translate(' + (scene.width / 2 + layer.transform.x) + ' ' + (scene.height / 2 + layer.transform.y) + ') rotate(' + layer.transform.rotation + ') scale(' + layer.transform.scaleX + ' ' + layer.transform.scaleY + ')'; }
function evaluateScene(scene, frame) {
  const transforms = {}; const evaluateTransform = (layer) => { if (transforms[layer.id]) return transforms[layer.id]; const track = scene.tracks.find((item) => item.partId === layer.id); const channels = track && track.channels ? track.channels : {}; let result = { x: channelValue(channels.x, frame, layer.x), y: channelValue(channels.y, frame, layer.y), rotation: channelValue(channels.rotation, frame, layer.rotation), scaleX: channelValue(channels.scaleX, frame, layer.scaleX), scaleY: channelValue(channels.scaleY, frame, layer.scaleY), opacity: channelValue(channels.opacity, frame, layer.opacity) }; if (layer.parentId) { const parent = scene.layers.find((item) => item.id === layer.parentId); if (parent && parent.id !== layer.id) { const parentTransform = evaluateTransform(parent); const radians = parentTransform.rotation * Math.PI / 180; const sx = result.x * parentTransform.scaleX; const sy = result.y * parentTransform.scaleY; result = { x: parentTransform.x + sx * Math.cos(radians) - sy * Math.sin(radians), y: parentTransform.y + sx * Math.sin(radians) + sy * Math.cos(radians), rotation: parentTransform.rotation + result.rotation, scaleX: parentTransform.scaleX * result.scaleX, scaleY: parentTransform.scaleY * result.scaleY, opacity: result.opacity }; } } transforms[layer.id] = result; return result; };
  return scene.layers.map((layer) => { const track = scene.tracks.find((item) => item.partId === layer.id); const channels = track && track.channels ? track.channels : {}; const evaluated = { ...layer, transform: evaluateTransform(layer), visible: layer.visible !== false, opacity: layer.visible === false ? 0 : clamp(evaluateTransform(layer).opacity, 0, 1), trimPathEnabled: layer.trimPathEnabled, trimPathStart: channelValue(channels.trimPathStart, frame, layer.trimPathStart === undefined ? 0 : layer.trimPathStart), trimPathEnd: channelValue(channels.trimPathEnd, frame, layer.trimPathEnd === undefined ? 1 : layer.trimPathEnd), trimPathOffset: channelValue(channels.trimPathOffset, frame, layer.trimPathOffset || 0) }; evaluated.masks = (layer.masks || []).map((mask) => { const scalar = track && track.maskChannels ? track.maskChannels : {}; const paths = track && track.maskPathChannels ? track.maskPathChannels : {}; return { ...mask, path: pathChannelValue(paths[mask.id + ':path'], frame, mask.path), opacity: clamp(channelValue(scalar[mask.id + ':opacity'], frame, mask.opacity === undefined ? 1 : mask.opacity), 0, 1), feather: Math.max(0, channelValue(scalar[mask.id + ':feather'], frame, mask.feather || 0)), expansion: channelValue(scalar[mask.id + ':expansion'], frame, mask.expansion || 0) }; }); return evaluated; }).sort((a, b) => a.zIndex - b.zIndex);
}
function maskDefs(scene, layer) {
  const masks = layer.masks || []; const defs = []; const ids = []; const region = 'M 0 0 H ' + scene.width + ' V ' + scene.height + ' H 0 Z'; let addPaths = []; let addMask = null;
  const flush = () => { if (!addMask || !addPaths.length) return; const id = 'kcs-ograf-layer-mask-' + layer.id + '-' + addMask.id + '-add'; defs.push('<mask id="' + id + '" x="0" y="0" width="' + scene.width + '" height="' + scene.height + '" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" mask-type="alpha"><path d="' + escapeXml(addPaths.join(' ')) + '" fill="white" fill-opacity="' + (addMask.opacity === undefined ? 1 : addMask.opacity) + '" /></mask>'); ids.push(id); addMask = null; addPaths = []; };
  masks.forEach((mask) => { if (mask.enabled === false) return; const d = maskPathD(layer, mask, scene); if (!d) return; if (mask.mode === 'add' && mask.inverted !== true) { if (!addMask) addMask = mask; addPaths.push(d); return; } flush(); const id = 'kcs-ograf-layer-mask-' + layer.id + '-' + mask.id; const hole = mask.mode === 'subtract' || mask.mode === 'difference' ? mask.inverted !== true : mask.inverted === true; defs.push('<mask id="' + id + '" x="0" y="0" width="' + scene.width + '" height="' + scene.height + '" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" mask-type="alpha"><path d="' + escapeXml(hole ? region + ' ' + d : d) + '" fill="white" fill-opacity="' + (hole ? 1 : (mask.opacity === undefined ? 1 : mask.opacity)) + '" fill-rule="' + (hole ? 'evenodd' : 'nonzero') + '" /></mask>'); ids.push(id); }); flush(); return { defs: defs.join(''), ids }; }
function matteRelationship(layer) { if (layer.trackMatte) return { sourceLayerId: layer.trackMatte.sourceLayerId, mode: layer.trackMatte.mode, inverted: layer.trackMatte.inverted === true, sourceVisible: layer.trackMatte.sourceVisible !== false }; const matte = layer.matte; if (!matte || (matte.mode || 'clip') === 'clip') return undefined; return { sourceLayerId: matte.sourcePartId, mode: matte.mode || 'alpha', inverted: matte.inverted === true, sourceVisible: true }; }
function matteDefs(scene, evaluated) { const defs = []; const ids = {}; const hidden = {}; evaluated.forEach((layer) => { const relation = matteRelationship(layer); if (!relation) return; const source = evaluated.find((candidate) => candidate.id === relation.sourceLayerId); if (!source) throw new Error('Missing track matte source: ' + relation.sourceLayerId); const id = 'kcs-ograf-track-matte-' + layer.id + '-' + source.id + '-' + relation.mode + (relation.inverted ? '-inverted' : ''); const sourceBody = content(source, IMAGE_REFERENCES, ' fill="' + (relation.mode === 'luminance' ? escapeXml(source.fillColor || 'white') : 'white') + '" stroke="none"'); const sourceShape = '<g transform="' + transform(scene, source) + '">' + sourceBody + '</g>'; const body = relation.inverted && relation.mode === 'alpha' ? '<path d="M 0 0 H ' + scene.width + ' V ' + scene.height + ' H 0 Z" fill="white" fill-rule="evenodd" />' + sourceShape.replace(/fill="white"/gu, 'fill="black"') : relation.inverted ? '<filter id="' + id + '-invert"><feComponentTransfer><feFuncR type="table" tableValues="1 0" /><feFuncG type="table" tableValues="1 0" /><feFuncB type="table" tableValues="1 0" /><feFuncA type="table" tableValues="1 0" /></feComponentTransfer></filter>' + sourceShape.replace('<g ', '<g filter="url(#' + id + '-invert)" ') : sourceShape; defs.push('<mask id="' + id + '" x="0" y="0" width="' + scene.width + '" height="' + scene.height + '" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" mask-type="' + relation.mode + '">' + body + '</mask>'); ids[layer.id] = id; if (!relation.sourceVisible) hidden[relation.sourceLayerId] = true; }); return { defs: defs.join(''), ids, hidden }; }
function clipDefs(scene, evaluated) { const defs = []; const seen = {}; evaluated.forEach((target) => { const matte = target.matte; if (!matte || (matte.mode || 'clip') !== 'clip' || seen[matte.sourcePartId]) return; const source = evaluated.find((candidate) => candidate.id === matte.sourcePartId); if (!source) throw new Error('Missing clip matte source: ' + matte.sourcePartId); defs.push('<clipPath id="kcs-clip-' + escapeXml(source.id) + '" clipPathUnits="userSpaceOnUse"><g transform="' + transform(scene, source) + '">' + content(source, IMAGE_REFERENCES, ' fill="white" stroke="none"') + '</g></clipPath>'); seen[source.id] = true; }); return defs.join(''); }
function renderShape(layer, attrs) {
  const base = geometry(layer, '');
  const stroke = layer.strokeEnabled === false ? 'none' : layer.strokeColor || 'none';
  const strokeWidth = layer.strokeWidth === undefined ? 1.5 : layer.strokeWidth;
  const common = attrs + ' vector-effect="non-scaling-stroke"';
  if (!layer.strokeAlignment || layer.strokeAlignment === 'center' || stroke === 'none' || strokeWidth <= 0) return geometry(layer, common);
  const id = layer.strokeAlignment + '-stroke-' + layer.id.replace(/[^a-zA-Z0-9_-]/gu, '_');
  const maskBase = layer.strokeAlignment === 'inside' ? 'black' : 'white';
  const maskShape = geometry(layer, ' fill="' + (layer.strokeAlignment === 'inside' ? 'white' : 'black') + '" stroke="none"');
  const fillShape = geometry(layer, common + ' stroke="none" stroke-width="0"');
  const strokeShape = geometry(layer, common + ' fill="none" stroke-width="' + (strokeWidth * 2) + '" mask="url(#' + id + ')"');
  return '<g><defs><mask id="' + id + '" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse"><rect x="-1000000" y="-1000000" width="2000000" height="2000000" fill="' + maskBase + '" />' + maskShape + '</mask></defs>' + fillShape + strokeShape + '</g>';
}
function trimAttributes(layer) { if (layer.trimPathEnabled !== true) return ''; const rawSpan = layer.trimPathEnd - layer.trimPathStart; const span = ((rawSpan % 1) + 1) % 1; const begin = ((layer.trimPathStart + (layer.trimPathOffset % 360) / 360) % 1 + 1) % 1; if (rawSpan === 1) return ' pathLength="1"'; if (span === 0) return ' pathLength="1" stroke-dasharray="0 1" stroke-dashoffset="' + (begin === 0 ? 0 : -begin) + '"'; return ' pathLength="1" stroke-dasharray="' + span + ' ' + (1 - span) + '" stroke-dashoffset="' + (begin === 0 ? 0 : -begin) + '"'; }
function renderLayer(scene, layer, maskMap, matteId, hidden) { if (hidden || !layer.visible || layer.opacity <= 0) return ''; const attrs = ' fill="' + escapeXml(layer.fillEnabled === false ? 'none' : layer.fillColor || 'none') + '" fill-opacity="' + (layer.fillOpacity === undefined ? 1 : layer.fillOpacity) + '" stroke="' + escapeXml(layer.strokeEnabled === false ? 'none' : layer.strokeColor || 'none') + '" stroke-opacity="' + (layer.strokeOpacity === undefined ? 1 : layer.strokeOpacity) + '" stroke-width="' + (layer.strokeWidth === undefined ? 1.5 : layer.strokeWidth) + '"' + trimAttributes(layer); const body = layer.type === 'custom_text' ? text(layer, attrs) : layer.type === 'custom_image' ? image(layer, IMAGE_REFERENCES, attrs) : renderShape(layer, attrs); let inner = '<g transform="' + transform(scene, layer) + '">' + body + '</g>'; const ids = (maskMap[layer.id] || []).concat(matteId ? [matteId] : []); ids.slice().reverse().forEach((id) => { inner = '<g mask="url(#' + escapeXml(id) + ')">' + inner + '</g>'; }); const clip = layer.matte && (layer.matte.mode || 'clip') === 'clip' ? ' clip-path="url(#kcs-clip-' + escapeXml(layer.matte.sourcePartId) + ')"' : ''; return '<g data-layer-id="' + escapeXml(layer.id) + '" data-z-index="' + layer.zIndex + '" opacity="' + layer.opacity + '"' + clip + '>' + inner + '</g>'; }
function renderScene(scene, frame) { const evaluated = evaluateScene(scene, frame); const defs = [clipDefs(scene, evaluated)]; const maskMap = {}; evaluated.forEach((layer) => { const masks = maskDefs(scene, layer); defs.push(masks.defs); maskMap[layer.id] = masks.ids; }); const matte = matteDefs(scene, evaluated); defs.push(matte.defs); return '<svg xmlns="http://www.w3.org/2000/svg" width="' + scene.width + '" height="' + scene.height + '" viewBox="0 0 ' + scene.width + ' ' + scene.height + '"><style>' + fontStyles() + '</style><defs>' + defs.join('') + '</defs>' + evaluated.map((layer) => renderLayer(scene, layer, maskMap, matte.ids[layer.id], matte.hidden[layer.id])).join('') + '</svg>'; }
export default class Graphic extends HTMLElement {
  constructor() { super(); this._scene = JSON.parse(JSON.stringify(SCENE)); this._currentFrame = 0; this._currentStep = undefined; this._raf = null; this._token = 0; this._resolveAction = null; }
  _cancel() { this._token += 1; if (this._resolveAction) { this._resolveAction({ statusCode: 200, statusMessage: 'Superseded' }); this._resolveAction = null; } if (this._raf !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this._raf); this._raf = null; }
  _render() { this.innerHTML = renderScene(this._scene, this._currentFrame); }
  _applyData(data) { if (!data || typeof data !== 'object') return undefined; for (const key of Object.keys(data)) { const binding = PUBLIC_BINDINGS.text[key] || PUBLIC_BINDINGS.image[key]; if (!binding) return { statusCode: 400, statusMessage: 'Unknown public field: ' + key }; const layer = this._scene.layers.find((item) => item.id === binding.layerId); if (!layer || typeof data[key] !== 'string') return { statusCode: 400, statusMessage: 'Invalid public field value: ' + key }; if (binding.property === 'imageUrl' && !IMAGE_REFERENCES[data[key]]) return { statusCode: 400, statusMessage: 'Image value is not a packaged asset: ' + key }; layer[binding.property] = data[key]; } return undefined; }
  async load(params) { this._cancel(); if (params && params.renderType && params.renderType !== 'realtime') return { statusCode: 400, statusMessage: 'Only realtime rendering is supported' }; const error = this._applyData(params && params.data); if (error) return error; this._currentFrame = 0; this._currentStep = undefined; this._render(); return { statusCode: 200 }; }
  async dispose() { this._cancel(); this._scene = JSON.parse(JSON.stringify(SCENE)); this.innerHTML = ''; return { statusCode: 200 }; }
  _animate(targetFrame, skipAnimation) { this._cancel(); const token = this._token; const startFrame = this._currentFrame; if (skipAnimation || startFrame === targetFrame || typeof requestAnimationFrame !== 'function') { this._currentFrame = targetFrame; this._render(); return Promise.resolve({ statusCode: 200 }); } const duration = Math.abs(targetFrame - startFrame) / this._scene.fps * 1000; const started = typeof performance === 'object' ? performance.now() : Date.now(); return new Promise((resolve) => { this._resolveAction = resolve; const tick = (now) => { if (token !== this._token || !this._scene) { resolve({ statusCode: 200, statusMessage: 'Superseded' }); return; } const progress = clamp((now - started) / duration, 0, 1); this._currentFrame = startFrame + (targetFrame - startFrame) * progress; this._render(); if (progress >= 1) { this._resolveAction = null; resolve({ statusCode: 200 }); } else this._raf = requestAnimationFrame(tick); }; this._raf = requestAnimationFrame(tick); }); }
  async playAction(params = {}) { this._currentStep = 0; const result = await this._animate(this._scene.totalFrames, params.skipAnimation === true); return Object.assign({}, result, { currentStep: this._currentStep }); }
  async stopAction(params = {}) { const result = await this._animate(this._scene.totalFrames, params.skipAnimation === true); this._currentStep = undefined; return result; }
  async updateAction(params) { this._cancel(); const error = this._applyData(params && params.data); if (error) return error; this._render(); return { statusCode: 200 }; }
  async customAction() { return { statusCode: 400, statusMessage: 'No custom actions supported' }; }
}
`;
}
