import type { BodyPartType, CharacterPart, Track } from '../../types/animator';
import { generateId } from './idGenerator';
import { makeEmptyChannels } from '../animation/defaults';
import { TOOLBAR_COLORS, DEFAULT_CLONER_CONFIG, DEFAULT_PARTICLE_CONFIG } from '../editor/constants';
import { defaultStrokeWidth, isShapeAppearanceEligible } from './shapeAppearance';

/**
 * A new layer's colour: a random toolbar colour other than the last few, so
 * shapes drawn one after another differ (any 4 in a row are all different; an
 * independent random pick repeated a colour often).
 */
const RECENT_COLOURS = 3;
const recentColours: string[] = [];
const nextToolbarColour = (): string => {
  const fresh = TOOLBAR_COLORS.filter((colour) => !recentColours.includes(colour));
  const pool = fresh.length > 0 ? fresh : TOOLBAR_COLORS;
  const colour = pool[Math.floor(Math.random() * pool.length)];
  recentColours.push(colour);
  if (recentColours.length > Math.min(RECENT_COLOURS, TOOLBAR_COLORS.length - 1)) recentColours.shift();
  return colour;
};

/** A new text's size: readable on a 1080p stage and easy to grab. */
export const NEW_TEXT_FONT_SIZE = 72;

export const createCustomPart = (
  type: BodyPartType,
  name: string,
  zIndex: number,
  extraProps?: Partial<CharacterPart>
): { newPart: CharacterPart; newTrack: Track } => {
  const partId = generateId('part');
  const randomColor = nextToolbarColour();
  const modernAppearanceDefaults = isShapeAppearanceEligible(type)
    ? {
      fillEnabled: true,
      fillOpacity: 1,
      strokeEnabled: true,
      strokeWidth: defaultStrokeWidth(type),
      strokeOpacity: 1,
      strokeAlignment: 'center' as const,
      trimPathEnabled: false,
      trimPathStart: 0,
      trimPathEnd: 1,
      trimPathOffset: 0,
    }
    : {};

  const newPart: CharacterPart = {
    id: partId,
    name,
    type,
    zIndex,
    fillColor: randomColor,
    strokeColor: '#101218',
    ...modernAppearanceDefaults,
    pivot: { x: 0.5, y: 0.5 },
    parentId: extraProps?.parentId !== undefined ? extraProps.parentId : undefined,
    baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 },
    textValue: type === 'custom_text' ? 'NEW TEXT' : type === 'custom_banner' ? 'CARD LABEL' : undefined,
    // A new text is placed, turned and scaled about its middle, like a shape.
    ...(type === 'custom_text' ? { textOrigin: 'center' as const } : {}),
    fontSize: type === 'custom_text' ? NEW_TEXT_FONT_SIZE : 20,
    cardCategory: type === 'custom_card' ? 'STUDIO CARD' : undefined,
    cardTitle: type === 'custom_card' ? 'MOTION GRAPHIC' : undefined,
    cardButtonText: type === 'custom_card' ? 'ACTIVE' : undefined,
    strokeProgress: 1,
    anchor: 'none',
    anchorOffsetX: 0,
    anchorOffsetY: 0,
    clonerConfig: type === 'mograph_cloner'
      ? { ...DEFAULT_CLONER_CONFIG, childColor: randomColor }
      : undefined,
    particleConfig: type === 'particle_system'
      ? { ...DEFAULT_PARTICLE_CONFIG, color: randomColor }
      : undefined,
    ...extraProps,
  };

  // Reset Transform returns the layer to the pose it was made with.
  const { x, y, rotation, scaleX, scaleY, opacity } = newPart.baseTransform;
  newPart.homeTransform = { x, y, rotation, scaleX, scaleY, opacity };

  const newTrack: Track = {
    id: generateId('track'),
    partId,
    name: name,
    color: randomColor,
    visible: true,
    locked: false,
    expanded: false,
    keyframes: [],
    channels: makeEmptyChannels(),
  };

  return { newPart, newTrack };
};
