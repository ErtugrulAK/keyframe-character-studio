import type { CharacterPart, Transform } from '../types/animator';
import { getShapeGeometry } from './shapeGeometry';
import { resolveShapeAppearance } from './shapeAppearance';

export const getTextMetrics = (text: string, fontSize: number, fontFamily?: string): { halfW: number; halfH: number } => {
  if (!text) return { halfW: 20, halfH: 12 };

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

  const halfW = Math.max(20, (totalWidth + 24) / 2);
  const halfH = Math.max(14, (fontSize * 0.9 + 12) / 2);

  return { halfW, halfH };
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
    bounds = boundsFromPoints(part.points || []);
  }

  if (!bounds) {
    switch (part.type as string) {
      case 'custom_text':
      case 'text':
      case 'heading':
      case 'title': {
        const metrics = getTextMetrics(part.textValue || part.name || 'TEXT', part.fontSize || 24, part.fontFamily);
        bounds = boundsFromPoints([
          { x: -metrics.halfW, y: -metrics.halfH },
          { x: metrics.halfW, y: metrics.halfH },
        ]);
        break;
      }
      case 'custom_image':
      case 'custom_video':
        bounds = boundsFromPoints([
          { x: -(part.width ? part.width / 2 : (part.type === 'custom_video' ? 100 : 90)), y: -(part.height ? part.height / 2 : 60) },
          { x: part.width ? part.width / 2 : (part.type === 'custom_video' ? 100 : 90), y: part.height ? part.height / 2 : 60 },
        ]);
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

/** Transform the four local bounds corners into world/canvas coordinates. */
export const getPartWorldBounds = (
  part: CharacterPart,
  transform: Transform,
  canvasCenterX: number,
  canvasCenterY: number,
): PartWorldBounds => {
  const local = getPartLocalBounds(part, transform);
  const radians = (transform.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const corners = [
    [local.minX, local.minY],
    [local.maxX, local.minY],
    [local.maxX, local.maxY],
    [local.minX, local.maxY],
  ];
  const world = corners.map(([x, y]) => {
    const scaledX = x * transform.scaleX;
    const scaledY = y * transform.scaleY;
    return {
      x: canvasCenterX + transform.x + scaledX * cos - scaledY * sin,
      y: canvasCenterY + transform.y + scaledX * sin + scaledY * cos,
    };
  });
  return {
    minX: Math.min(...world.map((point) => point.x)),
    minY: Math.min(...world.map((point) => point.y)),
    maxX: Math.max(...world.map((point) => point.x)),
    maxY: Math.max(...world.map((point) => point.y)),
  };
};
