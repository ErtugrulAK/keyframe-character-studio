import React from 'react';
import type { CharacterPart, Transform } from '../../../types/animator';

export const getTextMetrics = (text: string, fontSize: number, fontFamily?: string): { halfW: number; halfH: number } => {
  if (!text) return { halfW: 20, halfH: 12 };

  // Adjust base character multiplier dynamically based on font family style
  let fontMultiplier = 0.48; // default sans-serif (Outfit / Inter / Roboto)
  const family = (fontFamily || '').toLowerCase();

  if (family.includes('playfair') || family.includes('serif') || family.includes('georgia')) {
    fontMultiplier = 0.56; // Serif fonts have wider letterforms and decorative serifs
  } else if (family.includes('mono') || family.includes('jetbrains') || family.includes('courier')) {
    fontMultiplier = 0.62; // Monospace fonts have wide fixed-width characters
  } else if (family.includes('bebas')) {
    fontMultiplier = 0.40; // Condensed fonts are narrower
  } else if (family.includes('montserrat')) {
    fontMultiplier = 0.52;
  }

  let totalWidth = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === ' ') {
      totalWidth += fontSize * (fontMultiplier * 0.55);
    } else if (/[ilIjtf1!.,:;\'\|()\[\]]/.test(char)) {
      totalWidth += fontSize * (fontMultiplier * 0.55);
    } else if (/[WMwm@#%QGO]/.test(char)) {
      totalWidth += fontSize * (fontMultiplier * 1.35);
    } else if (/[A-Z]/.test(char)) {
      totalWidth += fontSize * (fontMultiplier * 1.15);
    } else {
      totalWidth += fontSize * fontMultiplier;
    }
  }

  // Comfortably enclose all letters (including wide serifs) with 12px padding on each side
  const halfW = Math.max(20, (totalWidth + 24) / 2);
  const halfH = Math.max(14, (fontSize * 0.9 + 12) / 2);

  return { halfW, halfH };
};

export const getPartBounds = (part: CharacterPart): { halfW: number; halfH: number } => {
  let halfW = 32;
  let halfH = 32;

  switch (part.type) {
    case 'custom_card':
      halfW = part.width ? part.width / 2 : 90;
      halfH = part.height ? part.height / 2 : 50;
      break;
    case 'custom_rect':
      halfW = part.width ? part.width / 2 : 60;
      halfH = part.height ? part.height / 2 : 30;
      break;
    case 'custom_banner':
      halfW = part.width ? part.width / 2 : 80;
      halfH = part.height ? part.height / 2 : 25;
      break;
    case 'custom_text': {
      const textStr = part.textValue || part.name || 'TEXT';
      const fontSize = part.fontSize || 24;
      const metrics = getTextMetrics(textStr, fontSize, part.fontFamily);
      halfW = metrics.halfW;
      halfH = metrics.halfH;
      break;
    }
    case 'custom_image':
    case 'custom_video':
      halfW = part.width ? part.width / 2 : (part.type === 'custom_video' ? 100 : 90);
      halfH = part.height ? part.height / 2 : 60;
      break;
    case 'mograph_cloner': {
      const cfg = part.clonerConfig;
      if (cfg) {
        if (cfg.mode === 'grid') {
          halfW = Math.max(30, ((cfg.countX - 1) * cfg.spacingX + cfg.childSize * 2) / 2);
          halfH = Math.max(30, ((cfg.countY - 1) * cfg.spacingY + cfg.childSize * 2) / 2);
        } else if (cfg.mode === 'circle') {
          halfW = Math.max(30, cfg.radius + cfg.childSize);
          halfH = Math.max(30, cfg.radius + cfg.childSize);
        } else {
          halfW = Math.max(30, ((cfg.countLinear - 1) * cfg.spacingLinear + cfg.childSize * 2) / 2);
          halfH = Math.max(20, cfg.childSize);
        }
      } else {
        halfW = 60;
        halfH = 40;
      }
      break;
    }
  }

  return { halfW, halfH };
};

export type ScaleMode = 'scale_corner' | 'scale_x' | 'scale_y' | 'scale_left' | 'scale_right' | 'scale_top' | 'scale_bottom';

interface TransformGizmoProps {
  selectedPart: CharacterPart;
  selectedTransform: Transform;
  zScale: number;
  onRotateMouseDown: (e: React.MouseEvent) => void;
  onScaleMouseDown: (e: React.MouseEvent, mode: ScaleMode) => void;
  isGroup?: boolean;
  overrideHalfW?: number;
  overrideHalfH?: number;
}

export const TransformGizmo: React.FC<TransformGizmoProps> = ({
  selectedPart,
  selectedTransform,
  zScale,
  onRotateMouseDown,
  onScaleMouseDown,
  isGroup = false,
  overrideHalfW,
  overrideHalfH,
}) => {
  const baseBounds = getPartBounds(selectedPart);
  
  // Multiply bounds by absolute scale so handles don't get warped or flipped visually
  const halfW = overrideHalfW ?? (baseBounds.halfW * Math.abs(selectedTransform.scaleX));
  const halfH = overrideHalfH ?? (baseBounds.halfH * Math.abs(selectedTransform.scaleY));

  const rotBarLength = halfH + 30 * zScale;

  return (
    <g
      transform={`translate(${300 + selectedTransform.x}, ${240 + selectedTransform.y}) rotate(${selectedTransform.rotation})`}
      style={{ pointerEvents: 'none' }}
    >
      {/* Dashed Bounding Box Outline */}
      <rect
        x={-halfW}
        y={-halfH}
        width={halfW * 2}
        height={halfH * 2}
        fill="none"
        stroke="#00d2ff"
        strokeWidth={1.5 * zScale}
        strokeDasharray={`${5 * zScale} ${4 * zScale}`}
        vectorEffect="non-scaling-stroke"
      />

      {!isGroup && (
        <>
          {/* Rotation Handle (Top Center, extended upwards) */}
          <line
            x1={0}
            y1={-halfH}
            x2={0}
            y2={-rotBarLength}
            stroke="#00d2ff"
            strokeWidth={2 * zScale}
            vectorEffect="non-scaling-stroke"
          />
          <circle
            cx={0}
            cy={-rotBarLength}
            r={7 * zScale}
            fill="#ffb700"
            stroke="#ffffff"
            strokeWidth={2 * zScale}
            style={{ cursor: 'grab', pointerEvents: 'auto' }}
            onMouseDown={onRotateMouseDown}
          />

          {/* 4 Edge Midpoint Handles (Single-Edge Directional Stretch) */}
          <circle
            cx={-halfW}
            cy={0}
            r={4.5 * zScale}
            fill="#38bdf8"
            stroke="#ffffff"
            strokeWidth={1.5 * zScale}
            style={{ cursor: 'ew-resize', pointerEvents: 'auto' }}
            onMouseDown={(e) => onScaleMouseDown(e, 'scale_left')}
          />
          <circle
            cx={halfW}
            cy={0}
            r={4.5 * zScale}
            fill="#38bdf8"
            stroke="#ffffff"
            strokeWidth={1.5 * zScale}
            style={{ cursor: 'ew-resize', pointerEvents: 'auto' }}
            onMouseDown={(e) => onScaleMouseDown(e, 'scale_right')}
          />
          <circle
            cx={0}
            cy={-halfH}
            r={4.5 * zScale}
            fill="#c084fc"
            stroke="#ffffff"
            strokeWidth={1.5 * zScale}
            style={{ cursor: 'ns-resize', pointerEvents: 'auto' }}
            onMouseDown={(e) => onScaleMouseDown(e, 'scale_top')}
          />
          <circle
            cx={0}
            cy={halfH}
            r={4.5 * zScale}
            fill="#c084fc"
            stroke="#ffffff"
            strokeWidth={1.5 * zScale}
            style={{ cursor: 'ns-resize', pointerEvents: 'auto' }}
            onMouseDown={(e) => onScaleMouseDown(e, 'scale_bottom')}
          />

          {/* 4 Corner Scale Handles (Proportional / Uniform Scale) */}
          {[
            { x: -halfW, y: -halfH, cursor: 'nwse-resize' },
            { x: halfW, y: -halfH, cursor: 'nesw-resize' },
            { x: halfW, y: halfH, cursor: 'nwse-resize' },
            { x: -halfW, y: halfH, cursor: 'nesw-resize' },
          ].map((corner, i) => (
            <rect
              key={`corner-${i}`}
              x={corner.x - 5 * zScale}
              y={corner.y - 5 * zScale}
              width={10 * zScale}
              height={10 * zScale}
              fill="#00d2ff"
              stroke="#ffffff"
              strokeWidth={1.5 * zScale}
              style={{ cursor: corner.cursor, pointerEvents: 'auto' }}
              onMouseDown={(e) => onScaleMouseDown(e, 'scale_corner')}
            />
          ))}
        </>
      )}

      {/* Center Pivot Point Dot */}
      <circle cx={0} cy={0} r={4 * zScale} fill="#00d2ff" stroke="#ffffff" strokeWidth={1.5 * zScale} />
    </g>
  );
};
