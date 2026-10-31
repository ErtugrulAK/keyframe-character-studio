import type { CharacterPart, Transform } from '../../types/animator';
import { textBaselineOffset } from './textOrigin';
import { applyAffine, worldAffineOf, type WorldAffine } from './containerMath';
import { getShapeGeometry } from './shapeGeometry';
import { resolveShapeAppearance } from '../layers/shapeAppearance';

type TextMetrics = {
  halfW: number;
  halfH: number;
  offsetY: number;
};

const TEXT_METRICS_FALLBACK = (text: string, fontSize: number, fontFamily?: string): TextMetrics => {
  if (!text) return { halfW: 20, halfH: 12, offsetY: 0 };

  let fontMultiplier = 0.48;
  const family = (fontFamily || '').toLowerCase();

  if (family.includes('playfair') || family.includes('serif') || family.includes('georgia')) {
    fontMultiplier = 0.56;
  } else if (family.includes('mono') || family.includes('jetbrains') || family.includes('courier')) {
    fontMultiplier = 0.62;
  } else if (family.includes('bebas')) {
    fontMultiplier = 0.40;
  } else if (family.includes('montserrat')) {
    fontMultiplier = 0.52;
  }

  let totalWidth = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === ' ') {
      totalWidth += fontSize * (fontMultiplier * 0.55);
    } else if (/[ilIjtf1!.,:;\\'\\|()\\[\\]]/.test(char)) {
      totalWidth += fontSize * (fontMultiplier * 0.55);
    } else if (/[WMwm@#%QGO]/.test(char)) {
      totalWidth += fontSize * (fontMultiplier * 1.35);
    } else if (/[A-Z]/.test(char)) {
      totalWidth += fontSize * (fontMultiplier * 1.15);
    } else {
      totalWidth += fontSize * fontMultiplier;
    }
  }

  return {
    halfW: Math.max(20, (totalWidth + 24) / 2),
    halfH: Math.max(14, (fontSize * 0.9 + 12) / 2),
    offsetY: -(fontSize * 0.35),
  };
};

/**
 * Match the normal SVG text renderer's baseline contract. Browser Canvas
 * metrics provide the actual advance width for the active font; the fallback
 * preserves deterministic geometry in non-browser test environments.
 */
export const getTextMetrics = (text: string, fontSize: number, fontFamily?: string): TextMetrics => {
  const fallback = TEXT_METRICS_FALLBACK(text, fontSize, fontFamily);
  if (typeof document === 'undefined') return fallback;

  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return fallback;

    context.font = `bold ${fontSize}px ${fontFamily || 'Outfit'}`;
    const measured = context.measureText(text || 'TEXT');
    if (!Number.isFinite(measured.width) || measured.width <= 0) return fallback;

    return {
      halfW: measured.width / 2,
      halfH: fontSize * 0.561,
      offsetY: -(fontSize * 0.346),
    };
  } catch {
    return fallback;
  }
};

/** A box around the drawn glyphs, relative to the text's anchor on its baseline. */
type TextInkBox = { minX: number; maxX: number; minY: number; maxY: number };

/**
 * The box the glyphs actually cover (the ink), as the stage draws them: bold,
 * centred on the anchor, baseline at y = 0. `null` where the browser cannot
 * measure it (no DOM, no ink metrics, nothing visible) — callers then use the
 * em box from `getTextMetrics`.
 */
const getTextInkBox = (text: string, fontSize: number, fontFamily?: string): TextInkBox | null => {
  if (typeof document === 'undefined') return null;
  try {
    const context = document.createElement('canvas').getContext('2d');
    if (!context) return null;
    context.font = `bold ${fontSize}px ${fontFamily || 'Outfit'}`;
    context.textAlign = 'center';
    context.textBaseline = 'alphabetic';
    const measured = context.measureText(text);
    const box = {
      minX: -measured.actualBoundingBoxLeft,
      maxX: measured.actualBoundingBoxRight,
      minY: -measured.actualBoundingBoxAscent,
      maxY: measured.actualBoundingBoxDescent,
    };
    const finite = Object.values(box).every(Number.isFinite);
    return finite && box.maxX > box.minX && box.maxY > box.minY ? box : null;
  } catch {
    return null;
  }
};

/**
 * Axis-aligned bounds in the part's authored local coordinate space.
 * `offsetX/Y` describe the visual geometry center relative to the transform
 * origin, which is important for asymmetric polygons such as triangles.
 */
export interface PartLocalBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  halfW: number;
  halfH: number;
  offsetX: number;
  offsetY: number;
}

const boundsFromPoints = (points: { x: number; y: number }[]): PartLocalBounds | null => {
  if (!Array.isArray(points) || points.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  points.forEach((point) => {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  });
  if (![minX, minY, maxX, maxY].every(Number.isFinite)) return null;
  const halfW = Math.max(1, (maxX - minX) / 2);
  const halfH = Math.max(1, (maxY - minY) / 2);
  return {
    minX,
    minY,
    maxX,
    maxY,
    halfW,
    halfH,
    offsetX: (minX + maxX) / 2,
    offsetY: (minY + maxY) / 2,
  };
};

const fallbackBounds = (): PartLocalBounds => ({
  minX: -32,
  minY: -32,
  maxX: 32,
  maxY: 32,
  halfW: 32,
  halfH: 32,
  offsetX: 0,
  offsetY: 0,
});

/**
 * The two corners of a media layer's bounds.
 *
 * An image measured at import carries its non-transparent content rectangle, so
 * the bounds describe the visible art instead of the padded bitmap; a video, and
 * any image imported before that measurement existed, uses the whole box.
 */
const mediaBoundsCorners = (part: CharacterPart): { x: number; y: number }[] => {
  const content = part.imageContentBounds;
  if (content
    && [content.minX, content.minY, content.maxX, content.maxY].every(Number.isFinite)
    && content.maxX > content.minX
    && content.maxY > content.minY) {
    return [
      { x: content.minX, y: content.minY },
      { x: content.maxX, y: content.maxY },
    ];
  }
  const halfW = part.width ? part.width / 2 : (part.type === 'custom_video' ? 100 : 90);
  const halfH = part.height ? part.height / 2 : 60;
  return [{ x: -halfW, y: -halfH }, { x: halfW, y: halfH }];
};

/**
 * Return the exact local geometry bounds used by the renderer. For Boolean
 * groups all contours participate; using only `points` would lose holes and
 * can produce stale, oversized selection rectangles.
 */
export const getPartLocalBounds = (
  part: CharacterPart,
  transform?: Pick<Transform, 'scaleX' | 'scaleY'>,
): PartLocalBounds => {
  let bounds: PartLocalBounds | null = null;
  if (part.booleanContours && part.booleanContours.length > 0) {
    bounds = boundsFromPoints(part.booleanContours.flat());
  }

  const geometry = getShapeGeometry(part.type);
  if (!bounds && geometry) {
    if (geometry.kind === 'circle') {
      bounds = boundsFromPoints([
        { x: -geometry.r, y: -geometry.r },
        { x: geometry.r, y: geometry.r },
      ]);
    } else if (geometry.kind === 'polygon') {
      bounds = boundsFromPoints(geometry.points);
    } else {
      bounds = boundsFromPoints([
        { x: geometry.x, y: geometry.y },
        { x: geometry.x + geometry.width, y: geometry.y + geometry.height },
      ]);
    }
  }

  if (!bounds && part.type === 'custom_freeform') {
    if (part.path?.points?.length) {
      const width = part.width ?? 200;
      const height = part.height ?? 120;
      const pathPoints = part.path.coordinateSpace === 'normalized'
        ? part.path.points.map((point) => ({ x: (point.x - 0.5) * width, y: (point.y - 0.5) * height }))
        : part.path.points;
      bounds = boundsFromPoints(pathPoints);
    }
  }

  if (!bounds && part.type === 'custom_freeform') {
    bounds = boundsFromPoints(part.points || []);
  }

  if (!bounds) {
    switch (part.type as string) {
      case 'custom_text':
      case 'text':
      case 'heading':
      case 'title': {
        // The frame hugs the letters the user sees (as After Effects does);
        // the em box is the fallback where the glyphs cannot be measured.
        const text = part.textValue || part.name || 'TEXT';
        const fontSize = part.fontSize || 24;
        const baselineY = textBaselineOffset(part);
        const ink = getTextInkBox(text, fontSize, part.fontFamily);
        if (ink) {
          bounds = boundsFromPoints([
            { x: ink.minX, y: ink.minY + baselineY },
            { x: ink.maxX, y: ink.maxY + baselineY },
          ]);
          break;
        }
        const metrics = getTextMetrics(text, fontSize, part.fontFamily);
        const centreY = metrics.offsetY + baselineY;
        bounds = boundsFromPoints([
          { x: -metrics.halfW, y: centreY - metrics.halfH },
          { x: metrics.halfW, y: centreY + metrics.halfH },
        ]);
        break;
      }
      case 'custom_image':
      case 'custom_video':
        bounds = boundsFromPoints(mediaBoundsCorners(part));
        break;
      case 'mograph_cloner': {
        const cfg = part.clonerConfig;
        if (cfg?.mode === 'grid') {
          bounds = boundsFromPoints([
            { x: -((cfg.countX - 1) * cfg.spacingX + cfg.childSize * 2) / 2, y: -((cfg.countY - 1) * cfg.spacingY + cfg.childSize * 2) / 2 },
            { x: ((cfg.countX - 1) * cfg.spacingX + cfg.childSize * 2) / 2, y: ((cfg.countY - 1) * cfg.spacingY + cfg.childSize * 2) / 2 },
          ]);
        } else if (cfg?.mode === 'circle') {
          const extent = Math.max(30, cfg.radius + cfg.childSize);
          bounds = boundsFromPoints([{ x: -extent, y: -extent }, { x: extent, y: extent }]);
        } else if (cfg) {
          const halfW = Math.max(30, ((cfg.countLinear - 1) * cfg.spacingLinear + cfg.childSize * 2) / 2);
          bounds = boundsFromPoints([{ x: -halfW, y: -cfg.childSize }, { x: halfW, y: cfg.childSize }]);
        }
        break;
      }
    }
  }

  const resolved = bounds ?? fallbackBounds();
  if (transform) {
    const appearance = resolveShapeAppearance(part);
    if (appearance.isModernAppearance && appearance.strokeEnabled && appearance.strokeOpacity > 0 && appearance.strokeWidth > 0) {
      const extent = appearance.strokeAlignment === 'outside'
        ? appearance.strokeWidth
        : appearance.strokeAlignment === 'inside'
          ? 0
          : appearance.strokeWidth / 2;
      const strokeX = extent / Math.max(0.001, Math.abs(transform.scaleX));
      const strokeY = extent / Math.max(0.001, Math.abs(transform.scaleY));
      return boundsFromPoints([
        { x: resolved.minX - strokeX, y: resolved.minY - strokeY },
        { x: resolved.maxX + strokeX, y: resolved.maxY + strokeY },
      ]) ?? fallbackBounds();
    }
  }
  return resolved;
};


/**
 * Legacy symmetric extents API. Existing scaling and hit-test callers keep
 * their contract while selection/marquee callers can use precise bounds.
 */
export const getPartBounds = (
  part: CharacterPart,
  transform?: Pick<Transform, 'scaleX' | 'scaleY'>,
): { halfW: number; halfH: number } => {
  const bounds = getPartLocalBounds(part, transform);
  return {
    halfW: Math.max(Math.abs(bounds.minX), Math.abs(bounds.maxX)),
    halfH: Math.max(Math.abs(bounds.minY), Math.abs(bounds.maxY)),
  };
};

export interface PartWorldBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Transform the four local bounds corners into world/canvas coordinates.
 *
 * The corner map is the layer's exact world affine — `worldAffineOf(transform)`
 * — rather than a hand-rolled `origin + R(rotation)·(local ⊙ scale)`. For a
 * shear-free pose the two are the same map; for a rotated child of an
 * anisotropically scaled container they differ, and only the affine carries the
 * nesting the authored TRS fields cannot. `worldAffineOf` falls back to the
 * TRS' own map when no derived affine is attached, so a plain `Transform`
 * produces exactly the historical numbers.
 */
export const getPartWorldBounds = (
  part: CharacterPart,
  transform: Transform & { affine?: WorldAffine },
  canvasCenterX: number,
  canvasCenterY: number,
): PartWorldBounds => {
  const local = getPartLocalBounds(part, transform);
  const m = worldAffineOf(transform);
  const worldOffset = { ...m, e: m.e + canvasCenterX, f: m.f + canvasCenterY };
  const world = [
    { x: local.minX, y: local.minY },
    { x: local.maxX, y: local.minY },
    { x: local.maxX, y: local.maxY },
    { x: local.minX, y: local.maxY },
  ].map((corner) => applyAffine(worldOffset, corner));
  return {
    minX: Math.min(...world.map((point) => point.x)),
    minY: Math.min(...world.map((point) => point.y)),
    maxX: Math.max(...world.map((point) => point.x)),
    maxY: Math.max(...world.map((point) => point.y)),
  };
};
