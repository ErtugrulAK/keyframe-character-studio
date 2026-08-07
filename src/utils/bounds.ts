import type { CharacterPart } from '../types/animator';
import { getFreeformBounds } from './freeform';

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

export const getPartBounds = (part: CharacterPart): { halfW: number; halfH: number } => {
  let halfW = 32;
  let halfH = 32;

  switch (part.type as string) {
    case 'custom_freeform': {
      const b = getFreeformBounds(part.points || []);
      halfW = b.halfW;
      halfH = b.halfH;
      break;
    }
    case 'custom_circle':
    case 'custom_box':
      halfW = part.width ? part.width / 2 : 30;
      halfH = part.height ? part.height / 2 : 30;
      break;
    case 'custom_star':
      halfW = part.width ? part.width / 2 : 35;
      halfH = part.height ? part.height / 2 : 32.5;
      break;
    case 'custom_triangle':
      halfW = part.width ? part.width / 2 : 35;
      halfH = part.height ? part.height / 2 : 30;
      break;
    case 'custom_diamond':
      halfW = part.width ? part.width / 2 : 35;
      halfH = part.height ? part.height / 2 : 35;
      break;
    case 'custom_parallelogram':
      halfW = part.width ? part.width / 2 : 60;
      halfH = part.height ? part.height / 2 : 30;
      break;
    case 'custom_capsule':
      halfW = part.width ? part.width / 2 : 50;
      halfH = part.height ? part.height / 2 : 20;
      break;
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
    case 'custom_text':
    case 'text':
    case 'heading':
    case 'title': {
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
