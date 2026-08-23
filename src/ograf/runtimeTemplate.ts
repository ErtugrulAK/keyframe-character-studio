import type { SceneData } from '../types/composition';
import type { OGrafPublicImageField, OGrafPublicTextField } from './types';

/**
 * The generated module is intentionally emitted from one source template.
 * Its evaluator and SVG serializer mirror the pure Phase 2A contracts without
 * importing application modules into the materialized package.
 */
export function generateGraphicModule(
  sceneData: SceneData,
  textFields: OGrafPublicTextField[] = [],
  imageFields: OGrafPublicImageField[] = [],
  imageReferences: Record<string, string> = {},
): string {
  const bindings = {
    text: Object.fromEntries(textFields.map((field) => [field.id, { layerId: field.layerId, property: 'textValue' }])),
    image: Object.fromEntries(imageFields.map((field) => [field.id, { layerId: field.layerId, property: 'imageUrl' }])),
  };

  return `const SCENE = ${JSON.stringify(sceneData)};
const PUBLIC_BINDINGS = ${JSON.stringify(bindings)};
const IMAGE_REFERENCES = ${JSON.stringify(imageReferences)};

function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function escapeXml(value) {
  return String(value).split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;').split('"').join('&quot;').split("'").join('&apos;');
}
function solveCubicBezier(x1, y1, x2, y2, input) {
  if (input <= 0) return 0;
  if (input >= 1) return 1;
  let t = input;
  for (let index = 0; index < 8; index += 1) {
    const currentX = 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
    const slope = 3 * (1 - t) * (1 - t) * x1 + 6 * (1 - t) * t * (x2 - x1) + 3 * t * t * (1 - x2);
    if (Math.abs(slope) < 1e-6) break;
    t = clamp(t - (currentX - input) / slope, 0, 1);
  }
  return 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
}
function applyEasing(value, type, controlPoints) {
  if (controlPoints) return solveCubicBezier(controlPoints[0], controlPoints[1], controlPoints[2], controlPoints[3], value);
  switch (type) {
    case 'cubic_bezier': return solveCubicBezier(0.42, 0, 0.58, 1, value);
    case 'easeIn': return solveCubicBezier(0.42, 0, 1, 1, value);
    case 'easeOut': return solveCubicBezier(0, 0, 0.58, 1, value);
    case 'easeInOut': return solveCubicBezier(0.42, 0, 0.58, 1, value);
    case 'bounce': {
      const n1 = 7.5625; const d1 = 2.75; let x = value;
      if (x < 1 / d1) return n1 * x * x;
      if (x < 2 / d1) { x -= 1.5 / d1; return n1 * x * x + 0.75; }
      if (x < 2.5 / d1) { x -= 2.25 / d1; return n1 * x * x + 0.9375; }
      x -= 2.625 / d1; return n1 * x * x + 0.984375;
    }
    case 'elastic': {
      const c4 = (2 * Math.PI) / 3;
      return value === 0 ? 0 : value === 1 ? 1 : -Math.pow(2, 10 * value - 10) * Math.sin((value * 10 - 10.75) * c4);
    }
    case 'anticipate': return solveCubicBezier(0.6, -0.28, 0.735, 0.045, value);
    case 'overshoot': return solveCubicBezier(0.175, 0.885, 0.32, 1.275, value);
    default: return value;
  }
}
function channelValue(keyframes, frame, fallback) {
  const values = (keyframes || []).filter((keyframe) => (keyframe.templateId || 'Sequence') === 'Sequence').slice().sort((a, b) => a.frame - b.frame);
  if (!values.length) return fallback;
  if (frame <= values[0].frame) return values[0].value;
  if (frame >= values[values.length - 1].frame) return values[values.length - 1].value;
  let previous = values[0]; let next = values[values.length - 1];
  for (let index = 0; index < values.length - 1; index += 1) {
    if (frame >= values[index].frame && frame <= values[index + 1].frame) { previous = values[index]; next = values[index + 1]; break; }
  }
  const progress = (frame - previous.frame) / (next.frame - previous.frame);
  const eased = applyEasing(progress, previous.easing, previous.bezierControlPoints);
  return previous.value + (next.value - previous.value) * eased;
}
function evaluateScene(scene, frame) {
  const cache = {};
  const transforms = {};
  const evaluateTransform = (layer) => {
    if (transforms[layer.id]) return transforms[layer.id];
    const track = scene.tracks.find((item) => item.partId === layer.id);
    const channels = track && track.channels ? track.channels : {};
    let result = {
      x: channelValue(channels.x, frame, layer.x),
      y: channelValue(channels.y, frame, layer.y),
      rotation: channelValue(channels.rotation, frame, layer.rotation),
      scaleX: channelValue(channels.scaleX, frame, layer.scaleX),
      scaleY: channelValue(channels.scaleY, frame, layer.scaleY),
      opacity: channelValue(channels.opacity, frame, layer.opacity),
    };
    if (layer.parentId) {
      const parent = scene.layers.find((item) => item.id === layer.parentId);
      if (parent && parent.id !== layer.id) {
        const parentTransform = evaluateTransform(parent);
        const radians = parentTransform.rotation * Math.PI / 180;
        const scaledX = result.x * parentTransform.scaleX;
        const scaledY = result.y * parentTransform.scaleY;
        result = {
          x: parentTransform.x + scaledX * Math.cos(radians) - scaledY * Math.sin(radians),
          y: parentTransform.y + scaledX * Math.sin(radians) + scaledY * Math.cos(radians),
          rotation: parentTransform.rotation + result.rotation,
          scaleX: parentTransform.scaleX * result.scaleX,
          scaleY: parentTransform.scaleY * result.scaleY,
          opacity: result.opacity,
        };
      }
    }
    transforms[layer.id] = result;
    return result;
  };
  return scene.layers.map((layer) => {
    const track = scene.tracks.find((item) => item.partId === layer.id);
    const channels = track && track.channels ? track.channels : {};
    const transform = evaluateTransform(layer);
    const trimPathEnabled = layer.trimPathEnabled;
    return {
      ...layer,
      transform,
      visible: layer.visible !== false && transform.opacity > 0.001,
      opacity: layer.visible === false ? 0 : clamp(transform.opacity, 0, 1),
      trimPathEnabled,
      trimPathStart: channelValue(channels.trimPathStart, frame, layer.trimPathStart === undefined ? 0 : layer.trimPathStart),
      trimPathEnd: channelValue(channels.trimPathEnd, frame, layer.trimPathEnd === undefined ? 1 : layer.trimPathEnd),
      trimPathOffset: channelValue(channels.trimPathOffset, frame, layer.trimPathOffset || 0),
    };
  }).sort((a, b) => a.zIndex - b.zIndex);
}
function geometry(layer) {
  if (layer.type === 'custom_circle') return '<circle cx="0" cy="0" r="30" />';
  if (layer.type === 'custom_box') return '<rect x="-30" y="-30" width="60" height="60" rx="0" />';
  if (layer.type === 'custom_rect') return '<rect x="-60" y="-30" width="120" height="60" rx="' + (layer.borderRadius || 0) + '" />';
  if (layer.type === 'custom_capsule') return '<rect x="-50" y="-20" width="100" height="40" rx="20" />';
  const points = { custom_triangle: '0,-35 35,25 -35,25', custom_diamond: '0,-35 35,0 0,35 -35,0', custom_star: '0,-35 10,-10 35,-10 15,5 23,30 0,15 -23,30 -15,5 -35,-10 -10,-10', custom_parallelogram: '-35,-30 85,-30 35,30 -85,30' };
  if (points[layer.type]) return '<polygon points="' + points[layer.type] + '" />';
  if (layer.type === 'custom_freeform' && layer.points && layer.points.length >= 3) return '<path d="M ' + layer.points.map((point) => point.x + ' ' + point.y).join(' L ') + ' Z" stroke-linejoin="round" />';
  return '';
}
function trimAttributes(layer) {
  if (layer.trimPathEnabled !== true) return '';
  const rawSpan = layer.trimPathEnd - layer.trimPathStart;
  const span = ((rawSpan % 1) + 1) % 1;
  const begin = ((layer.trimPathStart + (layer.trimPathOffset % 360) / 360) % 1 + 1) % 1;
  const dashOffset = begin === 0 ? 0 : -begin;
  if (rawSpan === 1) return ' pathLength="1"';
  if (span === 0) return ' pathLength="1" stroke-dasharray="0 1" stroke-dashoffset="' + dashOffset + '"';
  return ' pathLength="1" stroke-dasharray="' + span + ' ' + (1 - span) + '" stroke-dashoffset="' + dashOffset + '"';
}
function withAttributes(shape, attrs) { return shape.replace(' />', attrs + ' />'); }
function renderShape(layer) {
  const base = geometry(layer);
  if (!base) throw new Error('Unsupported geometry: ' + layer.type);
  const fill = layer.fillEnabled === false ? 'none' : layer.fillColor || 'none';
  const stroke = layer.strokeEnabled === false ? 'none' : layer.strokeColor || 'none';
  const fillOpacity = layer.fillOpacity === undefined ? 1 : layer.fillOpacity;
  const strokeOpacity = layer.strokeOpacity === undefined ? 1 : layer.strokeOpacity;
  const strokeWidth = layer.strokeWidth === undefined ? 1.5 : layer.strokeWidth;
  const common = ' fill="' + escapeXml(fill) + '" fill-opacity="' + fillOpacity + '" stroke="' + escapeXml(stroke) + '" stroke-opacity="' + strokeOpacity + '" stroke-width="' + strokeWidth + '" vector-effect="non-scaling-stroke"' + trimAttributes(layer);
  if (!layer.strokeAlignment || layer.strokeAlignment === 'center' || stroke === 'none' || strokeWidth <= 0) return withAttributes(base, common);
  const maskId = layer.strokeAlignment + '-stroke-' + layer.id.replace(/[^a-zA-Z0-9_-]/gu, '_');
  const maskBase = layer.strokeAlignment === 'inside' ? 'black' : 'white';
  const maskShape = withAttributes(base, ' fill="' + (layer.strokeAlignment === 'inside' ? 'white' : 'black') + '" stroke="none"');
  const fillShape = withAttributes(base, common + ' stroke="none" stroke-width="0"');
  const strokeShape = withAttributes(base, common + ' fill="none" stroke-width="' + (strokeWidth * 2) + '" mask="url(#' + maskId + ')"');
  return '<g><defs><mask id="' + maskId + '" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse"><rect x="-1000000" y="-1000000" width="2000000" height="2000000" fill="' + maskBase + '" />' + maskShape + '</mask></defs>' + fillShape + strokeShape + '</g>';
}
function layerTransform(scene, layer) {
  return 'translate(' + (scene.width / 2 + layer.transform.x) + ' ' + (scene.height / 2 + layer.transform.y) + ') rotate(' + layer.transform.rotation + ') scale(' + layer.transform.scaleX + ' ' + layer.transform.scaleY + ')';
}
function clipDefs(scene, evaluated) {
  const defs = []; const seen = {};
  evaluated.forEach((target) => {
    const matte = target.matte;
    if (!matte || (matte.mode || 'clip') !== 'clip' || seen[matte.sourcePartId]) return;
    const source = evaluated.find((layer) => layer.id === matte.sourcePartId);
    if (!source) throw new Error('Missing clip matte source: ' + matte.sourcePartId);
    const sourceGeometry = renderShape({ ...source, strokeAlignment: 'center', strokeEnabled: false, fillEnabled: true });
    seen[source.id] = true;
    defs.push('<clipPath id="kcs-clip-' + escapeXml(source.id) + '" clipPathUnits="userSpaceOnUse"><g transform="' + layerTransform(scene, source) + '">' + sourceGeometry + '</g></clipPath>');
  });
  return defs.join('');
}
function renderScene(scene, frame, imageReferences) {
  const evaluated = evaluateScene(scene, frame);
  const defs = clipDefs(scene, evaluated);
  const markup = evaluated.map((layer) => {
    if (!layer.visible || layer.opacity <= 0) return '';
    let body;
    if (layer.type === 'custom_text') body = '<text x="0" y="0" text-anchor="middle" dominant-baseline="middle" fill="' + escapeXml(layer.fillColor || 'none') + '" stroke="' + escapeXml(layer.strokeColor || 'none') + '" stroke-width="0.5" font-size="' + (layer.fontSize || 24) + '" font-weight="bold" font-family="' + escapeXml(layer.fontFamily || 'Outfit') + '" vector-effect="non-scaling-stroke">' + escapeXml(layer.textValue || 'TEXT') + '</text>';
    else if (layer.type === 'custom_image') { const width = layer.width || 180; const height = layer.height || 120; const href = imageReferences[layer.imageUrl] || layer.imageUrl || ''; body = '<image href="' + escapeXml(href) + '" x="' + (-width / 2) + '" y="' + (-height / 2) + '" width="' + width + '" height="' + height + '" preserveAspectRatio="xMidYMid slice" />'; }
    else body = renderShape(layer);
    const matte = layer.matte; const clip = matte && (matte.mode || 'clip') === 'clip' ? ' clip-path="url(#kcs-clip-' + escapeXml(matte.sourcePartId) + ')"' : '';
    return '<g data-layer-id="' + escapeXml(layer.id) + '" data-z-index="' + layer.zIndex + '" transform="' + layerTransform(scene, layer) + '" opacity="' + layer.opacity + '"' + clip + '>' + body + '</g>';
  }).join('');
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + scene.width + '" height="' + scene.height + '" viewBox="0 0 ' + scene.width + ' ' + scene.height + '"><defs>' + defs + '</defs>' + markup + '</svg>';
}

export default class Graphic extends HTMLElement {
  constructor() { super(); this._scene = JSON.parse(JSON.stringify(SCENE)); this._currentFrame = 0; this._currentStep = undefined; this._raf = null; this._token = 0; this._resolveAction = null; }
  _cancel() { this._token += 1; if (this._resolveAction) { this._resolveAction({ statusCode: 200, statusMessage: 'Superseded' }); this._resolveAction = null; } if (this._raf !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this._raf); this._raf = null; }
  _render() { this.innerHTML = renderScene(this._scene, this._currentFrame, IMAGE_REFERENCES); }
  _applyData(data) { if (!data || typeof data !== 'object') return undefined; for (const key of Object.keys(data)) { const binding = PUBLIC_BINDINGS.text[key] || PUBLIC_BINDINGS.image[key]; if (!binding) return { statusCode: 400, statusMessage: 'Unknown public field: ' + key }; const layer = this._scene.layers.find((item) => item.id === binding.layerId); if (!layer || typeof data[key] !== 'string') return { statusCode: 400, statusMessage: 'Invalid public field value: ' + key }; if (binding.property === 'imageUrl' && !IMAGE_REFERENCES[data[key]]) return { statusCode: 400, statusMessage: 'Image value is not a packaged asset: ' + key }; layer[binding.property] = data[key]; } return undefined; }
  async load(params) { this._cancel(); if (params && params.renderType && params.renderType !== 'realtime') return { statusCode: 400, statusMessage: 'Only realtime rendering is supported' }; const error = this._applyData(params && params.data); if (error) return error; this._currentFrame = 0; this._currentStep = undefined; this._render(); return { statusCode: 200 }; }
  async dispose() { this._cancel(); this._scene = JSON.parse(JSON.stringify(SCENE)); this.innerHTML = ''; return { statusCode: 200 }; }
  _animate(targetFrame, skipAnimation) { this._cancel(); const token = this._token; const startFrame = this._currentFrame; if (skipAnimation || startFrame === targetFrame || typeof requestAnimationFrame !== 'function') { this._currentFrame = targetFrame; this._render(); return Promise.resolve({ statusCode: 200 }); } const duration = Math.abs(targetFrame - startFrame) / this._scene.fps * 1000; const started = typeof performance === 'object' ? performance.now() : Date.now(); return new Promise((resolve) => { this._resolveAction = resolve; const tick = (now) => { if (token !== this._token || !this._scene) { resolve({ statusCode: 200, statusMessage: 'Superseded' }); return; } const progress = clamp((now - started) / duration, 0, 1); this._currentFrame = startFrame + (targetFrame - startFrame) * progress; this._render(); if (progress >= 1) { this._raf = null; this._resolveAction = null; resolve({ statusCode: 200 }); return; } this._raf = requestAnimationFrame(tick); }; this._raf = requestAnimationFrame(tick); }); }
  async playAction(params = {}) { this._currentStep = 0; const result = await this._animate(this._scene.totalFrames, params.skipAnimation === true); return Object.assign({}, result, { currentStep: this._currentStep }); }
  async stopAction(params = {}) { const result = await this._animate(this._scene.totalFrames, params.skipAnimation === true); this._currentStep = undefined; return result; }
  async updateAction(params) { this._cancel(); const error = this._applyData(params && params.data); if (error) return error; this._render(); return { statusCode: 200 }; }
  async customAction() { return { statusCode: 400, statusMessage: 'No custom actions supported' }; }
}
`;
}
